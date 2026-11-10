/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.leech');
 * mod.thing == 'a thing'; // true
 */

const role = {
    RoleName: "Leech",
    Tick: function (creep) {
        let transferred = false;
        let withdrew = false;

        // Check for adjacent friendly creeps that need energy
        const adjacentCreeps = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
            filter: (c) => c.id !== creep.id && c.memory.role !== "ForeignHarvester" && c.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (adjacentCreeps.length > 0) {
            const recipient = creep.pos.findClosestByPath(adjacentCreeps) || creep.pos.findClosestByRange(adjacentCreeps) || adjacentCreeps[0];
            const neededEnergy = recipient.store.getFreeCapacity(RESOURCE_ENERGY);
            const currentEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY);

            // If leech doesn't have enough energy to fill up the adjacent creep, withdraw from adjacent storage if possible
            if (currentEnergy < neededEnergy) {
                const adjacentStorageWithEnergy = creep.pos.findInRange(FIND_STRUCTURES, 1, {
                    filter: (s) => (
                        (typeof STRUCTURE_CONTAINER !== 'undefined' && s.structureType === STRUCTURE_CONTAINER) ||
                        (typeof STRUCTURE_STORAGE !== 'undefined' && s.structureType === STRUCTURE_STORAGE) ||
                        (typeof STRUCTURE_LINK !== 'undefined' && s.structureType === STRUCTURE_LINK)
                    ) && s.store && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
                });

                if (adjacentStorageWithEnergy.length > 0 && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    const storage = creep.pos.findClosestByPath(adjacentStorageWithEnergy) || creep.pos.findClosestByRange(adjacentStorageWithEnergy) || adjacentStorageWithEnergy[0];
                    const withdrawAmount = Math.min(
                        neededEnergy - currentEnergy,
                        creep.store.getFreeCapacity(RESOURCE_ENERGY),
                        storage.store.getUsedCapacity(RESOURCE_ENERGY)
                    );
                    if (withdrawAmount > 0) {
                        const withdrawRes = creep.withdraw(storage, RESOURCE_ENERGY, withdrawAmount);
                        const okCode = typeof OK !== 'undefined' ? OK : 0;
                        if (withdrawRes === okCode) withdrew = true;
                    }
                }
            }

            // If we didn't withdraw this tick and have energy in store, transfer to the recipient
            if (!withdrew && currentEnergy > 0) {
                const res = creep.transfer(recipient, RESOURCE_ENERGY);
                const okCode = typeof OK !== 'undefined' ? OK : 0;
                if (res === okCode) transferred = true;
            }
        } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            // No adjacent creeps need energy:
            // 1. Fill up adjacent storage first
            const adjacentStorage = creep.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: (s) => (
                    (typeof STRUCTURE_CONTAINER !== 'undefined' && s.structureType === STRUCTURE_CONTAINER) ||
                    (typeof STRUCTURE_STORAGE !== 'undefined' && s.structureType === STRUCTURE_STORAGE) ||
                    (typeof STRUCTURE_LINK !== 'undefined' && s.structureType === STRUCTURE_LINK)
                ) && s.store && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });

            if (adjacentStorage.length > 0) {
                const storage = creep.pos.findClosestByPath(adjacentStorage) || creep.pos.findClosestByRange(adjacentStorage) || adjacentStorage[0];
                const res = creep.transfer(storage, RESOURCE_ENERGY);
                const okCode = typeof OK !== 'undefined' ? OK : 0;
                if (res === okCode) transferred = true;
            } else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                // 2. If storage is full (or not present), drop energy onto ground when full
                const dropRes = creep.drop(RESOURCE_ENERGY);
                const okCode = typeof OK !== 'undefined' ? OK : 0;
                if (dropRes === okCode) transferred = true;
            }
        }

        // Determine target Source (specified or prioritized by fewer free spaces)
        let targetSource = null;
        const targetSourceId = creep.memory.forcedSource || creep.memory.source || creep.memory.targetSource;
        if (targetSourceId) {
            targetSource = Game.getObjectById(targetSourceId);
            const isSource = (typeof Source !== 'undefined' && targetSource instanceof Source) ||
                (targetSource && targetSource.energyCapacity !== undefined && targetSource.structureType === undefined && targetSource.ticksToRegeneration !== undefined);
            if (!isSource) {
                targetSource = null;
                creep.memory.source = null;
                creep.memory.targetSource = null;
            }
        }

        // If target source is depleted, switch to an active source if available
        if (targetSource && targetSource.energy === 0 && !creep.memory.forcedSource) {
            const activeSources = creep.room.find(FIND_SOURCES_ACTIVE);
            if (activeSources.length > 0) {
                targetSource = null;
                creep.memory.source = null;
            }
        }

        if (!targetSource) {
            const activeSources = creep.room.find(FIND_SOURCES_ACTIVE);
            const allSources = creep.room.find(FIND_SOURCES);
            const sourcePool = activeSources.length > 0 ? activeSources : allSources;

            // Prefer a source not already targeted by another living leech
            const assignedSourceIds = Object.values(Game.creeps)
                .filter((c) => c.id !== creep.id && c.memory && c.memory.role === "Leech" && c.memory.source)
                .map((c) => c.memory.source);

            const unassignedSources = sourcePool.filter((s) => !assignedSourceIds.includes(s.id));
            if (unassignedSources.length > 0) {
                targetSource = selectSource(creep, unassignedSources);
            }
            if (!targetSource && sourcePool.length > 0) {
                targetSource = selectSource(creep, sourcePool);
            }
            if (!targetSource && allSources.length > 0) {
                targetSource = selectSource(creep, allSources);
            }
            if (targetSource) {
                creep.memory.source = targetSource.id;
            }
        }

        // Beeline to the source and harvest it
        if (targetSource) {
            if (!creep.pos.isNearTo(targetSource)) {
                // If a non-leech creep is occupying the harvest position adjacent to the source, swap with it
                if (creep.pos.getRangeTo(targetSource) <= 2) {
                    const blockingCreeps = targetSource.pos.findInRange(FIND_MY_CREEPS, 1, {
                        filter: (c) => c.id !== creep.id && c.memory && c.memory.role !== "Leech" && creep.pos.isNearTo(c)
                    });
                    if (blockingCreeps.length > 0) {
                        const blocker = blockingCreeps[0];
                        creep.move(creep.pos.getDirectionTo(blocker));
                        blocker.move(blocker.pos.getDirectionTo(creep));
                    } else {
                        creep.moveTo(targetSource, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                } else {
                    creep.moveTo(targetSource, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else if ((creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 || transferred) && !withdrew) {
                const harvestResult = creep.harvest(targetSource);
                if (harvestResult === ERR_NOT_ENOUGH_RESOURCES && !creep.memory.forcedSource) {
                    const activeSources = creep.room.find(FIND_SOURCES_ACTIVE);
                    if (activeSources.length > 0) {
                        creep.memory.source = null;
                    }
                } else if (harvestResult === ERR_INVALID_TARGET || harvestResult === ERR_NOT_FOUND) {
                    creep.memory.source = null;
                }
            }
        }
    },
    GetFreeSpaces: getFreeSpaces,
    SelectSource: selectSource
};

function getFreeSpaces(source) {
    if (source._freeSpaces !== undefined) {
        return source._freeSpaces;
    }
    const room = source.room || (source.pos && Game.rooms[source.pos.roomName]);
    if (!room) return 0;

    const terrain = room.getTerrain();
    const wallMask = typeof TERRAIN_MASK_WALL !== 'undefined' ? TERRAIN_MASK_WALL : 1;
    let freeCount = 0;

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const x = source.pos.x + dx;
            const y = source.pos.y + dy;
            if (x < 0 || x > 49 || y < 0 || y > 49) continue;

            if ((terrain.get(x, y) & wallMask) !== 0) continue;

            if (typeof LOOK_STRUCTURES !== 'undefined') {
                const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
                if (structures && structures.length > 0) {
                    const isBlocked = structures.some((s) => {
                        const type = s.structureType;
                        if (typeof STRUCTURE_CONTAINER !== 'undefined' && type === STRUCTURE_CONTAINER) return false;
                        if (typeof STRUCTURE_ROAD !== 'undefined' && type === STRUCTURE_ROAD) return false;
                        if (typeof STRUCTURE_RAMPART !== 'undefined' && type === STRUCTURE_RAMPART && (s.my || s.isPublic)) return false;
                        return true;
                    });
                    if (isBlocked) continue;
                }
            }

            freeCount++;
        }
    }

    source._freeSpaces = freeCount;
    return freeCount;
}

function selectSource(creep, candidateSources) {
    if (!candidateSources || candidateSources.length === 0) {
        return null;
    }
    if (candidateSources.length === 1) {
        return candidateSources[0];
    }

    const sourceStats = candidateSources.map((source) => ({
        source: source,
        freeSpaces: getFreeSpaces(source)
    }));

    // Filter out sources that have 0 accessible spaces if any accessible sources exist
    const accessibleSources = sourceStats.filter((item) => item.freeSpaces > 0);
    const pool = accessibleSources.length > 0 ? accessibleSources : sourceStats;

    const minSpaces = Math.min(...pool.map((item) => item.freeSpaces));
    const bestSources = pool
        .filter((item) => item.freeSpaces === minSpaces)
        .map((item) => item.source);

    if (bestSources.length === 1) {
        return bestSources[0];
    }

    return creep.pos.findClosestByPath(bestSources) || creep.pos.findClosestByRange(bestSources) || bestSources[0];
}

module.exports = role;
