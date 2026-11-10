/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('role.creep.defender');
 * mod.thing == 'a thing'; // true
 */

const role = {
    RoleName: "Defender",
    Tick: function (creep) {
        let target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {
            filter: (c) => c.owner.username === "Invader" || c.owner.username === "Source Keeper" || Memory.enemies.includes(c.owner.username)
        });
        if (target) {
            const attackResult = creep.attack(target);
            if (attackResult === ERR_NOT_IN_RANGE) creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
        }
        if (!target) {
            target = Game.flags[creep.name];
            if (!target) target = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (target) creep.moveTo(target, { visualizePathStyle: { stroke: '#0000ff' } });
        }
    }
};

module.exports = role;
