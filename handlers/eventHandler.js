const {readdirSync} = require("node:fs");
const needsClient = ["error", "ready", "interactionCreate", "messageCreate", "guildMemberAdd", "guildMemberRemove"];
const evDir = `${__dirname}/../events/`;

module.exports = (Bot, client) => {
    const evtFiles = readdirSync(evDir);
    for (const file of evtFiles) {
        const eventName = file.split(".")[0];
        const event = require(`${evDir}${file}`);
        if (needsClient.includes(eventName)) {
            client.on(eventName, event.bind(null, Bot, client));
        } else {
            client.on(eventName, event.bind(null, Bot));
        }
        delete require.cache[require.resolve(`${evDir}${file}`)];
    }

    // Reload the events files (message, guildCreate, etc)
    client.reloadAllEvents = async () => {
        const ev = []
        const errEv = [];

        const evtFiles = await readdirSync(evDir);
        for (const file of evtFiles) {
            try {
                const eventName = file.split(".")[0];
                client.removeAllListeners(eventName);
                const event = require(`${evDir}${file}`);
                if (needsClient.includes(eventName)) {
                    client.on(eventName, event.bind(null, Bot, client));
                } else {
                    client.on(eventName, event.bind(null, Bot));
                }
                delete require.cache[require.resolve(`${evDir}${file}`)];
                ev.push(eventName);
            } catch (e) {
                Bot.logger.error(`In Event reload: ${e}`);
                errEv.push(file);
            }
        }
        return {
            succArr: ev,
            errArr: errEv
        };
    };
};



