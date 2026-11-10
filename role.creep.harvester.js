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
    RoleName: "Harvester",
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

            creep.memory.target = creep.memory.forcedTarget || getNextDeliveryTarget(creep);
            return creep.memory.target;
        }

        creep.memory.structureAction = "transfer";

        workerController.RunWorkerTick(creep, OnDeliveryRoundComplete, OnHarvestRoundComplete)
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
    const closestSpawnRelatedThing = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (s) => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (closestSpawnRelatedThing) {
        if (closestSpawnRelatedThing.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.name === "Harvester1") {
            // console.log(`[${creep.name}] getNextDeliveryTarget:92 creep.pos.findClosestByPath returned a full structure with no free capacity. This is likely a bug in the Screeps engine.`);
            const nextAvailableThingByIndexThatHasFreeCapacity = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION
            });
            if (nextAvailableThingByIndexThatHasFreeCapacity.length > 0) {
                for (const thing of nextAvailableThingByIndexThatHasFreeCapacity) {
                    if (thing.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        return thing.id;
                    }
                }
            }
        } else {
            return closestSpawnRelatedThing.id;
        }
    }

    if (creep.memory.priortizeController) return creep.room.controller.id;

    const closestTower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (closestTower) return closestTower.id;

    const closestContainer = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (s) => (s.structureType === STRUCTURE_CONTAINER) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (closestContainer) return closestContainer.id;

    if (creep.room.controller) return creep.room.controller.id;

    const closestStorage = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (s) => (s.structureType === STRUCTURE_STORAGE) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    if (closestStorage) return closestStorage.id;
    return null;
}
