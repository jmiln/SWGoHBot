const Command = require("../base/Command");

class Changelog extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "changelog",
            category: "Dev",
            permLevel: 10
        });
    }

    async run(Bot, message) {
        let logMsg = message.content.split(" ");
        logMsg.splice(0, 1);
        logMsg = logMsg.join(" ");

        if (!logMsg.length) {
            return super.error(message, "Missing log message");
        }

        // Adds it to the db with an auto-incrementing ID
        Bot.database.models.changelogs.create({
            logText: logMsg
        }).then(log => {
            // If it's set up, send the changelog to all qualifying webhooks
            if (Bot.config.changelog.sendChangelogs) {
                const logEmbed = parseLog(logMsg);
                logEmbed.footer = {text: "Also listed at https://swgohbot.com/changelog/" + log.dataValues.id};
                logEmbed.author.url = "https://swgohbot.com/changelog/" + log.dataValues.id;

                // Get a list of all the webhook urls that have been set up
                const Sequelize = require("sequelize");
                Bot.database.query("select \"changelogWebhook\" from settings where \"changelogWebhook\" <> '';", {type: Sequelize.QueryTypes.SELECT})
                    .then(hookList => {
                        // Send the changelog to each specified webhook
                        for (const hook of hookList) {
                            try {
                                Bot.sendWebhook(hook.changelogWebhook, logEmbed);
                            } catch (e) {
                                // Just let it error, just means it won't send the hook
                            }
                        }
                    });
            }
        });

        function parseLog(msg) {
            const lines = msg.split("\n");
            const obj = {};
            let lastT = "";
            for (const line of lines) {
                const t = line.trim();
                if (t.startsWith("[") && t.endsWith("]")) {
                    obj[t] = [];
                    lastT = t;
                } else if (!lastT) {
                    continue;
                } else {
                    obj[lastT].push(Bot.expandSpaces(line));
                }
            }
            const embed = {
                author: {
                    name: "Changelog",
                    url: ""
                },
                fields: []
            };
            for (const title of Object.keys(obj)) {
                embed.fields.push({name: title, value: obj[title].join("\n")});
            }
            return embed;
        }
    }
}

module.exports = Changelog;
