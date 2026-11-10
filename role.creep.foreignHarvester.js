/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.foreignHarvester');
 * mod.thing == 'a thing'; // true
 */

const CREEP_TIMER_DEFAULT = 15;

const ERR_NOT_IN_RANGE_CODE = typeof ERR_NOT_IN_RANGE !== 'undefined' ? ERR_NOT_IN_RANGE : -9;
const ERR_NOT_FOUND_CODE = typeof ERR_NOT_FOUND !== 'undefined' ? ERR_NOT_FOUND : -5;
const ERR_INVALID_TARGET_CODE = typeof ERR_INVALID_TARGET !== 'undefined' ? ERR_INVALID_TARGET : -7;
const ERR_FULL_CODE = typeof ERR_FULL !== 'undefined' ? ERR_FULL : -8;
const ERR_NO_PATH_CODE = typeof ERR_NO_PATH !== 'undefined' ? ERR_NO_PATH : -2;
const RESOURCE_ENERGY_TYPE = typeof RESOURCE_ENERGY !== 'undefined' ? RESOURCE_ENERGY : 'energy';
const STRUCTURE_CONTAINER_TYPE = typeof STRUCTURE_CONTAINER !== 'undefined' ? STRUCTURE_CONTAINER : 'container';
const FIND_STRUCTURES_TYPE = typeof FIND_STRUCTURES !== 'undefined' ? FIND_STRUCTURES : 107;

const role = {
    RoleName: "ForeignHarvester",
    Tick: function(creep) {
        // Toggle between feeding and harvesting state.
        const inventory = creep.store.getUsedCapacity(RESOURCE_ENERGY_TYPE);
        const freeCapacity = creep.store.getFreeCapacity(RESOURCE_ENERGY_TYPE);
        if (freeCapacity === 0) {
            creep.memory.state = "feeding";
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
            const homeRoom = getHomeRoom(creep);
            if (homeRoom && creep.room.name !== homeRoom) {
                // Return to home room
                let homeTarget = null;
                if (Game.rooms[homeRoom]) {
                    const containers = Game.rooms[homeRoom].find(FIND_STRUCTURES_TYPE, {
                        filter: (s) => s.structureType === STRUCTURE_CONTAINER_TYPE && s.store && s.store.getFreeCapacity(RESOURCE_ENERGY_TYPE) > 0
                    });
                    if (containers.length > 0) {
                        homeTarget = containers[0];
                    } else if (Game.rooms[homeRoom].storage) {
                        homeTarget = Game.rooms[homeRoom].storage;
                    } else {
                        const spawns = Game.rooms[homeRoom].find(FIND_MY_SPAWNS);
                        if (spawns.length > 0) homeTarget = spawns[0];
                    }
                }
                if (!homeTarget) homeTarget = new RoomPosition(25, 25, homeRoom);
                creep.moveTo(homeTarget, { visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }

            // In home room: deliver to Storage, Spawner, Extension, Tower in priority order.
            let deliveryTarget = null;
            if (creep.memory.target && typeof Game !== 'undefined') {
                deliveryTarget = Game.getObjectById(creep.memory.target);
            }
            if (deliveryTarget && deliveryTarget.store && deliveryTarget.store.getFreeCapacity(RESOURCE_ENERGY_TYPE) === 0) {
                deliveryTarget = null;
                creep.memory.target = null;
            }
            if (!deliveryTarget) {
                deliveryTarget = findDeliveryTarget(creep);
                creep.memory.target = deliveryTarget ? deliveryTarget.id : null;
            }

            if (deliveryTarget) {
                const result = creep.transfer(deliveryTarget, RESOURCE_ENERGY_TYPE);
                if (result === ERR_NOT_IN_RANGE_CODE) {
                    creep.moveTo(deliveryTarget, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (result === ERR_NOT_FOUND_CODE || result === ERR_INVALID_TARGET_CODE || result === ERR_FULL_CODE) {
                    creep.memory.target = null;
                }
            } else {
                // If all are full, stay put until storage room opens up.
                // If on an exit border tile, step inside so room transitions do not loop.
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    creep.moveTo(25, 25);
                }
            }
        }

        if (harvesting) {
            const targetPos = getSourcePosition(creep);
            if (!targetPos) {
                console.log(`ForeignHarvester ${creep.name} has no source coordinates assigned.`);
                return;
            }

            if (creep.room.name !== targetPos.roomName) {
                creep.moveTo(targetPos, { visualizePathStyle: { stroke: '#ffaa00' } });
                return;
            }

            let harvestSource = null;
            if (creep.memory.sourceId && typeof Game !== 'undefined') {
                harvestSource = Game.getObjectById(creep.memory.sourceId);
            }

            if (!harvestSource) {
                let sourcesAtPos = creep.room.lookForAt(LOOK_SOURCES, targetPos.x, targetPos.y);
                if (sourcesAtPos && sourcesAtPos.length > 0) {
                    harvestSource = sourcesAtPos[0];
                } else {
                    const nearbySources = targetPos.findInRange(FIND_SOURCES, 1);
                    if (nearbySources && nearbySources.length > 0) {
                        harvestSource = nearbySources[0];
                    } else {
                        harvestSource = targetPos.findClosestByRange(FIND_SOURCES) || creep.pos.findClosestByRange(FIND_SOURCES);
                    }
                }
                if (harvestSource) {
                    creep.memory.sourceId = harvestSource.id;
                }
            }

            if (harvestSource) {
                const harvestResult = creep.harvest(harvestSource);
                if (harvestResult === ERR_NOT_IN_RANGE_CODE) {
                    const moveResult = creep.moveTo(harvestSource, { visualizePathStyle: { stroke: '#ffaa00' } });
                    if (moveResult === ERR_NO_PATH_CODE) creep.memory.sourceId = null;
                } else if (harvestResult === ERR_NOT_FOUND_CODE || harvestResult === ERR_INVALID_TARGET_CODE) {
                    creep.memory.sourceId = null;
                }
            } else {
                creep.moveTo(targetPos, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    },
    GetSourcePosition: getSourcePosition,
    FindDeliveryTarget: findDeliveryTarget,
    GetHomeRoom: getHomeRoom
};

function getHomeRoom(creep) {
    if (!creep || !creep.memory) return creep && creep.room ? creep.room.name : null;
    if (creep.memory.homeRoom) return creep.memory.homeRoom;
    if (creep.memory.home) return creep.memory.home;
    if (creep.memory.homeSpawner) {
        const spawn = (typeof Game !== 'undefined' && Game.spawns && Game.spawns[creep.memory.homeSpawner])
            || (typeof Game !== 'undefined' && Game.getObjectById(creep.memory.homeSpawner));
        if (spawn && spawn.room) return spawn.room.name;
    }
    if (typeof Game !== 'undefined' && Game.spawns) {
        const anySpawn = Object.values(Game.spawns)[0];
        if (anySpawn && anySpawn.room) return anySpawn.room.name;
    }
    return creep.room ? creep.room.name : null;
}

function getSourcePosition(creep) {
    if (!creep || !creep.memory) return null;

    if (creep.memory.sourcePos instanceof RoomPosition) {
        return creep.memory.sourcePos;
    }

    const posCandidates = [
        creep.memory.sourcePos,
        creep.memory.targetSourcePos,
        creep.memory.targetPos,
        creep.memory.source,
        creep.memory.targetSource,
        creep.memory.forcedSource
    ];

    for (const cand of posCandidates) {
        if (cand && typeof cand === 'object') {
            const x = cand.x !== undefined ? cand.x : cand[0];
            const y = cand.y !== undefined ? cand.y : cand[1];
            const room = cand.roomName || cand.room || cand.roomNumber;
            if (typeof x === 'number' && typeof y === 'number' && room) {
                return new RoomPosition(x, y, String(room));
            }
        }
    }

    const room = creep.memory.sourceRoom || creep.memory.targetRoom || creep.memory.roomNumber || creep.memory.room;
    let x = creep.memory.sourceX !== undefined ? creep.memory.sourceX : (creep.memory.targetX !== undefined ? creep.memory.targetX : creep.memory.x);
    let y = creep.memory.sourceY !== undefined ? creep.memory.sourceY : (creep.memory.targetY !== undefined ? creep.memory.targetY : creep.memory.y);

    const coords = creep.memory.coordinates || creep.memory.coords || creep.memory.sourceCoordinates || creep.memory.sourceCoords;
    if (coords) {
        if (Array.isArray(coords) && coords.length >= 2) {
            x = coords[0];
            y = coords[1];
        } else if (typeof coords === 'object') {
            if (coords.x !== undefined) x = coords.x;
            if (coords.y !== undefined) y = coords.y;
        }
    }

    if (room && x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
        return new RoomPosition(Number(x), Number(y), String(room));
    }

    if (typeof creep.memory.source === 'string') {
        const parts = creep.memory.source.split(/[,:\s]+/).filter(Boolean);
        if (parts.length === 3) {
            if (!isNaN(parts[0]) && !isNaN(parts[1])) {
                return new RoomPosition(Number(parts[0]), Number(parts[1]), parts[2]);
            } else if (!isNaN(parts[1]) && !isNaN(parts[2])) {
                return new RoomPosition(Number(parts[1]), Number(parts[2]), parts[0]);
            }
        }
    }

    return null;
}

function findDeliveryTarget(creep) {
    if (!creep || !creep.room) return null;

    // 1. Container
    const container = creep.pos.findClosestByPath(FIND_STRUCTURES_TYPE, {
        filter: (structure) =>
            structure.structureType === STRUCTURE_CONTAINER_TYPE &&
            structure.store &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY_TYPE) > 0
    }) || creep.pos.findClosestByRange(FIND_STRUCTURES_TYPE, {
        filter: (structure) =>
            structure.structureType === STRUCTURE_CONTAINER_TYPE &&
            structure.store &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY_TYPE) > 0
    });
    if (container) return container;

    // 2. Storage
    if (creep.room.storage && creep.room.storage.store && creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY_TYPE) > 0) {
        return creep.room.storage;
    }
    const storage = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (structure) =>
            structure.structureType === STRUCTURE_STORAGE &&
            structure.store &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY_TYPE) > 0
    });
    if (storage) return storage;

    // 3. Spawner
    const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, {
        filter: (structure) =>
            structure.store &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY_TYPE) > 0
    });
    if (spawn) return spawn;

    // 4. Extension
    const extension = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (structure) =>
            structure.structureType === STRUCTURE_EXTENSION &&
            structure.store &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY_TYPE) > 0
    });
    if (extension) return extension;

    // 5. Tower
    const tower = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
        filter: (structure) =>
            structure.structureType === STRUCTURE_TOWER &&
            structure.store &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY_TYPE) > 0
    });
    if (tower) return tower;

    return null;
}

module.exports = role;
