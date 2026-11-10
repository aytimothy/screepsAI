# Screeps Bot

This is aytimothy's bot code. It is simple but does not cover the entire game yet. It functions purely on roles.

Enter `help()` in the console to see a list of commands.

Generally, the first few levels, you'll be leaving it for a few days to upgrade rooms.

### Roles

* Attacker - Attacks other players' rooms and structures
* Builder - Builds and repairs structures
* Claimer - Goes to a room and the claims the controller.
* Defender - Defends your rooms from attackers
* Harvester - Harvests energy from sources and deposits it into structures
* ForeignHarvester - A harvester but goes to a different room.
* Leech - A slightly better harvester but it hugs a source and deposits the energy into a container
* Looter - Goes to a room and loots structures and returning it to the home room's storage (if it has one).
* Reserver - A claimer but reserves a room instead.
* Traveller - Goes to a room and then turns to a different role upon arrival
* Worker - **Not a role** but base code for harvesters and builders.

You can control the size of your colony by modifying the spawn's `spawn.memory.targetPopulation` values. Likewise, you can change which source/building a worker (harvester or builder) repairs/builds/upgrade/refills by modifying its `creep.memory.target` or `creep.memory.source`.
