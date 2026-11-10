/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.looter');
 * mod.thing == 'a thing'; // true
 */

const CREEP_TIMER_DEFAULT = 15;

const ERR_NOT_IN_RANGE_CODE = typeof ERR_NOT_IN_RANGE !== 'undefined' ? ERR_NOT_IN_RANGE : -9;
const ERR_NOT_FOUND_CODE = typeof ERR_NOT_FOUND !== 'undefined' ? ERR_NOT_FOUND : -5;
const ERR_INVALID_TARGET_CODE = typeof ERR_INVALID_TARGET !== 'undefined' ? ERR_INVALID_TARGET : -7;
const ERR_FULL_CODE = typeof ERR_FULL !== 'undefined' ? ERR_FULL : -8;
const ERR_NO_PATH_CODE = typeof ERR_NO_PATH !== 'undefined' ? ERR_NO_PATH : -2;

const RESOURCE_ENERGY_TYPE = typeof RESOURCE_ENERGY !== 'undefined' ? RESOURCE_ENERGY : 'energy';
const STRUCTURE_CONTROLLER_TYPE = typeof STRUCTURE_CONTROLLER !== 'undefined' ? STRUCTURE_CONTROLLER : 'controller';

const role = {
    RoleName: "Looter",
    Tick: function(creep) {
        if (!creep || !creep.memory) return;

        let creepTimerTrigger = false;
        if (creep.memory.checkTimer === undefined) creep.memory.checkTimer = CREEP_TIMER_DEFAULT;
        if (creep.memory.checkTimer <= 0) {
            creep.memory.checkTimer = CREEP_TIMER_DEFAULT;
            creepTimerTrigger = true;
        }
        creep.memory.checkTimer--;

        // State machine toggle based on total carried inventory.
        const totalUsed = creep.store.getUsedCapacity();
        const freeCapacity = creep.store.getFreeCapacity();

        if (freeCapacity === 0) {
            creep.memory.state = "feeding";
            creep.memory.lootTargetId = null;
        }
        if (totalUsed === 0) {
            creep.memory.state = "looting";
            creep.memory.deliveryTargetId = null;
        }

        if (!creep.memory.state) {
            creep.memory.state = totalUsed > 0 ? "feeding" : "looting";
        }

        const delivering = creep.memory.state === "feeding" || creep.memory.state === "delivering" || creep.memory.state === "storing";
        const looting = creep.memory.state === "looting" || creep.memory.state === "harvesting" || creep.memory.state === "gathering";

        if (delivering) {
            deliverGains(creep, creepTimerTrigger, totalUsed);
            return;
        }

        if (looting) {
            lootRoom(creep, creepTimerTrigger, freeCapacity, totalUsed);
        }
    },
    FindLootTarget: findLootTarget,
    FindDeliveryTarget: findDeliveryTarget,
    GetTargetRoom: getTargetRoom,
    GetHomeRoom: getHomeRoom,
    GetTargetPosition: getTargetPosition,
    LootObject: lootObject,
    DeliverGains: deliverGains,
    IsValidLootTarget: isValidLootTarget
};

function deliverGains(creep, creepTimerTrigger, totalUsed) {
    const homeRoom = getHomeRoom(creep);
    if (homeRoom && creep.room.name !== homeRoom) {
        const homeTarget = (Game.rooms[homeRoom] && Game.rooms[homeRoom].storage)
            || (Game.rooms[homeRoom] && Game.rooms[homeRoom].find(FIND_MY_SPAWNS)[0])
            || (typeof RoomPosition !== 'undefined' ? new RoomPosition(25, 25, homeRoom) : { x: 25, y: 25, roomName: homeRoom });
        creep.moveTo(homeTarget, { visualizePathStyle: { stroke: '#ffffff' } });
        return;
    }

    // Prevent room border oscillation
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        creep.moveTo(25, 25);
    }

    const carriedResource = getCreepFirstCarriedResource(creep);
    if (!carriedResource || totalUsed === 0) {
        creep.memory.state = "looting";
        creep.memory.deliveryTargetId = null;
        return;
    }

    let deliveryTarget = null;
    if (creep.memory.deliveryTargetId && typeof Game !== 'undefined') {
        deliveryTarget = Game.getObjectById(creep.memory.deliveryTargetId);
    }
    if (deliveryTarget && deliveryTarget.store && deliveryTarget.store.getFreeCapacity(carriedResource) === 0) {
        deliveryTarget = null;
        creep.memory.deliveryTargetId = null;
    }
    if (!deliveryTarget || creepTimerTrigger) {
        deliveryTarget = findDeliveryTarget(creep, carriedResource);
        creep.memory.deliveryTargetId = deliveryTarget ? deliveryTarget.id : null;
    }

    if (deliveryTarget) {
        const result = creep.transfer(deliveryTarget, carriedResource);
        if (result === ERR_NOT_IN_RANGE_CODE) {
            creep.moveTo(deliveryTarget, { visualizePathStyle: { stroke: '#ffffff' } });
        } else if (result === 0) {
            if (deliveryTarget.store && deliveryTarget.store.getFreeCapacity(carriedResource) === 0) {
                creep.memory.deliveryTargetId = null;
            }
        } else if (result === ERR_NOT_FOUND_CODE || result === ERR_INVALID_TARGET_CODE || result === ERR_FULL_CODE) {
            creep.memory.deliveryTargetId = null;
        }
    } else {
        // If all storage is full, step inside so room transitions do not loop
        if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(25, 25);
        }
    }
}

function lootRoom(creep, creepTimerTrigger, freeCapacity, totalUsed) {
    const targetRoom = getTargetRoom(creep);
    const targetPos = getTargetPosition(creep);

    if (!targetRoom) {
        console.log(`Looter ${creep.name} has no target room assigned.`);
        return;
    }

    if (creep.room.name !== targetRoom) {
        const moveTarget = targetPos || new RoomPosition(25, 25, targetRoom);
        creep.moveTo(moveTarget, { visualizePathStyle: { stroke: '#ffaa00' } });
        return;
    }

    // Step off room borders
    if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
        creep.moveTo(25, 25);
    }

    let lootTarget = null;
    if (creep.memory.lootTargetId && typeof Game !== 'undefined') {
        lootTarget = Game.getObjectById(creep.memory.lootTargetId);
    }
    if (lootTarget && !isValidLootTarget(lootTarget, creep)) {
        lootTarget = null;
        creep.memory.lootTargetId = null;
    }
    if (!lootTarget || creepTimerTrigger) {
        lootTarget = findLootTarget(creep);
        creep.memory.lootTargetId = lootTarget ? lootTarget.id : null;
    }

    if (!lootTarget) {
        // If no loot remains in target room, return home with whatever we gathered
        if (totalUsed > 0) {
            creep.memory.state = "feeding";
            return;
        }
        // If empty and nothing to loot, park near target position or center
        const parkPos = targetPos || new RoomPosition(25, 25, targetRoom);
        if (!creep.pos.inRangeTo(parkPos, 2)) {
            creep.moveTo(parkPos, { visualizePathStyle: { stroke: '#ffaa00' } });
        } else if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
            creep.moveTo(25, 25);
        }
        return;
    }

    lootObject(creep, lootTarget, freeCapacity);
}

function lootObject(creep, target, freeCapacity) {
    if (!creep || !target) return;

    // 1. Dropped resource
    if (target.amount !== undefined) {
        const result = creep.pickup(target);
        if (result === ERR_NOT_IN_RANGE_CODE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
        } else if (result === 0) {
            if (freeCapacity <= target.amount) {
                creep.memory.lootTargetId = null;
            }
        } else {
            creep.memory.lootTargetId = null;
        }
        return;
    }

    // 2. Tombstone, Ruin, or Structure with store
    if (target.store) {
        const resourceType = getStoreFirstResourceType(target.store);
        if (!resourceType) {
            creep.memory.lootTargetId = null;
            return;
        }
        const result = creep.withdraw(target, resourceType);
        if (result === ERR_NOT_IN_RANGE_CODE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
        } else if (result === 0) {
            const storedAmount = target.store.getUsedCapacity(resourceType);
            if (freeCapacity <= (storedAmount || 0)) {
                creep.memory.lootTargetId = null;
            }
        } else {
            creep.memory.lootTargetId = null;
        }
    }
}

function isValidLootTarget(target, creep) {
    if (!target) return false;
    const homeRoom = getHomeRoom(creep);
    const isHome = creep && creep.room && creep.room.name === homeRoom;

    // Dropped resource
    if (target.amount !== undefined) {
        return target.amount > 0;
    }

    // Tombstone or Ruin
    if (target.deathTime !== undefined || target.destroyTime !== undefined) {
        return target.store && target.store.getUsedCapacity() > 0;
    }

    // Structure
    if (target.structureType !== undefined) {
        if (target.structureType === STRUCTURE_CONTROLLER_TYPE) return false;
        if (target.my) return false;
        // In home room, do not loot neutral containers
        if (isHome && target.my === undefined) return false;
        return target.store && target.store.getUsedCapacity() > 0;
    }

    return false;
}

function findClosest(pos, targets) {
    if (!targets || targets.length === 0) return null;
    if (pos) {
        return pos.findClosestByPath(targets) || pos.findClosestByRange(targets) || targets[0];
    }
    return targets[0];
}

function findLootTarget(creep) {
    if (!creep || !creep.room) return null;

    // 1. Tombstones (highest priority due to fast decay)
    if (typeof FIND_TOMBSTONES !== 'undefined') {
        const tombstones = creep.room.find(FIND_TOMBSTONES, {
            filter: (t) => isValidLootTarget(t, creep)
        });
        if (tombstones.length > 0) {
            return findClosest(creep.pos, tombstones);
        }
    }

    // 2. Dropped resources
    if (typeof FIND_DROPPED_RESOURCES !== 'undefined') {
        const dropped = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: (r) => isValidLootTarget(r, creep)
        });
        if (dropped.length > 0) {
            return findClosest(creep.pos, dropped);
        }
    }

    // 3. Ruins (decay over time)
    if (typeof FIND_RUINS !== 'undefined') {
        const ruins = creep.room.find(FIND_RUINS, {
            filter: (r) => isValidLootTarget(r, creep)
        });
        if (ruins.length > 0) {
            return findClosest(creep.pos, ruins);
        }
    }

    // 4. Storages, Terminals, and Containers (dense loot pools)
    if (typeof FIND_STRUCTURES !== 'undefined') {
        const priorityTypes = [
            typeof STRUCTURE_STORAGE !== 'undefined' ? STRUCTURE_STORAGE : 'storage',
            typeof STRUCTURE_TERMINAL !== 'undefined' ? STRUCTURE_TERMINAL : 'terminal',
            typeof STRUCTURE_CONTAINER !== 'undefined' ? STRUCTURE_CONTAINER : 'container'
        ];
        const primaryStructures = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => priorityTypes.includes(s.structureType) && isValidLootTarget(s, creep)
        });
        if (primaryStructures.length > 0) {
            return findClosest(creep.pos, primaryStructures);
        }

        // 5. Any other hostile / unowned structures with resources (spawns, labs, towers, extensions, etc.)
        const otherStructures = creep.room.find(FIND_STRUCTURES, {
            filter: (s) => isValidLootTarget(s, creep)
        });
        if (otherStructures.length > 0) {
            return findClosest(creep.pos, otherStructures);
        }
    }

    return null;
}

function findDeliveryTarget(creep, resourceType) {
    if (!creep || !creep.room) return null;
    const res = resourceType || RESOURCE_ENERGY_TYPE;

    if (res === RESOURCE_ENERGY_TYPE) {
        // 1. Storage
        if (creep.room.storage && creep.room.storage.store && creep.room.storage.store.getFreeCapacity(res) > 0) {
            return creep.room.storage;
        }
        if (typeof FIND_MY_STRUCTURES !== 'undefined' && typeof STRUCTURE_STORAGE !== 'undefined') {
            const storage = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_STORAGE && s.store && s.store.getFreeCapacity(res) > 0
            });
            const closestStorage = findClosest(creep.pos, storage);
            if (closestStorage) return closestStorage;
        }

        // 2. Spawns
        if (typeof FIND_MY_SPAWNS !== 'undefined') {
            const spawns = creep.room.find(FIND_MY_SPAWNS, {
                filter: (s) => s.store && s.store.getFreeCapacity(res) > 0
            });
            const closestSpawn = findClosest(creep.pos, spawns);
            if (closestSpawn) return closestSpawn;
        }

        // 3. Extensions
        if (typeof FIND_MY_STRUCTURES !== 'undefined' && typeof STRUCTURE_EXTENSION !== 'undefined') {
            const extensions = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_EXTENSION && s.store && s.store.getFreeCapacity(res) > 0
            });
            const closestExtension = findClosest(creep.pos, extensions);
            if (closestExtension) return closestExtension;
        }

        // 4. Towers
        if (typeof FIND_MY_STRUCTURES !== 'undefined' && typeof STRUCTURE_TOWER !== 'undefined') {
            const towers = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_TOWER && s.store && s.store.getFreeCapacity(res) > 0
            });
            const closestTower = findClosest(creep.pos, towers);
            if (closestTower) return closestTower;
        }

        // 5. Containers
        if (typeof FIND_STRUCTURES !== 'undefined' && typeof STRUCTURE_CONTAINER !== 'undefined') {
            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store && s.store.getFreeCapacity(res) > 0
            });
            const closestContainer = findClosest(creep.pos, containers);
            if (closestContainer) return closestContainer;
        }

        // 6. Terminal
        if (creep.room.terminal && creep.room.terminal.store && creep.room.terminal.store.getFreeCapacity(res) > 0) {
            return creep.room.terminal;
        }
    } else {
        // Non-energy resources: Storage -> Terminal -> Containers
        if (creep.room.storage && creep.room.storage.store && creep.room.storage.store.getFreeCapacity(res) > 0) {
            return creep.room.storage;
        }
        if (typeof FIND_MY_STRUCTURES !== 'undefined' && typeof STRUCTURE_STORAGE !== 'undefined') {
            const storage = creep.room.find(FIND_MY_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_STORAGE && s.store && s.store.getFreeCapacity(res) > 0
            });
            const closestStorage = findClosest(creep.pos, storage);
            if (closestStorage) return closestStorage;
        }

        if (creep.room.terminal && creep.room.terminal.store && creep.room.terminal.store.getFreeCapacity(res) > 0) {
            return creep.room.terminal;
        }

        if (typeof FIND_STRUCTURES !== 'undefined' && typeof STRUCTURE_CONTAINER !== 'undefined') {
            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store && s.store.getFreeCapacity(res) > 0
            });
            const closestContainer = findClosest(creep.pos, containers);
            if (closestContainer) return closestContainer;
        }
    }

    return null;
}

function getHomeRoom(creep) {
    if (!creep || !creep.memory) return creep && creep.room ? creep.room.name : null;
    if (creep.memory.homeRoom) return String(creep.memory.homeRoom);
    if (creep.memory.home) return String(creep.memory.home);
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

function getTargetRoom(creep) {
    if (!creep || !creep.memory) return null;
    if (creep.memory.targetRoom) return String(creep.memory.targetRoom);
    if (creep.memory.lootRoom) return String(creep.memory.lootRoom);

    const homeRoom = getHomeRoom(creep);
    if (creep.memory.room && creep.memory.room !== homeRoom) return String(creep.memory.room);

    if (typeof creep.memory.target === 'string') {
        const trimmed = creep.memory.target.trim();
        if (/^[WE]\d+[NS]\d+$/i.test(trimmed) || trimmed.toLowerCase() === 'sim') {
            return trimmed.toUpperCase();
        }
        const parts = trimmed.split(/[,:\s]+/).filter(Boolean);
        for (const part of parts) {
            if (/^[WE]\d+[NS]\d+$/i.test(part)) return part.toUpperCase();
        }
    }

    if (creep.memory.targetPos) {
        if (typeof creep.memory.targetPos === 'object' && creep.memory.targetPos.roomName) {
            return creep.memory.targetPos.roomName;
        }
        if (typeof RoomPosition !== 'undefined' && creep.memory.targetPos instanceof RoomPosition) {
            return creep.memory.targetPos.roomName;
        }
    }

    if (typeof Game !== 'undefined' && Game.flags) {
        if (Game.flags[creep.name]) return Game.flags[creep.name].pos.roomName;
        if (Game.flags['Loot']) return Game.flags['Loot'].pos.roomName;
        if (Game.flags['loot']) return Game.flags['loot'].pos.roomName;
    }

    return creep.room ? creep.room.name : null;
}

function getTargetPosition(creep) {
    const targetRoom = getTargetRoom(creep);
    if (!targetRoom) return null;

    if (creep.memory && creep.memory.targetPos) {
        const tp = creep.memory.targetPos;
        if (typeof RoomPosition !== 'undefined' && tp instanceof RoomPosition) return tp;
        if (typeof tp === 'object' && typeof tp.x === 'number' && typeof tp.y === 'number') {
            const roomName = tp.roomName || targetRoom;
            if (typeof RoomPosition !== 'undefined') return new RoomPosition(tp.x, tp.y, roomName);
            return { x: tp.x, y: tp.y, roomName: roomName };
        }
    }

    if (typeof RoomPosition !== 'undefined') {
        return new RoomPosition(25, 25, targetRoom);
    }
    return { x: 25, y: 25, roomName: targetRoom };
}

function getStoreFirstResourceType(store) {
    if (!store) return null;
    for (const res in store) {
        if (store[res] > 0) return res;
    }
    if (typeof RESOURCES_ALL !== 'undefined') {
        for (const res of RESOURCES_ALL) {
            if (store.getUsedCapacity(res) > 0) return res;
        }
    }
    if (store.getUsedCapacity(RESOURCE_ENERGY_TYPE) > 0) {
        return RESOURCE_ENERGY_TYPE;
    }
    return null;
}

function getCreepFirstCarriedResource(creep) {
    if (!creep || !creep.store) return null;
    for (const res in creep.store) {
        if (creep.store[res] > 0) return res;
    }
    if (typeof RESOURCES_ALL !== 'undefined') {
        for (const res of RESOURCES_ALL) {
            if (creep.store.getUsedCapacity(res) > 0) return res;
        }
    }
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY_TYPE) > 0) {
        return RESOURCE_ENERGY_TYPE;
    }
    return null;
}

module.exports = role;
