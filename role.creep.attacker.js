/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.attacker');
 * mod.thing == 'a thing'; // true
 */

const ERR_NOT_IN_RANGE_CODE = typeof ERR_NOT_IN_RANGE !== 'undefined' ? ERR_NOT_IN_RANGE : -9;
const ERR_NOT_FOUND_CODE = typeof ERR_NOT_FOUND !== 'undefined' ? ERR_NOT_FOUND : -5;
const ERR_INVALID_TARGET_CODE = typeof ERR_INVALID_TARGET !== 'undefined' ? ERR_INVALID_TARGET : -7;
const ERR_NO_PATH_CODE = typeof ERR_NO_PATH !== 'undefined' ? ERR_NO_PATH : -2;

const ATTACK_TYPE = typeof ATTACK !== 'undefined' ? ATTACK : 'attack';
const RANGED_ATTACK_TYPE = typeof RANGED_ATTACK !== 'undefined' ? RANGED_ATTACK : 'ranged_attack';
const FIND_HOSTILE_CREEPS_TYPE = typeof FIND_HOSTILE_CREEPS !== 'undefined' ? FIND_HOSTILE_CREEPS : 103;
const FIND_MY_CREEPS_TYPE = typeof FIND_MY_CREEPS !== 'undefined' ? FIND_MY_CREEPS : 101;
const FIND_HOSTILE_STRUCTURES_TYPE = typeof FIND_HOSTILE_STRUCTURES !== 'undefined' ? FIND_HOSTILE_STRUCTURES : 105;
const STRUCTURE_CONTROLLER_TYPE = typeof STRUCTURE_CONTROLLER !== 'undefined' ? STRUCTURE_CONTROLLER : 'controller';
const STRUCTURE_TOWER_TYPE = typeof STRUCTURE_TOWER !== 'undefined' ? STRUCTURE_TOWER : 'tower';
const STRUCTURE_SPAWN_TYPE = typeof STRUCTURE_SPAWN !== 'undefined' ? STRUCTURE_SPAWN : 'spawn';

const role = {
    RoleName: "Attacker",
    Tick: function (creep) {
        if (!creep || !creep.memory) return;

        // 1. Check if creep has a rally point and hasn't finished rallying yet
        if (creep.memory.rally && !creep.memory.rallied) {
            const rallyPos = getRallyPosition(creep);
            if (rallyPos) {
                // If currently rallying or no state set, check if arrived at rally point
                if (creep.memory.state === "rallying" || !creep.memory.state) {
                    if (creep.room.name === rallyPos.roomName && creep.pos.inRangeTo(rallyPos, 3)) {
                        creep.memory.state = "waiting";
                    } else {
                        creep.memory.state = "rallying";
                        creep.moveTo(rallyPos, { visualizePathStyle: { stroke: '#00ff00' } });
                        return;
                    }
                }

                // If waiting at rally point, check if enough friendly creeps have assembled
                if (creep.memory.state === "waiting") {
                    const requiredCount = typeof creep.memory.rallyCount === 'number' && creep.memory.rallyCount > 0
                        ? creep.memory.rallyCount
                        : 1;

                    // Creeps of its own nearby (within range 4 of rallyPos or range 3 of this creep)
                    const nearbyOwnCreeps = creep.room.find(FIND_MY_CREEPS_TYPE, {
                        filter: (c) => c.pos.inRangeTo(rallyPos, 4) || c.pos.inRangeTo(creep.pos, 3)
                    });

                    // Check if group peers have already started moving
                    const peerDeparted = creep.room.find(FIND_MY_CREEPS_TYPE, {
                        filter: (c) => c.id !== creep.id &&
                            c.memory &&
                            c.memory.role === creep.memory.role &&
                            (c.memory.state === "travelling" || c.memory.state === "targeting") &&
                            c.pos.inRangeTo(rallyPos, 6)
                    }).length > 0;

                    if (nearbyOwnCreeps.length >= requiredCount || peerDeparted) {
                        creep.memory.rallied = true;
                        creep.memory.state = "travelling";
                    } else {
                        // Under attack or target on sight while waiting: defend
                        const target = findTarget(creep);
                        if (target) {
                            executeAttack(creep, target);
                            return;
                        }

                        // Stay near rally point
                        if (!creep.pos.inRangeTo(rallyPos, 2)) {
                            creep.moveTo(rallyPos, { visualizePathStyle: { stroke: '#00ff00' } });
                        } else if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                            creep.moveTo(25, 25);
                        }
                        return;
                    }
                }
            } else {
                // Rally position invalid, proceed to target
                creep.memory.rallied = true;
                creep.memory.state = "travelling";
            }
        }

        // 2. Resolve target room and coordinates
        const targetPos = getTargetPosition(creep);
        if (!targetPos) {
            console.log(`Attacker ${creep.name} has no target coordinates assigned.`);
            return;
        }

        // 3. Attack targets on sight
        const target = findTarget(creep);
        if (target) {
            creep.memory.state = "targeting";
            executeAttack(creep, target);
            return;
        }

        // 4. No target in sight; handle state transitions and movement
        if (creep.memory.state === "targeting") {
            // Target eliminated or lost
            if (creep.room.name === targetPos.roomName && creep.pos.inRangeTo(targetPos, 2)) {
                creep.memory.state = "waiting";
            } else {
                creep.memory.state = "travelling";
            }
        }

        if (creep.memory.state === "travelling" || !creep.memory.state) {
            if (creep.room.name === targetPos.roomName && creep.pos.inRangeTo(targetPos, 2)) {
                creep.memory.state = "waiting";
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    creep.moveTo(targetPos);
                }
            } else {
                creep.memory.state = "travelling";
                creep.moveTo(targetPos, { visualizePathStyle: { stroke: '#ff0000' } });
            }
            return;
        }

        if (creep.memory.state === "waiting") {
            // Standing guard at target coordinates
            if (!creep.pos.inRangeTo(targetPos, 2)) {
                creep.moveTo(targetPos, { visualizePathStyle: { stroke: '#00ff00' } });
            } else if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(25, 25);
            }
        }
    },
    GetTargetPosition: getTargetPosition,
    GetRallyPosition: getRallyPosition,
    FindTarget: findTarget,
    IsValidTarget: isValidTarget,
    ParsePosition: parsePosition,
    ExecuteAttack: executeAttack
};

function isValidTarget(target, creep) {
    if (!target) return false;

    // Never attack its own creeps or structures
    if (target.my) return false;
    if (creep && creep.owner && target.owner && target.owner.username === creep.owner.username) return false;

    // If creep.memory.evil: attacks everything except its own
    if (creep && creep.memory && creep.memory.evil) {
        return true;
    }

    const username = target.owner ? target.owner.username : null;

    // Attacks all Invaders and Source Keepers on sight and ignore other players
    if (username === "Invader" || username === "Source Keeper") {
        return true;
    }

    // If creep.memory.hostile: attack enemy player-controlled creeps as well (Memory.enemies)
    if (creep && creep.memory && creep.memory.hostile) {
        const enemies = (typeof Memory !== 'undefined' && Array.isArray(Memory.enemies)) ? Memory.enemies : [];
        if (username && enemies.includes(username)) {
            return true;
        }
    }

    return false;
}

function findTarget(creep) {
    if (!creep || !creep.room) return null;

    // 1. Hostile creeps
    const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS_TYPE, {
        filter: (c) => isValidTarget(c, creep)
    });
    if (hostileCreeps.length > 0) {
        return creep.pos.findClosestByPath(hostileCreeps) || creep.pos.findClosestByRange(hostileCreeps) || hostileCreeps[0];
    }

    // Hostile power creeps if present
    if (typeof FIND_HOSTILE_POWER_CREEPS !== 'undefined') {
        const powerCreeps = creep.room.find(FIND_HOSTILE_POWER_CREEPS, {
            filter: (c) => isValidTarget(c, creep)
        });
        if (powerCreeps.length > 0) {
            return creep.pos.findClosestByPath(powerCreeps) || creep.pos.findClosestByRange(powerCreeps) || powerCreeps[0];
        }
    }

    // 2. Hostile structures (if evil, hostile, or invader core)
    const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES_TYPE, {
        filter: (s) => s.structureType !== STRUCTURE_CONTROLLER_TYPE && isValidTarget(s, creep)
    });
    if (hostileStructures.length > 0) {
        // Prioritize defensive and spawning structures
        const priorityStructures = hostileStructures.filter(s =>
            s.structureType === STRUCTURE_TOWER_TYPE || s.structureType === STRUCTURE_SPAWN_TYPE
        );
        if (priorityStructures.length > 0) {
            return creep.pos.findClosestByPath(priorityStructures) || creep.pos.findClosestByRange(priorityStructures) || priorityStructures[0];
        }
        return creep.pos.findClosestByPath(hostileStructures) || creep.pos.findClosestByRange(hostileStructures) || hostileStructures[0];
    }

    return null;
}

function executeAttack(creep, target) {
    if (!creep || !target) return;

    const hasMelee = creep.getActiveBodyparts(ATTACK_TYPE) > 0;
    const hasRanged = creep.getActiveBodyparts(RANGED_ATTACK_TYPE) > 0;

    // Melee attack
    if (hasMelee) {
        const attackResult = creep.attack(target);
        if (attackResult === ERR_NOT_IN_RANGE_CODE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
        }
    }

    // Ranged attack
    if (hasRanged) {
        const range = creep.pos.getRangeTo(target);
        if (range <= 1) {
            const nearbyHostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS_TYPE, 3, {
                filter: (c) => isValidTarget(c, creep)
            });
            if (nearbyHostiles.length > 1) {
                creep.rangedMassAttack();
            } else {
                creep.rangedAttack(target);
            }
        } else if (range <= 3) {
            creep.rangedAttack(target);
        }

        if (!hasMelee && range > 3) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
        }
    }

    // Fallback if neither part check returned true (e.g. mock objects)
    if (!hasMelee && !hasRanged) {
        const attackResult = creep.attack(target);
        if (attackResult === ERR_NOT_IN_RANGE_CODE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
        }
    }
}

function parsePosition(posData) {
    if (!posData) return null;
    if (typeof RoomPosition !== 'undefined' && posData instanceof RoomPosition) {
        return posData;
    }
    if (typeof RoomPosition !== 'undefined' && posData && typeof posData === 'object' && posData.roomName && typeof posData.x === 'number' && typeof posData.y === 'number') {
        return new RoomPosition(posData.x, posData.y, posData.roomName);
    }
    if (Array.isArray(posData)) {
        if (posData.length >= 3) {
            if (typeof posData[0] === 'string' && !isNaN(posData[1]) && !isNaN(posData[2])) {
                return new RoomPosition(Number(posData[1]), Number(posData[2]), posData[0]);
            }
            if (!isNaN(posData[0]) && !isNaN(posData[1]) && typeof posData[2] === 'string') {
                return new RoomPosition(Number(posData[0]), Number(posData[1]), posData[2]);
            }
        }
    }
    if (typeof posData === 'object') {
        const room = posData.roomName || posData.room || posData.roomNumber;
        const x = posData.x !== undefined ? posData.x : 25;
        const y = posData.y !== undefined ? posData.y : 25;
        if (room && !isNaN(x) && !isNaN(y)) {
            return new RoomPosition(Number(x), Number(y), String(room));
        }
    }
    if (typeof posData === 'string') {
        const trimmed = posData.trim();
        const isOnlyRoomName = /^[WE]\d+[NS]\d+$/i.test(trimmed) || trimmed.toLowerCase() === 'sim';
        if (isOnlyRoomName) {
            return new RoomPosition(25, 25, trimmed.toUpperCase());
        }
        const parts = trimmed.split(/[,:\s]+/).filter(Boolean);
        if (parts.length === 3) {
            if ((/^[WE]\d+[NS]\d+$/i.test(parts[0]) || isNaN(parts[0])) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                return new RoomPosition(Number(parts[1]), Number(parts[2]), parts[0]);
            }
            if (!isNaN(parts[0]) && !isNaN(parts[1]) && (/^[WE]\d+[NS]\d+$/i.test(parts[2]) || isNaN(parts[2]))) {
                return new RoomPosition(Number(parts[0]), Number(parts[1]), parts[2]);
            }
        } else if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return { x: Number(parts[0]), y: Number(parts[1]) };
        }
    }
    return null;
}

function getTargetPosition(creep) {
    if (!creep || !creep.memory) return null;

    let pos = parsePosition(creep.memory.target);
    if (typeof RoomPosition !== 'undefined' && pos instanceof RoomPosition) return pos;
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        const roomName = creep.memory.targetRoom || creep.memory.room || (creep.room ? creep.room.name : null);
        if (roomName && typeof RoomPosition !== 'undefined') return new RoomPosition(pos.x, pos.y, roomName);
    }

    if (creep.memory.targetPos) {
        pos = parsePosition(creep.memory.targetPos);
        if (typeof RoomPosition !== 'undefined' && pos instanceof RoomPosition) return pos;
    }

    const room = creep.memory.targetRoom || creep.memory.room;
    let x = creep.memory.targetX !== undefined ? creep.memory.targetX : creep.memory.x;
    let y = creep.memory.targetY !== undefined ? creep.memory.targetY : creep.memory.y;
    if (room && typeof RoomPosition !== 'undefined') {
        const posX = (x !== undefined && !isNaN(x)) ? Number(x) : 25;
        const posY = (y !== undefined && !isNaN(y)) ? Number(y) : 25;
        return new RoomPosition(posX, posY, String(room));
    }
    return null;
}

function getRallyPosition(creep) {
    if (!creep || !creep.memory) return null;

    let pos = parsePosition(creep.memory.rally);
    if (typeof RoomPosition !== 'undefined' && pos instanceof RoomPosition) return pos;
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        const roomName = creep.memory.rallyRoom || (creep.room ? creep.room.name : null);
        if (roomName && typeof RoomPosition !== 'undefined') return new RoomPosition(pos.x, pos.y, roomName);
    }

    if (creep.memory.rallyPos) {
        pos = parsePosition(creep.memory.rallyPos);
        if (typeof RoomPosition !== 'undefined' && pos instanceof RoomPosition) return pos;
    }

    const room = creep.memory.rallyRoom;
    let x = creep.memory.rallyX;
    let y = creep.memory.rallyY;
    if (room && typeof RoomPosition !== 'undefined') {
        const posX = (x !== undefined && !isNaN(x)) ? Number(x) : 25;
        const posY = (y !== undefined && !isNaN(y)) ? Number(y) : 25;
        return new RoomPosition(posX, posY, String(room));
    }
    return null;
}

module.exports = role;
