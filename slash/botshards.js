const { Status, codeBlock } = require("discord.js");
const Command = require("../base/slashCommand");

class BotShards extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "botshards",
            guildOnly: false,
            options: [],
        });
    }

    async run(Bot, interaction) {
        const shardInfoArr = ["Shard | Status | Guilds | Ping", "______________________________"];

        const shardCount = interaction.client.shard.count;
        interaction.client.shard
            .broadcastEval((client) => [client.shard.ids, client.ws.status, client.ws.ping, client.guilds.cache.size])
            .then((results) => {
                for (const data of results) {
                    const [id, status, ping, size] = data;
                    shardInfoArr.push(
                        [
                            `${(Number.parseInt(id[0], 10) + 1).toString().padStart(2)}/${shardCount}`,
                            Status[status.toString()].padStart(6),
                            `${size.toString().padStart(5)} `,
                            `${ping} ms`,
                        ].join(" | "),
                    );
                }
                interaction.reply({ content: codeBlock("prolog", shardInfoArr.join("\n")) });
            })
            .catch((error) => {
                console.error(error);
                interaction.reply("❌ Error.");
            });
    }
}

module.exports = BotShards;
