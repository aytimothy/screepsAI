/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.builder');
 * mod.thing == 'a thing'; // true
 */

const role = {
    RoleName: "Builder",
    Tick: function(creep) {
        // Toggle between feeding and harvesting state.
        const inventory = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        const freeCapacity = creep.store.getFreeCapacity(RESOURCE_ENERGY);

        if (!creep.memory.state) creep.memory.state = "harvesting";

        if (freeCapacity === 0 && creep.memory.state !== "constructing") {
            creep.memory.state = "constructing";
            creep.memory.source = (creep.memory.forcedSource) ? creep.memory.forcedSource : null;
            creep.memory.target = (creep.memory.forcedTarget) ? creep.memory.forcedTarget : null;
        }
        if (inventory === 0 && creep.memory.state !== "harvesting") {
            creep.memory.state = "harvesting";
            creep.memory.target = (creep.memory.forcedTarget) ? creep.memory.forcedTarget : null;
            creep.memory.source = (creep.memory.forcedSource) ? creep.memory.forcedSource : null;
        }

        const buildingOrRepairing = creep.memory.state === "constructing";
        const harvesting = creep.memory.state === "harvesting";

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
                        const moveResult = creep.moveTo(harvestSource, {visualizePathStyle: {stroke: '#ffffff'}});
                        if (moveResult === ERR_NO_PATH) creep.memory.source = null;
                    }
                } else if (harvestSource instanceof Source) {
                    const harvestResult = creep.harvest(harvestSource);
                    if (harvestResult === ERR_NOT_IN_RANGE) creep.moveTo(harvestSource, {visualizePathStyle: {stroke: '#ffffff'}});
                    if (harvestResult === ERR_INVALID_TARGET || harvestResult === ERR_NOT_FOUND) {
                        creep.memory.source = null;
                    }
                } else if (harvestSource instanceof StructureStorage) {
                    const withdrawResult = creep.withdraw(harvestSource, RESOURCE_ENERGY);
                    if (withdrawResult === ERR_NOT_IN_RANGE) creep.moveTo(harvestSource, {visualizePathStyle: {stroke: '#ffffff'}});
                    if (withdrawResult === ERR_INVALID_TARGET || withdrawResult === ERR_NOT_FOUND || withdrawResult === ERR_NOT_ENOUGH_RESOURCES) {
                        creep.memory.source = null;
                    }
                } else {
                    const pickupResult = creep.pickup(harvestSource);
                    if (pickupResult === ERR_NOT_IN_RANGE) creep.moveTo(harvestSource, {visualizePathStyle: {stroke: '#ffffff'}});
                    if (pickupResult === ERR_INVALID_TARGET || pickupResult === ERR_NOT_FOUND) creep.memory.source = null;
                }
            }
        }
        const repairOnly = creep.memory.repairOnly === true;
        if (buildingOrRepairing) {
            let constructionTarget;
            if (creep.memory.target) constructionTarget = Game.getObjectById(creep.memory.target);

            // Invalidate target if completed/destroyed or if repairOnly creep has a construction site
            if (constructionTarget) {
                if (repairOnly && constructionTarget instanceof ConstructionSite) {
                    constructionTarget = null;
                    creep.memory.target = undefined;
                } else if (constructionTarget instanceof Structure && constructionTarget.hits >= constructionTarget.hitsMax) {
                    constructionTarget = null;
                    creep.memory.target = undefined;
                }
            }

            if (!constructionTarget) {
                if (!repairOnly) {
                    constructionTarget = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES) || creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                }
                if (!constructionTarget) {
                    constructionTarget = findRepairTarget(creep);
                }
                if (constructionTarget) creep.memory.target = constructionTarget.id;
                else creep.memory.target = undefined;
            }

            if (constructionTarget) {
                if (constructionTarget instanceof ConstructionSite) {
                    const buildResult = creep.build(constructionTarget);
                    if (buildResult === ERR_NOT_IN_RANGE) creep.moveTo(constructionTarget, {visualizePathStyle: {stroke: '#ffffff'}});
                    if (buildResult === ERR_NOT_FOUND || buildResult === ERR_INVALID_TARGET) creep.memory.target = null;
                    if (buildResult === ERR_NOT_ENOUGH_RESOURCES) {
                        creep.memory.target = (creep.memory.forcedTarget) ? creep.memory.forcedTarget : null;
                        creep.memory.state = "harvesting";
                    }
                } else {
                    const repairResult = creep.repair(constructionTarget);
                    if (repairResult === ERR_NOT_IN_RANGE) creep.moveTo(constructionTarget, {visualizePathStyle: {stroke: '#ffffff'}});
                    if (repairResult === ERR_NOT_FOUND || repairResult === ERR_INVALID_TARGET || constructionTarget.hits >= constructionTarget.hitsMax) {
                        creep.memory.target = undefined;
                    }
                    if (repairResult === ERR_NOT_ENOUGH_RESOURCES) {
                        creep.memory.target = (creep.memory.forcedTarget) ? creep.memory.forcedTarget : null;
                        creep.memory.state = "harvesting";
                    }
                }
            }
        }
    }
}

function findRepairTarget(creep) {
    const damagedStructures = creep.room.find(FIND_STRUCTURES, {
        filter: (s) => s.hits < s.hitsMax
    });
    if (damagedStructures.length === 0) return null;

    const onlyImportantStuff = creep.memory.onlyImportantStuff === true;
    if (onlyImportantStuff) {
        // 1. Everything other than walls and ramparts
        const important = damagedStructures.filter(
            (s) => s.structureType !== STRUCTURE_WALL && s.structureType !== STRUCTURE_RAMPART
        );
        if (important.length > 0) {
            important.sort((a, b) => (a.hits !== b.hits ? a.hits - b.hits : creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b)));
            return important[0];
        }

        // 2. If there is nothing to repair, all non-full ramparts
        const ramparts = damagedStructures.filter((s) => s.structureType === STRUCTURE_RAMPART);
        if (ramparts.length > 0) {
            ramparts.sort((a, b) => (a.hits !== b.hits ? a.hits - b.hits : creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b)));
            return ramparts[0];
        }

        // 3. Followed by walls
        const walls = damagedStructures.filter((s) => s.structureType === STRUCTURE_WALL);
        if (walls.length > 0) {
            walls.sort((a, b) => (a.hits !== b.hits ? a.hits - b.hits : creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b)));
            return walls[0];
        }

        return null;
    }

    // Default: repair structures sorted by their absolute health that isn't full health
    damagedStructures.sort((a, b) => {
        if (a.hits !== b.hits) {
            return a.hits - b.hits;
        }
        return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
    });

    return damagedStructures[0];
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
