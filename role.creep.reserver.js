/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.claimer');
 * mod.thing == 'a thing'; // true
 */

role = {
    RoleName: "Reserver",
    Tick: function(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            console.log(`Claimer ${creep.name} has no targetRoom!`);
            return;
        }

        if (creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(27, 27, targetRoom), { visualizePathStyle: { stroke: '#ffffff' } });
        }
        if (creep.room.name === targetRoom) {
            if (creep.room.controller) {
                const reserveResult = creep.reserveController(creep.room.controller);
                if (reserveResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#00ff00' } });
                }
            } else {
                console.log(`Reserver ${creep.name} has reached target room ${targetRoom}, but there is no controller to reserve.`);
            }
        }
    }
};

module.exports = role;
