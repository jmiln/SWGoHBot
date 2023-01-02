const { Status } = require("discord.js");
const Command = require("../base/slashCommand");

class BotShards extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "botshards",
            guildOnly: false,
            options: []
        });
    }

    async run(Bot, interaction) {
        const shardInfoArr = [
            "Shard | Status | Guilds | Ping",
            "______________________________"
        ];

        const shardCount = interaction.client.shard.count;
        interaction.client.shard.broadcastEval(client => [client.shard.ids, client.ws.status, client.ws.ping, client.guilds.cache.size])
            .then((results) =>{
                results.forEach((data) => {
                    const [id, status, ping, size] = data;
                    shardInfoArr.push([
                        `${(parseInt(id[0], 10)+1).toString().padStart(2)}/${shardCount}`,
                        Status[status.toString()].padStart(6),
                        size.toString().padStart(5) + " ",
                        `${ping} ms`
                    ].join(" | "));
                });
                interaction.reply({ content: Bot.codeBlock(shardInfoArr.join("\n"), "prolog") });
            })
            .catch((error) => {
                console.error(error);
                interaction.reply("❌ Error.");
            });
    }
}

module.exports = BotShards;
