// Based on the watcher at:
// https://github.com/NeonWizard/sockbot-discord/blob/main/src/modules/wspatch.ts

// This is run from the Bot's ready event file
// Most logs disabled to avoid extra spam

const { Status }= require("discord.js");

const CUTOFF_VALUE = 100; // In milliseconds
const STARTING_CHECK_TIME = 5 * 60 * 1000; // In milliseconds
let timeToNextCheck = STARTING_CHECK_TIME;

let lastPing = -1; // Last websocket ping recorded

module.exports = async function checkWSHealth(client) {
    // Check connection status
    if (client.ws.status !== Status.Idle && client.ws.status !== Status.Ready) {
        console.warn(`[${client.shard.id}] Websocket status not in a good state: ${Status[client.ws.status.toString()]}`);
        // If it's not healthy, restart the shard
        process.exit(0);
    }

    const ping = client.ws.ping;

    // Heartbeat
    if (ping <= 0) {
        console.warn(`  [${client.shard.id}] Websocket ping is unacceptable: ${ping}`);
    } else {
        // console.log(`[${client.shard.ids[0]}] Current ping: ${ping}`);

        if (lastPing !== ping) {
            // If the ping is different than last time, set/ reset the next check time to the default
            timeToNextCheck = STARTING_CHECK_TIME;
        } else {
            // If it's the same, then the next run will be twice as soon
            timeToNextCheck /= 2;
            // If check interval under a certain value (ping has been the same for a while), restart
            if (timeToNextCheck < CUTOFF_VALUE) {
                console.error(`  [${client.shard.id}] Ping has remained the same (${ping}) for about ${((STARTING_CHECK_TIME * 2) / 1000 / 60) } minutes, restarting!`);
                process.exit(0);
            }
            // console.warn(`[${client.shard.id}] Possible issue... Ping remained the same (${ping}) as the last check. Next check in ${(timeToNextCheck / 2 / 1000)} seconds.`);
        }
        lastPing = ping;
    }

    setTimeout(() => checkWSHealth(client), timeToNextCheck);
};
