global.hello = function() {
    console.log("Hello World!");
}

global.clearMemory = function() {
    for (const name in Memory.creeps) {
        for (const key in Memory.creeps[name]) {
            if (Memory.creeps[name][key] !== "role")
                delete Memory.creeps[name][key];
            else
                Memory.creeps[name][key] = name.replace(/[0-9]/g, '');
        }
    }
    for (const name in Memory.spawns) {
        for (const key in Memory.spawns[name]) {
            if (Memory.creeps[name][key] !== "role")
                delete Memory.creeps[name][key];
            else
                Memory.creeps[name][key] = "Core";
        }
    }
    return "Memory Cleared.";
}

global.getNextAction = function(spawnName) {
    console.log("Not implemented yet...")
}

global.getNextBuildAction = function(spawnName) {
    console.log("Not implemented yet...")
}

global.getNextSpawnAction = function(spawnName) {
    let nextCreepFn = global.getNextCreepSpawn;
    if (!nextCreepFn) {
        try {
            nextCreepFn = require('role.spawner.core').getNextCreepSpawn;
        } catch (e) {
            nextCreepFn = require('./role.spawner.core').getNextCreepSpawn;
        }
    }
    const spawn = spawnName ? Game.spawns[spawnName] : Object.values(Game.spawns)[0];
    if (!spawn) {
        return `Spawner ${spawnName || ''} not found.`;
    }

    const next = nextCreepFn(spawn);
    if (next) {
        const cost = `, cost: ${global.calculateBuildCost(next.parts)}`;
        return `Next creep to spawn: ${next.name} with parts [${next.parts}]${cost}`;
    }
    return "All creeps are at target population.";
}

global.calculateBuildCost = function (parts) {
    let totalCost = 0;
    for (const part of parts) {
        totalCost += BODYPART_COST[part];
    }
    return totalCost;
}

global.createForeignHarvester = function (spawn, roomName, x, y) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!roomName || !x || !y) {
        console.log("Arguments missing. Usage: createForeignHarvester(spawn, roomNumber, x, y)");
    }

    if (!spawn.memory.foreignTargets) spawn.memory.foreignTargets = [];
    const newTarget = {
        x: x,
        y: y,
        roomName: roomName
    };
    spawn.memory.foreignTargets.push(newTarget);
    console.log(`Added foreign harvester to ${spawn.name} targetting (${x},${y}) in ${roomName}`)
};

global.removeForeignHarvester = function (spawn, index) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    spawn.memory.foreignTargets = spawn.memory.foreignTargets.filter((_, i) => i !== index);

    const offset = spawn.memory.CreepIndexOffset || 0;
    for (let i = index; i < spawn.memory.foreignTargets.length; i++) {
        const oldName = `ForeignHarvester${i + 1 + offset}`;
        const newName = `ForeignHarvester${i + offset}`;
        if (Game.creeps[oldName]) {
            Game.creeps[oldName].name = newName;
        }
    }
    console.log("Removed foreign harvester target at index " + index + " and updated creep names accordingly.");
};

global.listForeignHarvesters = function () {
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        if (spawn.memory.foreignTargets && spawn.memory.foreignTargets.length > 0) {
            console.log(`Foreign harvester targets for ${spawnName}:`);
            spawn.memory.foreignTargets.forEach((target, index) => {
                console.log(`  [${index}] Room: ${target.roomName}, Coordinates: (${target.x}, ${target.y})`);
            });
        } else {
            console.log(`No foreign harvester targets for ${spawnName}.`);
        }
    }
}

global.createInvasion = function (spawn, roomName, x, y, reason, parts = undefined) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!roomName || !x || !y || !reason) {
        console.log("Arguments missing. Usage: createInvasion(spawn, roomName, x, y, reason, parts)");
        return;
    }

    if (!spawn.memory.invasions) spawn.memory.invasions = [];
    const newInvasion = {
        target: {
            roomName: roomName,
            x: x,
            y: y
        },
        rallyPoint: undefined,
        reason: reason
    };
    if (parts !== undefined) newInvasion.parts = parts;
    spawn.memory.invasions.push(newInvasion);
    console.log(`Added invasion to ${spawn.name} targetting (${x},${y}) in ${roomName} for reason: ${reason}`);
};

global.createRalliedInvasion = function(spawn, targetRoomName, targetX, targetY, rallyRoomName, rallyX, rallyY, rallyCreepCount, reason, parts = undefined) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!targetRoomName || !targetX || !targetY || !rallyRoomName || !rallyX || !rallyY || !rallyCreepCount || !reason) {
        console.log("Arguments missing. Usage: createRalliedInvasion(spawn, targetRoomName, targetX, targetY, rallyRoomName, rallyX, rallyY, rallyCreepCount, reason)");
        return;
    }

    if (!spawn.memory.invasions) spawn.memory.invasions = [];
    const newInvasion = {
        target: {
            roomName: targetRoomName,
            x: targetX,
            y: targetY
        },
        rallyPoint: {
            roomName: rallyRoomName,
            x: rallyX,
            y: rallyY,
            creepCount: rallyCreepCount
        },
        reason: reason
    };
    if (parts !== undefined) newInvasion.parts = parts;
    spawn.memory.invasions.push(newInvasion);
    console.log(`Added rallied invasion to ${spawn.name} targeting (${targetX},${targetY}) in ${targetRoomName} with rally point at (${rallyX},${rallyY}) in ${rallyRoomName} for reason: ${reason}`);
}

global.removeInvasion = function (spawn, index) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!spawn.memory.invasions || index < 0 || index >= spawn.memory.invasions.length) {
        console.log("Invalid index or no invasions found.");
        return;
    }
    spawn.memory.invasions.splice(index, 1);
    for (let i = index; i < spawn.memory.invasions.length; i++) {
        const oldName = `Attacker${i + 1}`;
        const newName = `Attacker${i}`;
        if (Game.creeps[oldName]) {
            Game.creeps[oldName].name = newName;
        }
    }
    console.log(`Removed invasion at index ${index} from ${spawn.name}.`);
}

global.listInvasions = function () {
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        if (spawn.memory.invasions && spawn.memory.invasions.length > 0) {
            console.log(`Invasions for ${spawnName}:`);
            spawn.memory.invasions.forEach((invasion, index) => {
                console.log(`  [${index}] Room: ${invasion.target.roomName} (${invasion.target.x}, ${invasion.target.y}), Reason: ${invasion.reason}`);
            });
        } else {
            console.log(`No invasions for ${spawnName}.`);
        }
    }
}

global.createLooter = function (spawn, roomName, x, y) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!roomName || !x || !y) {
        console.log("Arguments missing. Usage: createLooter(spawn, roomName, x, y)");
        return;
    }

    if (!spawn.memory.looters) spawn.memory.looters = [];
    const newLooter = {
        roomName: roomName,
        x: x,
        y: y
    };
    spawn.memory.looters.push(newLooter);
    console.log(`Added looter to ${spawn.name} targeting (${x}, ${y}) in ${roomName}`);
}

global.removeLooter = function (spawn, index) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!spawn.memory.looters || index < 0 || index >= spawn.memory.looters.length) {
        console.log("Invalid index or no looters found.");
        return;
    }
    spawn.memory.looters.splice(index, 1);
    for (let i = index; i < spawn.memory.looters.length; i++) {
        const oldName = `Looter${i + 1}`;
        const newName = `Looter${i}`;
        if (Game.creeps[oldName]) {
            Game.creeps[oldName].name = newName;
        }
    }
    console.log(`Removed looter at index ${index} from ${spawn.name}.`);
}

global.listLooters = function () {
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        if (spawn.memory.looters && spawn.memory.looters.length > 0) {
            console.log(`Looters for ${spawnName}:`);
            spawn.memory.looters.forEach((looter, index) => {
                console.log(`  [${index}] Room: ${looter.roomName}, Coordinates: (${looter.x}, ${looter.y})`);
            });
        } else {
            console.log(`No looters for ${spawnName}.`);
        }
    }
}

global.createClaimer = function (spawn, roomName) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!roomName) {
        console.log("Arguments missing. Usage: createClaimer(spawn, roomName)");
        return;
    }

    if (!spawn.memory.claimers) spawn.memory.claimers = [];
    const newClaimer = {
        roomName: roomName
    };
    spawn.memory.claimers.push(newClaimer);
    console.log(`Added claimer to ${spawn.name} targeting ${roomName}`);
}

global.removeClaimer = function (spawn, index) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!spawn.memory.claimers || index < 0 || index >= spawn.memory.claimers.length) {
        console.log("Invalid index or no claimers found.");
        return;
    }
    spawn.memory.claimers.splice(index, 1);
    for (let i = index; i < spawn.memory.claimers.length; i++) {
        const oldName = `Claimer${i + 1}`;
        const newName = `Claimer${i}`;
        if (Game.creeps[oldName]) {
            Game.creeps[oldName].name = newName;
        }
    }
    console.log(`Removed claimer at index ${index} from ${spawn.name}.`);
}

global.listClaimers = function () {
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        if (spawn.memory.claimers && spawn.memory.claimers.length > 0) {
            console.log(`Claimers for ${spawnName}:`);
            spawn.memory.claimers.forEach((claimer, index) => {
                console.log(`  [${index}] Room: ${claimer.roomName}`);
            });
        } else {
            console.log(`No claimers for ${spawnName}.`);
        }
    }
}

global.createReserver = function (spawn, roomName) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!roomName) {
        console.log("Arguments missing. Usage: createReserver(spawn, roomName)");
        return;
    }

    if (!spawn.memory.reservers) spawn.memory.reservers = [];
    const newReserver = {
        roomName: roomName
    };
    spawn.memory.reservers.push(newReserver);
    console.log(`Added reserver to ${spawn.name} targeting ${roomName}`);
}

global.removeReserver = function (spawn, index) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!spawn.memory.reservers || index < 0 || index >= spawn.memory.reservers.length) {
        console.log("Invalid index or no reservers found.");
        return;
    }
    spawn.memory.reservers.splice(index, 1);
    for (let i = index; i < spawn.memory.reservers.length; i++) {
        const oldName = `Reserver${i + 1}`;
        const newName = `Reserver${i}`;
        if (Game.creeps[oldName]) {
            Game.creeps[oldName].name = newName;
        }
    }
    console.log(`Removed reserver at index ${index} from ${spawn.name}.`);
}

global.listReservers = function () {
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        if (spawn.memory.reservers && spawn.memory.reservers.length > 0) {
            console.log(`Reservers for ${spawnName}:`);
            spawn.memory.reservers.forEach((reserver, index) => {
                console.log(`  [${index}] Room: ${reserver.roomName}`);
            });
        } else {
            console.log(`No reservers for ${spawnName}.`);
        }
    }
}

global.createTraveller = function (spawn, roomName, x, y, destinationRole, parts) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!roomName || x === undefined || y === undefined || !destinationRole) {
        console.log("Arguments missing. Usage: createTraveller(spawn, roomName, x, y, destinationRole, [parts])");
        return;
    }

    if (!spawn.memory.travellers) spawn.memory.travellers = [];
    const newTraveller = {
        roomName: roomName,
        x: x,
        y: y,
        destinationRole: destinationRole,
        parts: parts
    };
    spawn.memory.travellers.push(newTraveller);
    console.log(`Added traveller target to ${spawn.name} destined for (${x}, ${y}) in ${roomName} as ${destinationRole}.`);
}

global.sendTraveller = function (creepName, roomName, x, y, destinationRole) {
    const creep = Game.creeps[creepName];
    if (!creep) {
        console.log(`Creep ${creepName} not found.`);
        return;
    }
    if (!roomName || x === undefined || y === undefined || !destinationRole) {
        console.log("Arguments missing. Usage: sendTraveller(creepName, roomName, x, y, destinationRole)");
        return;
    }
    creep.memory.role = "Traveller";
    creep.memory.targetRoom = roomName;
    creep.memory.target = { x: x, y: y };
    creep.memory.destinationRole = destinationRole;
    creep.memory.state = "travelling";
    console.log(`Creep ${creepName} dispatched as Traveller to (${x}, ${y}) in ${roomName} to become ${destinationRole}.`);
}

global.removeTraveller = function (spawn, index) {
    if (typeof spawn === 'string') spawn = Game.spawns[spawn];
    if (!spawn) {
        console.log(`Spawner ${spawn} not found.`);
        return;
    }
    if (!spawn.memory.travellers || index < 0 || index >= spawn.memory.travellers.length) {
        console.log("Invalid index or no travellers found.");
        return;
    }
    spawn.memory.travellers.splice(index, 1);
    for (let i = index; i < spawn.memory.travellers.length; i++) {
        const oldName = `Traveller${i + 1}`;
        const newName = `Traveller${i}`;
        if (Game.creeps[oldName]) {
            Game.creeps[oldName].name = newName;
        }
    }
    console.log(`Removed traveller at index ${index} from ${spawn.name}.`);
}

global.listTravellers = function () {
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        if (spawn.memory.travellers && spawn.memory.travellers.length > 0) {
            console.log(`Travellers for ${spawnName}:`);
            spawn.memory.travellers.forEach((traveller, index) => {
                console.log(`  [${index}] Target: (${traveller.x}, ${traveller.y}) in ${traveller.roomName}, Destination Role: ${traveller.destinationRole}`);
            });
        } else {
            console.log(`No travellers for ${spawnName}.`);
        }
    }
}

global.applyNewTargetsToCreeps = function() {
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        if (spawn.memory.foreignTargets) {
            spawn.memory.foreignTargets.forEach((target, index) => {
                const creepName = `ForeignHarvester${index}`;
                const creep = Game.creeps[creepName];
                if (creep) {
                    creep.memory.target = target;
                }
            });
        }
        if (spawn.memory.invasions) {
            spawn.memory.invasions.forEach((invasion, index) => {
                const creepName = `Attacker${index}`;
                const creep = Game.creeps[creepName];
                if (creep) {
                    creep.memory.target = invasion.target;
                    creep.memory.rallyPoint = invasion.rallyPoint;
                }
            });
        }
        if (spawn.memory.looters) {
            spawn.memory.looters.forEach((looter, index) => {
                const creepName = `Looter${index}`;
                const creep = Game.creeps[creepName];
                if (creep) {
                    creep.memory.target = looter.target;
                }
            });
        }
        if (spawn.memory.travellers) {
            spawn.memory.travellers.forEach((traveller, index) => {
                const creepName = `Traveller${index}`;
                const creep = Game.creeps[creepName];
                if (creep) {
                    creep.memory.target = { x: traveller.x, y: traveller.y };
                    creep.memory.targetRoom = traveller.roomName;
                    creep.memory.destinationRole = traveller.destinationRole;
                }
            });
        }
    }
}

global.obliviate = function () {
    RawMemory.set("{}")
    console.log("Memory cleared.");
}

global.restoreDefaultMemory = function() {
    let spawnCounter = 0;
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        spawn.memory.foreignTargets = [];
        spawn.memory.invasions = [];
        spawn.memory.looters = [];
        spawn.memory.claimers = [];
        spawn.memory.travellers = [];
        spawn.memory.role = "Core";
        spawn.memory.targetCreepPopulations = {
            "Harvester": 2,
            "Builder": 2
        }
        spawn.memory.CreepIndexOffset = spawnCounter * 100;
        spawnCounter++;
    }
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        creep.memory.role = creepName.replace(/[0-9]/g, '');
        creep.memory.index = parseInt(creepName.replace(/\D/g, '')) || 0;
    }
}

global.creep = {
    grabFromContainer: function(creepName) {
        const creep = Game.creeps[creepName];
        if (!creep) {
            console.log(`Error: Could not find creep '${creepName}'`);
            return ERR_NOT_FOUND;
        }

        switch (creep.room.name) {
            case "E33N41":
                creep.memory.source = "6aebeb5f5b54413c2debcdb8";
                return OK;
            default:
                console.log(`Error: I don't know about constants for ${creep.room.name}!`)
                return ERR_INVALID_TARGET;
        }
    },
    grabFromSource: function(creepName) {
        const creep = Game.creeps[creepName];
        if (!creep) {
            console.log(`Error: Could not find creep '${creepName}'`);
            return ERR_NOT_FOUND;
        }

        switch (creep.room.name) {
            case "E33N41":
                creep.memory.source = "5bbcaeda9099fc012e639a75";
                return OK;
            default:
                console.log(`Error: I don't know about constants for ${creep.room.name}!`)
                return ERR_INVALID_TARGET;
        }
    },
    grabFromStorage: function(creepName) {
        const creep = Game.creeps[creepName];
        if (!creep) {
            console.log(`Error: Could not find creep '${creepName}'`);
            return ERR_NOT_FOUND;
        }

        creep.memory.source = creep.room.storage.id;
        return OK;
    },
    upgradeController: function(creepName) {
        const creep = Game.creeps[creepName];
        if (!creep) {
            console.log(`Error: Could not find creep '${creepName}'`);
            return ERR_NOT_FOUND;
        }

        if (creep.room.controller) {
            creep.memory.target = creep.room.controller.id;
            return OK;
        }
        return ERR_INVALID_TARGET;
    },
    feedSpawn: function(creepName) {
        const creep = Game.creeps[creepName];
        if (!creep) {
            console.log(`Error: Could not find creep '${creepName}'`);
            return ERR_NOT_FOUND;
        }

        if (!creep.memory.homeSpawner) return ERR_INVALID_ARGS;
        creep.memory.target = creep.memory.homeSpawner;
        return OK;
    },
    help: function() {
        console.log("Creep nudging functions:")
        console.log("- grabFromContainer: Sets the specified creep's source target to the room's Leech's container.")
        console.log("- grabFromSource: Sets the specified creep's source target to the room's least servied Source.")
        console.log("- grabFromStorage: Sets the specified creep's source target to the room's container (if it has one).")
        console.log("- upgradeController: Sets the specified creep's target to the room's controller.")
        console.log("- feedSpawn: Sets the specified creep's target to its own home spawn.")
    }
}

global.test = function() {
    console.log("All structures in E33N41 that are not at full health:");
    const structures = Game.rooms["E33N41"].find(FIND_STRUCTURES, {
        filter: (s) => s.hits !== s.hitsMax
    });
    structures.sort((a, b) => a.hits - b.hits);
    for (const structure of structures) {
        console.log(`- ${structure.structureType} ${structure.id} (${structure.hits}/${structure.hitsMax})`);
    }

    console.log("All important structures in E33N41 that are not at full health:");
    const importantStructures = Game.rooms["E33N41"].find(FIND_STRUCTURES, {
        filter: (s) => s.hits !== s.hitsMax && (s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART)
    });
    importantStructures.sort((a, b) => a.hits - b.hits);
    for (const structure of importantStructures) {
        console.log(`- ${structure.structureType} ${structure.id} (${structure.hits}/${structure.hitsMax})`);
    }

    console.log("All walls and defensive (non-important) structures in E33N41 that are not at full health:");
    const defensiveStructures = Game.rooms["E33N41"].find(FIND_STRUCTURES, {
        filter: (s) => s.hits !== s.hitsMax && (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART)
    });
    defensiveStructures.sort((a, b) => a.hits - b.hits);
    for (const structure of defensiveStructures) {
        console.log(`- ${structure.structureType} ${structure.id} (${structure.hits}/${structure.hitsMax})`);
    }
}

global.help = function (object = undefined) {
    if (object) {
        object.help();
        return;
    }
    console.log("Available global functions:");
    console.log("- hello: Print a greeting message.");
    console.log("- clearMemory: Clear the memory of all creeps and spawns.");
    console.log("- getNextAction: Get the next action to take.");
    console.log("- getNextBuildAction: Get the next build action to take.");
    console.log("- getNextSpawnAction: Get the next spawn action to take.");
    console.log("- calculateBuildCost: Calculate the cost of building a structure with given parts.");
    console.log("- createForeignHarvester: Create a foreign harvester target in spawn.memory.foreignTargets.");
    console.log("- removeForeignHarvester: Remove a foreign harvester target by index and move creep numbers down.");
    console.log("- listForeignHarvesters: List all foreign harvester targets for a given spawn.");
    console.log("- createInvasion: Create a target and reason to create attacker creeps.");
    console.log("- createRalliedInvasion: Create a target, rally point and how many required armies before attacking commences.")
    console.log("- removeInvasion: Remove a target and reason to create attacker creeps.");
    console.log("- listInvasions: List all active invasions");
    console.log("- createLooter: Create a target and reason to create looter creeps.");
    console.log("- removeLooter: Remove a target and reason to create looter creeps.");
    console.log("- listLooters: List all active looters");
    console.log("- createClaimer: Create a target and reason to create claimer creeps.");
    console.log("- removeClaimer: Remove a target and reason to create claimer creeps.");
    console.log("- listClaimers: List all active claimers");
    console.log("- createReserver: Create a target and reason to create reserver creeps.");
    console.log("- removeReserver: Remove a target and reason to create reserver creeps.");
    console.log("- listReservers: List all active reservers");
    console.log("- createTraveller: Create a traveller target in spawn.memory.travellers.");
    console.log("- sendTraveller: Dispatch an existing creep to a room and coordinates as a Traveller.");
    console.log("- removeTraveller: Remove a traveller target by index and move creep numbers down.");
    console.log("- listTravellers: List all active travellers for spawns.");
    console.log("- applyNewTargetsToCreeps: Reapply any edited target data to external creeps.")
    console.log("- obliviate: Clears creep and spawn memory. Repopulates default data if obliviate(true). Otherwise leaves them empty.")
    console.log("- help: Display this help message.");
}
