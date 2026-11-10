/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.harvester');
 * mod.thing == 'a thing'; // true
 */

const CREEP_TIMER_DEFAULT = 15;

const role = {
    RoleName: "Harvester",
    Tick: function(creep) {
        let creepTimerTrigger = false;
        if (creep.memory.checkTimer === undefined) creep.memory.checkTimer = CREEP_TIMER_DEFAULT;
        if (creep.memory.checkTimer <= 0) {
            creep.memory.checkTimer = CREEP_TIMER_DEFAULT;
            creepTimerTrigger = true;
        }
        creep.memory.checkTimer--;

        // Toggle between feeding and harvesting state.
        const inventory = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        const freeCapacity = creep.store.getFreeCapacity(RESOURCE_ENERGY);
        if (freeCapacity === 0) {
            creep.memory.state = "feeding";
            creep.memory.source = (creep.memory.forcedSource) ? creep.memory.forcedSource : null;
        }
        if (inventory === 0) {
            creep.memory.state = "harvesting";
            creep.memory.target = (creep.memory.forcedTarget) ? creep.memory.forcedTarget : null;
        }

        // Perform state machine.
        if (!creep.memory.state) creep.memory.state = "harvesting";
        const delivering = creep.memory.state === "feeding";
        const harvesting = creep.memory.state === "harvesting";
        if (delivering) {
            let deliveryTarget;
            if (creep.memory.target) deliveryTarget = Game.getObjectById(creep.memory.target);
            if (!deliveryTarget) {
                deliveryTarget = findDeliveryTarget(creep);
                creep.memory.target = deliveryTarget ? deliveryTarget.id : null;
            }
            if (creepTimerTrigger && creep.memory.prioritizeController) {
                // If the spawner isn't full, change target to it.
                const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, {
                    filter: (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                });
                if (spawn) {
                    deliveryTarget = spawn;
                    creep.memory.target = spawn.id;
                }
            }
            if (deliveryTarget) {
                const isController = deliveryTarget === creep.room.controller;
                const result = isController
                    ? creep.upgradeController(deliveryTarget)
                    : creep.transfer(deliveryTarget, RESOURCE_ENERGY);

                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(deliveryTarget, { visualizePathStyle: { stroke: '#ffffff'}});
                } else if (result === ERR_NOT_FOUND || result === ERR_INVALID_TARGET || result === ERR_FULL) {
                    creep.memory.target = null;
                }
            }
        }
        if (harvesting) {
            let harvestSource;
            if (creep.memory.source) harvestSource = Game.getObjectById(creep.memory.source);
            if (!harvestSource) {
                // 1. Pick up dropped energy first to avoid decay
                harvestSource = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                    filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 0
                });
                if (!harvestSource) {
                    harvestSource = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                        filter: (tombstone) => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0
                    });
                }
                // Then look for any containers that are full.
                if (!harvestSource) {
                    harvestSource = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                        filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) === 0
                    });
                }
                // 4. Fallback to any active source
                if (!harvestSource) {
                    harvestSource = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                }
                // 2. Prioritize leeches that have energy
                if (!harvestSource) {
                    harvestSource = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
                        filter: (c) => c.memory && c.memory.role === "Leech" && leechHasEnergy(c)
                    });
                }
                // 3. If leeches are empty/unavailable, pathfind to next available active source to mine directly
                if (!harvestSource) {
                    const assignedLeechSources = Object.values(Game.creeps)
                        .filter((c) => c.memory && c.memory.role === "Leech" && c.memory.source)
                        .map((c) => c.memory.source);
                    harvestSource = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE, {
                        filter: (s) => !assignedLeechSources.includes(s.id)
                    });
                }
                // 5. Fallback to any source (even if regenerating)
                if (!harvestSource) {
                    harvestSource = creep.pos.findClosestByPath(FIND_SOURCES);
                }
                if (harvestSource) creep.memory.source = harvestSource.id;
                else creep.memory.source = null;
            }

            if (harvestSource) {
                if (harvestSource instanceof Creep || (harvestSource.body && harvestSource.memory && harvestSource.memory.role === "Leech")) {
                    if (!leechHasEnergy(harvestSource)) {
                        creep.memory.source = null;
                    } else if (!creep.pos.isNearTo(harvestSource)) {
                        const moveResult = creep.moveTo(harvestSource, { visualizePathStyle: { stroke: '#ffffff'}});
                        if (moveResult === ERR_NO_PATH) creep.memory.source = null;
                    }
                } else if (harvestSource.resourceType) {
                    const pickupResult = creep.pickup(harvestSource);
                    if (pickupResult === ERR_NOT_IN_RANGE) creep.moveTo(harvestSource, { visualizePathStyle: { stroke: '#ffffff'}});
                    else if (pickupResult === ERR_NOT_FOUND || pickupResult === ERR_INVALID_TARGET) creep.memory.source = null;
                } else if (harvestSource.deathTime !== undefined || (typeof StructureTombstone !== 'undefined' && harvestSource instanceof StructureTombstone)) {
                    const withdrawResult = creep.withdraw(harvestSource, RESOURCE_ENERGY);
                    if (withdrawResult === ERR_NOT_IN_RANGE) creep.moveTo(harvestSource, { visualizePathStyle: { stroke: '#ffffff'}});
                    else if (withdrawResult === ERR_NOT_FOUND || withdrawResult === ERR_INVALID_TARGET || withdrawResult === ERR_NOT_ENOUGH_RESOURCES) creep.memory.source = null;
                } else if (harvestSource instanceof StructureStorage) {
                    const withdrawResult = creep.withdraw(harvestSource, RESOURCE_ENERGY);
                    if (withdrawResult === ERR_NOT_IN_RANGE) creep.moveTo(harvestSource, {visualizePathStyle: {stroke: '#ffffff'}});
                    if (withdrawResult === ERR_INVALID_TARGET || withdrawResult === ERR_NOT_FOUND || withdrawResult === ERR_NOT_ENOUGH_RESOURCES) {
                        creep.memory.source = null;
                    }
                } else {
                    const harvestResult = creep.harvest(harvestSource);
                    if (harvestResult === ERR_NOT_IN_RANGE) {
                        const moveResult = creep.moveTo(harvestSource, { visualizePathStyle: { stroke: '#ffffff'}});
                        if (moveResult === ERR_NO_PATH) creep.memory.source = null;
                    } else if (harvestResult === ERR_NOT_FOUND || harvestResult === ERR_INVALID_TARGET) {
                        creep.memory.source = null;
                    }
                }
            }
        }
    }
}

function findDeliveryTarget(creep) {
    const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, {
        filter: (structure) => structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (spawn) return spawn;

    if (creep.memory.prioritizeController && creep.room.controller) return creep.room.controller;

    const extension = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (structure) =>
            structure.structureType === STRUCTURE_EXTENSION &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (extension) return extension;

    const tower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (structure) =>
            structure.structureType === STRUCTURE_TOWER &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (tower) return tower;

    const storage = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (structure) =>
            structure.structureType === STRUCTURE_STORAGE &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (storage) return storage;

    return creep.room.controller;
}

function leechHasEnergy(leech) {
    if (!leech || !leech.store) return false;
    if (leech.store.getUsedCapacity(RESOURCE_ENERGY) > 0) return true;
    const storageWithEnergy = leech.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: (s) => (
            (typeof STRUCTURE_CONTAINER !== 'undefined' && s.structureType === STRUCTURE_CONTAINER) ||
            (typeof STRUCTURE_STORAGE !== 'undefined' && s.structureType === STRUCTURE_STORAGE) ||
            (typeof STRUCTURE_LINK !== 'undefined' && s.structureType === STRUCTURE_LINK)
        ) && s.store && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    return storageWithEnergy.length > 0;
}

module.exports = role;
