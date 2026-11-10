/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.traveller');
 * mod.thing == 'a thing'; // true
 */

role = {
    RoleName: "Traveller",
    Tick: function(creep) {
        if (!creep.memory.target || !creep.memory.targetRoom || !creep.memory.destinationRole) {
            console.log(`Traveller ${creep.name} has no target, targetRoom, or destinationRole!`);
            return;
        }

        if (creep.room.name !== creep.memory.targetRoom) {
            creep.moveTo(new RoomPosition(creep.memory.target.x, creep.memory.target.y, creep.memory.targetRoom), { visualizePathStyle: { stroke: '#ffffff' } });
        }
        if (creep.room.name === creep.memory.targetRoom) {
            creep.moveTo(new RoomPosition(creep.memory.target.x, creep.memory.target.y, creep.memory.targetRoom), { visualizePathStyle: { stroke: '#ffffff' } });
            if (creep.pos.x === creep.memory.target.x && creep.pos.y === creep.memory.target.y) {
                console.log(`Traveller ${creep.name} has reached its target!`);
                creep.memory.role = creep.memory.destinationRole;
                creep.memory.target = null;
                delete creep.memory.destinationRole;
            }
        }
    }
}

module.exports = role;
