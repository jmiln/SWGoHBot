const util = require("util");
const Command = require("../base/Command");

class Showconf extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "showconf",
            aliases: ["showconfs", "showconfig", "showconfigs"],
            category: "Admin",
            permLevel: 3
        });
    }

    async run(Bot, message, args, options) {
        let guildID = message.guild.id;
        let guildName = "";
        const client = message.client;

        // If I or an adminHelper adds a guild ID here, pull up that instead
        if (args[0] && options && options.level >= 9) {
            let found = false;
            if (!client.guilds.cache.has(args[0]) && client.shard) {
                const names = await client.shard.broadcastEval(`
                    if (this.guilds.cache.has('${args[0]}')) {
                        this.guilds.cache.get('${args[0]}').name;
                    }
                `);
                names.forEach(gName => {
                    if (gName !== null) {
                        found = true;
                        guildName = gName;
                    }
                });
            } else {
                guildName = client.guilds.cache.get(guildID).name;
                found = true;
            }
            if (found) {
                guildID = args[0];
            } else {
                return super.error(message, `Sorry, but I don't seem to be in the guild ${args[0]}.`);
            }

        } else {
            guildName = message.guild.name;
        }

        const guildConf = await Bot.getGuildConf(guildID);

        var array = [];
        if (guildConf) {
            for (const key of Object.keys(guildConf)) {
                array.push(`* ${key}: ${util.inspect(guildConf[key])}`);
            }
            var configKeys = array.join("\n");
            return message.channel.send(message.language.get("COMMAND_SHOWCONF_OUTPUT", configKeys, guildName));
        } else {
            Bot.logger.error("Something broke in showconf");
        }
    }
}

module.exports = Showconf;
