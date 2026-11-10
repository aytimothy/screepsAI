/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.worker');
 * mod.thing == 'a thing'; // true
 */

const role = {
    RoleName: "Worker",
    Tick: function(creep) {
        const OnDeliveryRoundComplete = function(creep) {
            // Replace this with code to pick the next source target.
            console.log("Worker " + creep.name + " has now empty.");
            return creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE).id;
        }
        const OnHarvestRoundComplete = function(creep) {
            // Replace this with code to pick the next delivery target.
            console.log("Worker " + creep.name + " is now full.");
            if (creep.memory.structureAction === "transfer") return creep.pos.findClosestByPath(FIND_MY_SPAWNS).id;
            else return creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES).id || creep.pos.findClosestByPath(FIND_MY_SPAWNS).id;
        }
        doWorkerTick(creep, OnDeliveryRoundComplete, OnHarvestRoundComplete);
    },
    RunWorkerTick: doWorkerTick
}

function doWorkerTick(creep, onDeliveryRoundComplete, onHarvestRoundComplete) {
    if (!creep.memory.state) creep.memory.state = "harvesting";
    const delivering = creep.memory.state === "feeding";
    const harvesting = creep.memory.state === "harvesting";

    // Resolve target positions.
    if (creep.memory.target === "spawn") creep.memory.target = creep.room.find(FIND_MY_SPAWNS)[0].id;
    if (creep.memory.source === "spawn") creep.memory.source = creep.room.find(FIND_MY_SPAWNS)[0].id;
    if (creep.memory.target === "controller") creep.memory.target = creep.room.controller.id;
    if (creep.memory.source === "controller") creep.memory.source = creep.room.controller.id;
    if (creep.memory.target === "storage") creep.memory.target = creep.room.storage.id;
    if (creep.memory.source === "storage") creep.memory.source = creep.room.storage.id;
    if (creep.memory.target === "terminal") creep.memory.target = creep.room.terminal.id;
    if (creep.memory.source === "terminal") creep.memory.source = creep.room.terminal.id;
    if (creep.memory.target === "container") {
        const closestContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER
        });
        if (closestContainer) creep.memory.target = closestContainer.id;
    }
    if (creep.memory.source === "container") {
        const closestContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER
        });
        if (closestContainer) creep.memory.source = closestContainer.id;
    }
    if (creep.memory.target === "extension") {
        const closestExtension = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        if (closestExtension) creep.memory.target = closestExtension.id;
    }
    if (creep.memory.source === "extension") {
        const closestExtension = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_EXTENSION && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        });
        if (closestExtension) creep.memory.source = closestExtension.id;
    }
    if (creep.memory.target === "source") {
        const closestSource = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (closestSource) creep.memory.target = closestSource.id;
    }
    if (creep.memory.source === "source") {
        const closestSource = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (closestSource) creep.memory.source = closestSource.id;
    }

    // State Transitions
    const resource = creep.memory.resource || RESOURCE_ENERGY;
    if (delivering && creep.store.getUsedCapacity(resource) === 0) {
        creep.memory.state = "harvesting";
        if (onDeliveryRoundComplete) onDeliveryRoundComplete(creep);
    }
    if (harvesting && creep.store.getFreeCapacity(resource) === 0) {
        creep.memory.state = "feeding";
        if (onHarvestRoundComplete) onHarvestRoundComplete(creep);
    }

    if (creep.memory.target === undefined) creep.memory.target = null;
    if (creep.memory.source === undefined) creep.memory.source = null;
    if (!creep.memory.targetPos) creep.memory.targetPos = null;
    if (!creep.memory.sourcePos) creep.memory.sourcePos = null;
    if (!creep.memory.structureAction) creep.memory.structureAction = "transfer";
    if (creep.memory.state === "delivering") creep.memory.state = "feeding"

    // State Machine
    if (delivering) {
        const deliveryTarget = Game.getObjectById(creep.memory.target);
        if (!deliveryTarget) {
            if (!creep.memory.targetPos || creep.memory.target === null || creep.memory.target === undefined) {
                creep.memory.target = onHarvestRoundComplete(creep);
            }
            else {
                if (creep.room.name !== creep.memory.targetPos.roomName) creep.moveTo(new RoomPosition(creep.memory.targetPos.x, creep.memory.targetPos.y, creep.memory.targetPos.roomName), { visualizePathStyle: { stroke: '#ffffff' } });
                else { creep.memory.target = onHarvestRoundComplete(creep); }
            }
        }
        else {
            if (deliveryTarget instanceof ConstructionSite) {
                const buildResult = creep.build(deliveryTarget);
                if (buildResult === OK) { /* do nothing */ }
                else if (buildResult === ERR_BUSY) { /* creep is still being built, do nothing. */ }
                else if (buildResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(deliveryTarget, { visualizePathStyle: { stroke: '#00ffaa' } });
                }
                else if (buildResult === ERR_INVALID_TARGET) {
                    creep.memory.target = onHarvestRoundComplete(creep);
                    creep.moveTo(Game.getObjectById(creep.memory.target));
                }
                else {
                    console.log(`Worker ${creep.name} built ${deliveryTarget.structureType} ${deliveryTarget.id} with unhandled build result ${buildResult}.`);
                }
            }
            else if (deliveryTarget instanceof Structure && !(deliveryTarget instanceof StructureController)) {
                switch (creep.memory.structureAction) {
                    case "transfer":

                        const transferResult = creep.transfer(deliveryTarget, resource);
                        if (transferResult === ERR_NOT_IN_RANGE) {
                            creep.moveTo(deliveryTarget, { visualizePathStyle: { stroke: '#00ff00' } });
                        }
                        else if (transferResult === OK) { /* do nothing */ }
                        else if (transferResult === ERR_BUSY) { /* creep is still being built, do nothing. */ }
                        else if (transferResult === ERR_FULL) {
                            creep.memory.target = onHarvestRoundComplete(creep);
                            creep.moveTo(Game.getObjectById(creep.memory.target));
                        }
                        else {
                            const message = `Worker ${creep.name} repaired ${deliveryTarget.structureType} ${deliveryTarget.id} with unhandled repair result ${transferResult}.`;
                            console.log(message);
                            Game.notify(message);
                        }
                        break;
                    case "repair":
                        const repairResult = creep.repair(deliveryTarget);
                        if (deliveryTarget.hits >= deliveryTarget.hitsMax) {
                            creep.memory.lastTarget = creep.memory.target;
                            creep.memory.target = onHarvestRoundComplete(creep);
                            creep.moveTo(Game.getObjectById(creep.memory.target));
                        }
                        if (repairResult === ERR_NOT_IN_RANGE) {
                            creep.moveTo(deliveryTarget, { visualizePathStyle: { stroke: '#00ff00' } });
                        }
                        else if (repairResult === OK) { /* do nothing */ }
                        else if (repairResult === ERR_BUSY) { /* creep is still being built, do nothing. */ }
                        else if (repairResult === ERR_INVALID_TARGET) {
                            creep.memory.target = onHarvestRoundComplete(creep);
                            creep.moveTo(Game.getObjectById(creep.memory.target));
                        }
                        else if (repairResult === ERR_NOT_ENOUGH_ENERGY) {
                            creep.memory.lastTarget = creep.memory.target;
                            creep.memory.target = null;
                            creep.memory.state = "harvesting";
                            creep.memory.source = onDeliveryRoundComplete(creep);
                            creep.moveTo(Game.getObjectById(creep.memory.source));
                        }
                        else if (deliveryTarget.hits >= deliveryTarget.hitsMax) {
                            creep.memory.lastTarget = creep.memory.target;
                            creep.memory.target = onHarvestRoundComplete(creep);
                            creep.moveTo(Game.getObjectById(creep.memory.target));
                        }
                        else {
                            const message = `Worker ${creep.name} repaired ${deliveryTarget.structureType} ${deliveryTarget.id} with unhandled repair result ${repairResult}.`;
                            console.log(message);
                            Game.notify(message);
                        }
                        break;
                    default:
                        console.log(`Worker ${creep.name} has an unknown structureAction: ${creep.memory.structureAction}`);
                }
            }
            else if (deliveryTarget instanceof Creep) {
                const transferResult = creep.transfer(deliveryTarget, RESOURCE_ENERGY);
                if (transferResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(deliveryTarget, { visualizePathStyle: { stroke: '#00ff00' } });
                }
                else if (transferResult === OK) { /* do nothing */ }
                else if (transferResult === ERR_BUSY) { /* creep is still being built, do nothing. */ }
                else if (transferResult === ERR_INVALID_TARGET) {
                    creep.memory.target = onHarvestRoundComplete(creep);
                    creep.moveTo(Game.getObjectById(creep.memory.target));
                }
                else {
                    console.log(`Worker ${creep.name} transferred to ${deliveryTarget.name} with unhandled transfer result ${transferResult}.`);
                }
            }
            else if (deliveryTarget instanceof StructureController) {
                const upgradeResult = creep.upgradeController(deliveryTarget);
                if (upgradeResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(deliveryTarget, { visualizePathStyle: { stroke: '#00ff00' } });
                }
                else if (upgradeResult === OK) { /* do nothing */ }
                else if (upgradeResult === ERR_BUSY) { /* creep is still being built, do nothing. */ }
                else if (upgradeResult === ERR_INVALID_TARGET) {
                    creep.memory.target = onHarvestRoundComplete(creep);
                    creep.moveTo(Game.getObjectById(creep.memory.target));
                }
                else {
                    console.log(`Worker ${creep.name} upgraded ${deliveryTarget.name} with unhandled upgrade result ${upgradeResult}.`);
                }
            }
            else if (deliveryTarget instanceof Resource || deliveryTarget instanceof Tombstone || deliveryTarget instanceof Ruin) {
                // invalid target.
                console.log(`[${creep.name}] invalid delivery target, retargetting...`)
                creep.memory.target = onHarvestRoundComplete(creep);
                creep.moveTo(Game.getObjectById(creep.memory.target));
            }
            else {
                console.log(`Worker ${creep.name} has unhandled delivery target type: ${deliveryTarget.id} (${deliveryTarget.constructor.name})`);
            }
        }
    }
    if (harvesting) {
        const harvestSource = Game.getObjectById(creep.memory.source);
        if (!harvestSource) {
            if (!creep.memory.sourcePos || creep.memory.source === null || creep.memory.source === undefined) {
                creep.memory.source = onDeliveryRoundComplete(creep);
            }
            else {
                if (creep.room.name !== creep.memory.sourcePos.roomName) creep.moveTo(new RoomPosition(creep.memory.sourcePos.x, creep.memory.sourcePos.y, creep.memory.sourcePos.roomName), { visualizePathStyle: { stroke: '#aaff00' } });
                else { creep.memory.target = onHarvestRoundComplete(creep); }
            }
        }
        else {
            if (harvestSource instanceof Source) {
                const harvestResult = creep.harvest(harvestSource);
                if (harvestResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(harvestSource, { visualizePathStyle: { stroke: '#ffff00' } });
                }
                else if (harvestResult === OK) { /* do nothing */ }
                else if (harvestResult === ERR_BUSY) { /* creep is still being built, do nothing. */ }
                else if (harvestResult === ERR_NOT_ENOUGH_RESOURCES) {
                    creep.memory.source = onDeliveryRoundComplete(creep);
                    creep.moveTo(Game.getObjectById(creep.memory.source));
                }
                else {
                    console.log(`Worker ${creep.name} harvested ${harvestSource.id} with unhandled harvest result ${harvestResult}.`);
                }
            }
            if (harvestSource instanceof StructureContainer || harvestSource instanceof StructureStorage || harvestSource instanceof Tombstone || harvestSource instanceof Ruin) {
                const withdrawResult = creep.withdraw(harvestSource, resource);
                if (withdrawResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(harvestSource, { visualizePathStyle: { stroke: '#ffff00' } });
                }
                else if (withdrawResult === OK) { /* do nothing */ }
                else if (withdrawResult === ERR_BUSY) { /* creep is still being built, do nothing. */ }
                else if (withdrawResult === ERR_NOT_ENOUGH_RESOURCES) {
                    creep.memory.source = onDeliveryRoundComplete(creep);
                    creep.moveTo(Game.getObjectById(creep.memory.source));
                }
                else {
                    console.log(`Worker ${creep.name} picked up ${harvestSource.id} with unhandled pickup result ${pickupResult}.`);
                }
            }
            if (harvestSource instanceof Resource) {
                const pickupResult = creep.pickup(harvestSource);
                if (pickupResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(harvestSource, { visualizePathStyle: { stroke: '#ffff00' } });
                }
                else if (pickupResult === OK) { /* do nothing */ }
                else if (pickupResult === ERR_BUSY) { /* creep is still being built, do nothing. */ }
                else {
                    console.log(`Worker ${creep.name} picked up ${harvestSource.id} with unhandled pickup result ${pickupResult}.`);
                }
            }
            if (harvestSource instanceof Creep) {
                // can't steal from another creep; the other creep has to give it to you.
                creep.moveTo(harvestSource);
            }
        }
    }
}

module.exports = role;
