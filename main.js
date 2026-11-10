require('utils');

const harvesterCreepRole = require('role.creep.harvester');
const foreignHarvesterCreepRole = require('role.creep.foreignHarvester');
const builderCreepRole = require('role.creep.builder');
const defenderCreepRole = require('role.creep.defender');
const attackerCreepRole = require('role.creep.attacker');
const leechCreepRole = require('role.creep.leech');
const looterCreepRole = require('role.creep.looter');
const testCreepRole = require('role.creep.test');
const travellerCreepRole = require('role.creep.traveller');
const claimerCreepRole = require('role.creep.claimer');
const reserverCreepRole = require('role.creep.reserver');
const coreSpawnerRole = require('role.spawner.core');

module.exports.loop = function () {
    console.log('tick')

    ProcessEvents();
    ensureData();
    tickCreep();
    tickSpawner();
    tickTowers();
    pixels();
}

function tickCreep() {
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        switch (c.memory.role) {
            case harvesterCreepRole.RoleName:
                harvesterCreepRole.Tick(c);
                break;
            case foreignHarvesterCreepRole.RoleName:
                foreignHarvesterCreepRole.Tick(c);
                break;
            case builderCreepRole.RoleName:
                builderCreepRole.Tick(c);
                break;
            case defenderCreepRole.RoleName:
                defenderCreepRole.Tick(c);
                break;
            case attackerCreepRole.RoleName:
                attackerCreepRole.Tick(c);
                break;
            case leechCreepRole.RoleName:
                leechCreepRole.Tick(c);
                break;
            case looterCreepRole.RoleName:
                looterCreepRole.Tick(c);
                break;
            case testCreepRole.RoleName:
                testCreepRole.Tick(c);
                break;
            case travellerCreepRole.RoleName:
                travellerCreepRole.Tick(c);
                break;
            case claimerCreepRole.RoleName:
                claimerCreepRole.Tick(c);
                break;
            case reserverCreepRole.RoleName:
                reserverCreepRole.Tick(c);
                break;
            default:
                console.log(`Creep ${c.name} has unknown role ${c.memory.role}`)
                break;
        }
    }
}

function tickSpawner() {
    for (const name in Game.spawns) {
        const spawn = Game.spawns[name];
        switch (spawn.memory.role) {
            case coreSpawnerRole.RoleName:
                coreSpawnerRole.Tick(spawn);
                break;
            default:
                console.log(`Spawner ${spawn.name} has unknown role ${spawn.memory.role}`)
                break;
        }
    }
}

function ensureData() {
    if (!Memory.myCreepIds) Memory.myCreepIds = [];
    if (!Memory.enemies) Memory.enemies = [];
    if (!Memory.username) Memory.username = "aytimothy";

    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (c.memory.role === undefined) c.memory.role = "";
        if (c.memory.target === undefined) c.memory.target = "";
        if (c.memory.state === undefined) c.memory.state = "";
    }

    for (const name in Game.spawns) {
        const s = Game.spawns[name];
        if (s.memory.role === undefined) s.memory.role = "";
        if (s.memory.stage === undefined) s.memory.stage = 0;
        if (s.memory.state === undefined) s.memory.state = "";
    }
}

function pixels() {
    if (typeof Game.cpu.generatePixel === "function") {
        if (Game.cpu.bucket >= 9950) {
            Game.cpu.generatePixel();

            if (!Memory.pixelsGenerated) Memory.pixelsGenerated = 0;
            if (!Memory.lastPixelGenerationTick) Memory.lastPixelGenerationTick = [];
            Memory.pixelsGenerated++;
            Memory.lastPixelGenerationTick.push(Game.time);
        }
    }
}

function ProcessEvents() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        // Skip rooms already in safe mode.
        const events = room.getEventLog();

        for (const event of events) {
            // Panic
            if (event.event === EVENT_ATTACK) {
                const attacker = Game.getObjectById(event.objectId);
                const victim = Game.getObjectById(event.data.targetId);
                const me = Memory.username ? Memory.username : "aytimothy";
                if (attacker && attacker.owner && attacker.owner.username !== "Invader" && attacker.owner.username !== "Source Keeper" && attacker.owner.username !== me) {
                    const message = `Panic! Room ${roomName} is under attack by ${attacker.owner.username}!`;
                    if (!Memory.enemies.includes(attacker.owner.username)) Memory.enemies.push(attacker.owner.username);
                    console.log(message);
                    Game.notify(message)
                    // room.controller.activateSafeMode();
                }
            }
            if (event.event === EVENT_OBJECT_DESTROYED) {
                let victimType = event.data.type;
                switch (victimType) {
                    case "creep":
                        victimType = "Creep";
                        break;
                    case STRUCTURE_EXTENSION:
                        victimType = "Extension";
                        break;
                    case STRUCTURE_SPAWN:
                        victimType = "Spawn";
                        break;
                    case STRUCTURE_TOWER:
                        victimType = "Tower";
                        break;
                    case STRUCTURE_WALL:
                        victimType = "Wall";
                        break;
                    case STRUCTURE_EXTRACTOR:
                        victimType = "Extractor";
                        break;
                    default:
                        victimType = `Object Type ${victimType}`;
                        break;
                }
                const victim = event.objectId;
                const message = `Object ${victim} (${victimType}) was destroyed in room ${roomName}.`;
                // Game.notify(message);
                console.log(message);
            }
        }
    }
}

function tickTowers() {
    for (const roomId in Game.rooms) {
        const room = Game.rooms[roomId];
        const hostiles = room.find(FIND_HOSTILE_CREEPS, {
            filter: (c) => c.owner.username === "Invader" || c.owner.username === "Source Keeper" || Memory.enemies.includes(c.owner.username)
        });
        if (hostiles.length > 0) {
            const closestHostile = hostiles[0];
            const towers = room.find(FIND_MY_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_TOWER
            });
            for (const tower of towers) {
                tower.attack(closestHostile);
            }
        }
    }
}
