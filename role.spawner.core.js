/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.spawner.core');
 * mod.thing == 'a thing'; // true
 */

const role = {
    RoleName: "Core",
    Tick: function(spawner) {
        checkData(spawner);

        const selfFullEnergy = spawner.store.getFreeCapacity(RESOURCE_ENERGY) === 0;

        const extensions = spawner.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
        let totalCapacity = spawner.store.getCapacity(RESOURCE_ENERGY);
        let totalPresent = spawner.store.getUsedCapacity(RESOURCE_ENERGY);
        for (const extension of extensions) {
            totalCapacity += extension.store.getCapacity(RESOURCE_ENERGY);
            totalPresent += extension.store.getUsedCapacity(RESOURCE_ENERGY);
        }
        const isFullEnergy = totalCapacity === totalPresent;

        // Check for emergency spawn of first harvester if it has been destroyed.
        let allOtherHarvestersDestroyed = true;
        for (let i = 1; i <= spawner.memory.targetCreepPopulations["Harvester"]; i++) {
            if (Game.creeps[`Harvester${i}`] !== undefined) {
                allOtherHarvestersDestroyed = false;
                break;
            }
        }
        if (Game.creeps["Harvester1"] === undefined && allOtherHarvestersDestroyed) {
            EmergencyCreepSpawn(spawner, totalPresent);

            // Tell all harvesters to now prioritize the controller if the first harvester is spawned.
            for (const name in Game.creeps) {
                if (Game.creeps[name].memory.role === "Harvester") {
                    Game.creeps[name].memory.target = "spawn";
                }
            }
            return;
        }
        // There's no point processing if the spawner is not full of energy.
        // Wait until the spawner is full before doing anything.
        if (!isFullEnergy) return;

        // Check for next creep to spawn.
        const nextCreep = getNextCreepSpawn(spawner, totalPresent);
        const inhibitSpawning = spawner.memory.inhibit === true;
        if (nextCreep && !inhibitSpawning && !spawner.spawning) {
            spawnCreepTick(spawner, totalPresent, nextCreep);
            return;
        }

        // Then consider upgrading the base.
        spawnStructureTick(spawner);
    },
    GetNextCreepSpawn: getNextCreepSpawn,
    SpawnCreepTick: spawnCreepTick,
    SpawnStructureTick: spawnStructureTick,
};

function checkData(spawner) {
    if (!spawner.memory.targetCreepPopulations)
        switch (spawner.room.level) {
            default:
            case 1:
                spawner.memory.targetCreepPopulations = {
                    "Harvester": 2,
                    "Builder": 2
                };
                break;
            case 2:
                spawner.memory.targetCreepPopulations = {
                    "Harvester": 3,
                    "Builder": 3,
                    "Defender": 2
                }
                break;
            case 3:
                spawner.memory.targetCreepPopulations = {
                    "Harvester": 5,
                    "Builder": 4,
                    "Defender": 2
                }
                break;
        }
    if (!spawner.room.memory) spawner.room.memory = {};
    if (!spawner.memory.foreignTargets) spawner.memory.foreignTargets = [];
    if (!spawner.memory.invasions) spawner.memory.invasions = [];
    if (!spawner.memory.looters) spawner.memory.looters = [];
    if (!spawner.memory.claimers) spawner.memory.claimers = [];
    if (!spawner.memory.travellers) spawner.memory.travellers = [];
}

function getPartsCost(parts) {
    return global.calculateBuildCost(parts);
}

function getCreepDefaultMemory(creepName, spawner) {
    const role = creepName.replace(/[0-9]/g, '');
    const index = creepName.replace(role, '');
    let defaultMemory = {
        role: role,
        index: index,
        target: null,
        state: "",
        homeRoom: spawner.room ? spawner.room.name : "",
        homeSpawner: spawner.id || spawner.name
    };
    if (spawner.room.controller.level >= 4) defaultMemory.takeFromContainers = true;
    if (creepName !== "Harvester1" && creepName !== "Harvester2" && creepName !== "Harvester3") defaultMemory.prioritizeController = true;
    if (creepName === "Harvester2") defaultMemory.forcedSource = "6aed85d4a26656029d741311"; // The storage in E33N41
    if (creepName === "Builder1") defaultMemory.repairOnly = true;
    if (creepName === "Builder2") defaultMemory.onlyImportantStuff = true;
    if (creepName === "Builder3") defaultMemory.ignoreImportantStuff = true;
    if (role === "ForeignHarvester") {
        const foreignTargetIndex = parseInt(index, 10);
        if (spawner.memory && spawner.memory.foreignTargets && spawner.memory.foreignTargets[foreignTargetIndex]) {
            defaultMemory.sourcePos = spawner.memory.foreignTargets[foreignTargetIndex];
        }
    }
    if (role === "Attacker" || role === "Invader") {
        if (role === "Invader") defaultMemory.role = "Attacker";
        const invasionIndex = parseInt(index, 10);
        const invasions = spawner.memory && spawner.memory.invasions;
        if (invasions && invasions[invasionIndex]) {
            const invasion = invasions[invasionIndex];
            defaultMemory.target = invasion.target;
            if (invasion.target) {
                defaultMemory.targetPos = invasion.target;
                defaultMemory.targetRoom = invasion.target.roomName;
            }
            if (invasion.reason) {
                defaultMemory.reason = invasion.reason;
            }
            if (invasion.rallyPoint) {
                defaultMemory.rally = invasion.rallyPoint;
                defaultMemory.rallyPos = invasion.rallyPoint;
                defaultMemory.rallyRoom = invasion.rallyPoint.roomName;
                if (typeof invasion.rallyPoint.creepCount === 'number') {
                    defaultMemory.rallyCount = invasion.rallyPoint.creepCount;
                }
            }
        }
    }
    if (role === "Looter") {
        const looterIndex = parseInt(index, 10);
        if (spawner.memory && spawner.memory.looters && spawner.memory.looters[looterIndex]) {
            const looterTarget = spawner.memory.looters[looterIndex];
            defaultMemory.target = looterTarget;
            defaultMemory.targetPos = looterTarget;
            defaultMemory.targetRoom = looterTarget.roomName;
        }
    }
    if (role === "Claimer") {
        const claimerIndex = parseInt(index, 10);
        if (spawner.memory && spawner.memory.claimers && spawner.memory.claimers[claimerIndex]) {
            const claimerTarget = spawner.memory.claimers[claimerIndex];
            defaultMemory.targetRoom = claimerTarget.roomName;
        }
    }
    if (role === "Traveller") {
        const travellerIndex = parseInt(index, 10);
        if (spawner.memory && spawner.memory.travellers && spawner.memory.travellers[travellerIndex]) {
            const travellerTarget = spawner.memory.travellers[travellerIndex];
            defaultMemory.target = { x: travellerTarget.x, y: travellerTarget.y };
            defaultMemory.targetPos = { x: travellerTarget.x, y: travellerTarget.y, roomName: travellerTarget.roomName };
            defaultMemory.targetRoom = travellerTarget.roomName;
            defaultMemory.destinationRole = travellerTarget.destinationRole;
        }
    }
    if (role === "Reserver") {
        const reserverIndex = parseInt(index, 10);
        if (spawner.memory && spawner.memory.reservers && spawner.memory.reservers[reserverIndex]) {
            const reserverTarget = spawner.memory.reservers[reserverIndex];
            defaultMemory.targetRoom = reserverTarget.roomName;
        }
    }
    if (creepName === "Leech1") defaultMemory.forcedSource = "5bbcaeda9099fc012e639a76";
    return defaultMemory;
}

function getNextCreepSpawn(spawner, energyCount) {
    if (typeof spawner === 'string') {
        spawner = Game.spawns[spawner];
    }
    if (!spawner && typeof Game !== 'undefined' && Game.spawns) {
        spawner = Object.values(Game.spawns)[0];
    }
    if (!spawner) return null;

    checkData(spawner);
    const offset = spawner.memory.CreepIndexOffset || 0; // So that we can spawn creeps with the same codebase and multiple spawns without naming conflicts.

    if (energyCount === undefined) {
        let totalPresent = spawner.store ? spawner.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
        if (spawner.room && typeof FIND_MY_STRUCTURES !== 'undefined') {
            const extensions = spawner.room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
            for (const extension of extensions) {
                totalPresent += extension.store.getUsedCapacity(RESOURCE_ENERGY);
            }
        }
        energyCount = totalPresent;
    }

    const creepRolesPriority = ["Harvester", "Leech", "Builder", "Looter", "Defender", "Attacker"];
    if (!spawner.memory.targetCreepPopulations) {
        spawner.memory.targetCreepPopulations = {
            "Harvester": 2,
            "Builder": 2
        };
    }
    for (let creepRole of creepRolesPriority) {
        if (!spawner.memory.targetCreepPopulations[creepRole]) continue;
        for (let i = 1 + offset; i <= spawner.memory.targetCreepPopulations[creepRole] + offset; i++) {
            const creepName = `${creepRole}${i}`;
            if (Game.creeps[creepName] === undefined) {
                let parts = [];
                if (creepRole === "Defender" || creepRole === "Attacker") {
                    const evenNumber = i % 2 === 0; // every other (the even number one) is a ranged attacker.
                    if (energyCount >= 1200) parts = (evenNumber) ? [TOUGH, TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK] : [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];
                    else if (energyCount >= 800) parts = (evenNumber) ? [TOUGH, TOUGH, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK] : [TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK];
                    else if (energyCount >= 450) parts = [TOUGH, TOUGH, MOVE, MOVE, ATTACK, ATTACK];
                    else parts = [TOUGH, TOUGH, MOVE, ATTACK];
                }
                else if (creepRole === "Leech") {
                    if (energyCount >= 1250) parts = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE]
                    else if (energyCount >= 1000) parts = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                    else if (energyCount >= 750) parts = [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
                    else if (energyCount >= 550) parts = [WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE];
                    else if (energyCount >= 300) parts = [WORK, WORK, CARRY, MOVE];
                    else parts = [WORK, CARRY, MOVE];
                }
                else if (creepRole === "Looter") {
                    if (energyCount >= 1000) parts = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    else if (energyCount >= 750) parts = [CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    else if (energyCount >= 550) parts = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
                    else if (energyCount >= 300) parts = [CARRY, CARRY, MOVE, MOVE, MOVE];
                    else parts = [CARRY, MOVE, MOVE];
                }
                else {
                    if (energyCount >= 1250) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, WORK, WORK, WORK, WORK, WORK];
                    else if (energyCount >= 1000) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, WORK, WORK, WORK, WORK];
                    else if (energyCount >= 750) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, WORK, WORK, WORK];
                    else if (energyCount >= 550) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, WORK, WORK];
                    else if (energyCount >= 200) parts = [MOVE, MOVE, CARRY, WORK];
                    else parts = [MOVE, CARRY, WORK];
                }

                return {
                    name: creepName,
                    parts: parts
                };
            }
        }
    }
    if (spawner.memory && spawner.memory.foreignTargets) {
        for (let i = 0; i < spawner.memory.foreignTargets.length; i++) {
            const foreignTarget = spawner.memory.foreignTargets[i];
            const creepName = `ForeignHarvester${i + offset}`;
            if (Game.creeps[creepName]) continue;
            let parts = [];
            if (energyCount >= 1250) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, WORK, WORK, WORK, WORK, WORK];
            else if (energyCount >= 1000) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, WORK, WORK, WORK, WORK];
            else if (energyCount >= 750) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, WORK, WORK, WORK];
            else if (energyCount >= 550) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, WORK, WORK];
            else if (energyCount >= 200) parts = [MOVE, MOVE, CARRY, WORK];
            else parts = [MOVE, CARRY, WORK];
            return {
                name: creepName,
                parts: parts
            };
        }
    }
    const invasions = spawner.memory && spawner.memory.invasions;
    if (invasions) {
        for (let i = 0; i < invasions.length; i++) {
            const invasion = invasions[i];
            if (!invasion) continue;
            const creepName = `Attacker${i + offset}`;
            if (Game.creeps[creepName] || Game.creeps[`Invader${i}`]) continue;
            let parts = [];
            const evenNumber = i % 2 === 0; // every other (the even number one) is a ranged attacker.
            if (invasion.parts) parts = invasion.parts;
            else if (energyCount >= 1200) parts = (evenNumber) ? [TOUGH, TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK] : [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];
            else if (energyCount >= 800) parts = (evenNumber) ? [TOUGH, TOUGH, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK] : [TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK];
            else if (energyCount >= 450) parts = [TOUGH, TOUGH, MOVE, MOVE, ATTACK, ATTACK];
            else parts = [TOUGH, TOUGH, MOVE, ATTACK];
            return {
                name: creepName,
                parts: parts
            };
        }
    }
    if (spawner.memory && spawner.memory.looters) {
        for (let i = 0; i < spawner.memory.looters.length; i++) {
            const looterTarget = spawner.memory.looters[i];
            if (!looterTarget) continue;
            const creepName = `Looter${i + offset}`;
            if (Game.creeps[creepName]) continue;
            let parts = [];
            if (energyCount >= 750) parts = [CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            else if (energyCount >= 550) parts = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
            else if (energyCount >= 300) parts = [CARRY, CARRY, MOVE, MOVE, MOVE];
            else parts = [CARRY, MOVE, MOVE];
            return {
                name: creepName,
                parts: parts
            };
        }
    }
    if (spawner.memory && spawner.memory.travellers) {
        for (let i = 0; i < spawner.memory.travellers.length; i++) {
            const travellerTarget = spawner.memory.travellers[i];
            if (!travellerTarget) continue;
            const creepName = `Traveller${i + offset}`;
            if (Game.creeps[creepName]) continue;
            let parts = travellerTarget.parts || [];
            if (parts.length === 0) {
                if (energyCount >= 1250) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, WORK, WORK, WORK, WORK, WORK];
                else if (energyCount >= 1000) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, WORK, WORK, WORK, WORK];
                else if (energyCount >= 750) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, WORK, WORK, WORK];
                else if (energyCount >= 550) parts = [MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, WORK, WORK];
                else if (energyCount >= 200) parts = [MOVE, MOVE, CARRY, WORK];
                else parts = [MOVE, CARRY, WORK];
            }
            return {
                name: creepName,
                parts: parts
            }
        }
    }
    if (spawner.memory && spawner.memory.claimers) {
        for (let i = 0; i < spawner.memory.claimers.length; i++) {
            const claimerTarget = spawner.memory.claimers[i];
            if (!claimerTarget) continue;
            const creepName = `Claimer${i + offset}`;
            if (Game.creeps[creepName]) continue;
            let parts = [];
            if (energyCount >= 2500) parts = [CLAIM, CLAIM, CLAIM, MOVE, MOVE, MOVE];
            else if (energyCount >= 1300) parts = [CLAIM, CLAIM, MOVE, MOVE];
            else parts = [CLAIM, MOVE];
            return {
                name: creepName,
                parts: parts
            };
        }
    }
    if (spawner.memory && spawner.memory.reservers) {
        for (let i = 0; i < spawner.memory.reservers.length; i++) {
            const reserverTarget = spawner.memory.reservers[i];
            if (!reserverTarget) continue;
            const creepName = `Reserver${i + offset}`;
            if (Game.creeps[creepName]) continue;
            let parts = [];
            if (energyCount >= 2500) parts = [CLAIM, CLAIM, CLAIM, MOVE, MOVE, MOVE];
            else if (energyCount >= 1300) parts = [CLAIM, CLAIM, MOVE, MOVE];
            else parts = [CLAIM, MOVE];
            return {
                name: creepName,
                parts: parts
            };
        }
    }
    return null;
}

function spawnCreepTick(spawner, energyCount, nextCreep) {
    if (!nextCreep) {
        nextCreep = getNextCreepSpawn(spawner, energyCount);
    }
    if (!nextCreep) return;

    const cost = getPartsCost(nextCreep.parts);
    console.log(`Spawning new creep: ${nextCreep.name} with parts [${nextCreep.parts}] (energy total: ${energyCount}, cost: ${cost})`);

    const defaultMemory = getCreepDefaultMemory(nextCreep.name, spawner);
    const spawnCreepResult = spawner.spawnCreep(nextCreep.parts, nextCreep.name, {
        memory: defaultMemory
    });
    return spawnCreepResult;
}

function spawnStructureTick(spawner) {
    console.log('spawnStructureTick not implemented yet...')
}

function EmergencyCreepSpawn(spawner, energyCount) {
    const nextCreep = getNextCreepSpawn(spawner, energyCount);
    if (!nextCreep) return;

    const defaultMemory = getCreepDefaultMemory(nextCreep.name, spawner);
    const spawnCreepResult = spawner.spawnCreep(nextCreep.parts, nextCreep.name, {
        memory: defaultMemory
    });
    console.log(`Emergency spawn of ${nextCreep.name} with result code ${spawnCreepResult}`);
    return spawnCreepResult;
}

global.getNextCreepSpawn = getNextCreepSpawn;

module.exports = role;
