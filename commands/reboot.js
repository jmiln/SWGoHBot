const Command = require("../base/Command");

class Reboot extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "reboot",
            category: "Dev",
            enabled: true,
            permLevel: 10
        });
    }

    async run(Bot, message, [action, ...args], options) { // eslint-disable-line no-unused-vars
        const client = message.client;
        const res = await Bot.awaitReply(message, "Are you sure you want to reboot?");
        if (res && ["y", "yes"].includes(res)) {
            message.reply("Rebooting now");
            if (client.shard) {
                await client.shard.broadcastEval("process.exit(0)");
            } else {
                process.exit(0);
            }
        }
        return message.reply("Reboot aborted.");
    }
}

module.exports = Reboot;

