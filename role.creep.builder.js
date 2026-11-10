/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.harvester');
 * mod.thing == 'a thing'; // true
 */

const workerController = require('role.creep.worker');

module.exports = {
    RoleName: "Builder",
    Tick: function(creep) {
        const OnDeliveryRoundComplete = function(creep) {
            creep.memory.lastTarget = creep.memory.target;
            creep.memory.target = null;

            creep.memory.source = creep.memory.forcedSource || getNextHarvestTarget(creep);
            return creep.memory.source;
        }

        const OnHarvestRoundComplete = function(creep) {
            creep.memory.lastSource = creep.memory.source;
            creep.memory.source = null;

            // creep.memory.target = creep.memory.forcedTarget || (creep.name === "Traveller0") ? getNextDeliveryTarget(creep) : getNextDeliveryTarget2(creep);
            creep.memory.target = creep.memory.forcedTarget || getNextDeliveryTarget2(creep);
            // if (creep.name === "Traveller0") console.log(`[${creep.name}] OnHarvestRoundComplete: ${creep.memory.target}`);
            return creep.memory.target;
        }

        if (creep.memory.state === "repairing") creep.memory.state = "feeding";
        if (creep.memory.state === "constructing") creep.memory.state = "feeding";
        creep.memory.structureAction = "repair";

        workerController.RunWorkerTick(creep, OnDeliveryRoundComplete, OnHarvestRoundComplete)
        // if (creep.name === "Traveller0") console.log(`[${creep.name}] Builder Tick: ${creep.memory.state} -> ${(creep.memory.state === 'feeding') ? creep.memory.target : creep.memory.source}`);
    },
    GetNextHarvestTarget: getNextHarvestTarget,
    GetNextDeliveryTarget: getNextDeliveryTarget
};

function getNextHarvestTarget(creep) {
    const closestDroppedResource = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: (s) => s.resourceType === RESOURCE_ENERGY && s.amount > 0
    });
    if (closestDroppedResource) return closestDroppedResource.id;

    if (creep.memory.takeFromStorage) {
        const closestStorage = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_STORAGE && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        });
        if (closestStorage) return closestStorage.id;
    }
    if (creep.memory.takeFromContainer) {
        const closestContainer = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        });
        if (closestContainer) return closestContainer.id;
    }

    const closestRuin = creep.pos.findClosestByPath(FIND_RUINS, {
        filter: (s) => s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (closestRuin) return closestRuin.id;

    const closestTombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
        filter: (s) => s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (closestTombstone) return closestTombstone.id;

    const closestContainer = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (s) => (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) && s.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    });
    if (closestContainer) return closestContainer.id;

    const closestSource = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    if (closestSource) return closestSource.id;

    const closestLeech = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
        filter: (s) => s.memory.role === "Leech" && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (closestLeech) return closestLeech.id;

    const closestAnySource = creep.pos.findClosestByPath(FIND_SOURCES);
    if (closestAnySource) return closestAnySource.id;
    return null;
}

function getNextDeliveryTarget(creep) {
    const prioritizeRepair = creep.memory.priortizeRepair || creep.memory.repairOnly || false;
    const onlyImportantStuff = creep.memory.onlyImportantStuff || false;
    const ignoreImportantStuff = creep.memory.ignoreImportantStuff || false;

    if (prioritizeRepair) {
        const repairTargets = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits !== s.hitsMax && ((s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART && onlyImportantStuff) || ((s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && ignoreImportantStuff)) && s.pos.x !== creep.pos.x && s.pos.y !== creep.pos.y
        });
        repairTargets.sort((a, b) => b.hits - a.hits);
        console.log(`[${creep.name}] Repair targets:`);
        console.log(`prioritizeRepair: ${prioritizeRepair}, onlyImportantStuff: ${onlyImportantStuff}, ignoreImportantStuff: ${ignoreImportantStuff}`);
        for (const target of repairTargets) {
            console.log(`- ${target.structureType} ${target.id} (${target.hits}/${target.hitsMax})`);
        }
        if (repairTargets.length === 1) return repairTargets[0].id;
        if (repairTargets.length > 1) {
            return (repairTargets[0].hits > repairTargets[repairTargets.length - 1].hits) ? repairTargets[repairTargets.length - 1].id : repairTargets[0].id;
        }
    }
    else {
        const closestWorksite = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {
            filter: (s) => s.pos.x !== creep.pos.x && s.pos.y !== creep.pos.y
        });
        if (closestWorksite) return closestWorksite.id;
    }

    if (prioritizeRepair) {
        const closestWorksite = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, {
            filter: (s) => s.pos.x !== creep.pos.x && s.pos.y !== creep.pos.y
        });
        if (closestWorksite) return closestWorksite.id;
    }
    else {
        const repairTargets = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits !== s.hitsMax &&
                ((s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART && onlyImportantStuff) || ((s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && ignoreImportantStuff)) && s.pos.x !== creep.pos.x && s.pos.y !== creep.pos.y
        });
        repairTargets.sort((a, b) => b.hits - a.hits);
        if (repairTargets.length === 1) return repairTargets[0].id;
        if (repairTargets.length > 1) {
            return (repairTargets[0].hits > repairTargets[repairTargets.length - 1].hits) ? repairTargets[repairTargets.length - 1].id : repairTargets[0].id;
        }
    }

    if (creep.room.name !== creep.memory.homeRoom) {
        const closestConstructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if (closestConstructionSite) return closestConstructionSite.id;
    }
    const closestAnythingElse = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (s) => s.hits < s.hitsMax,
    });
    if (closestAnythingElse) return closestAnythingElse.id;
    if (creep.room.controller) return creep.room.controller.id;
    return null;
 }

 function getNextDeliveryTarget2(creep) {
     const prioritizeRepair = creep.memory.priortizeRepair || creep.memory.repairOnly || false;

    const allStructures = creep.room.find(FIND_STRUCTURES, {
        filter: (s) => s.hits !== s.hitsMax
    });
    allStructures.sort((a, b) => a.hits - b.hits)

    const allConstructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
    const closestWorksite = creep.pos.findClosestByPath(allConstructionSites);

    if (prioritizeRepair && allStructures.length > 0) return allStructures[0].id;
    return closestWorksite ? closestWorksite.id : (allStructures.length > 0 ? allStructures[0].id : null);
 }
