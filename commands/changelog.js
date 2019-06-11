const Command = require("../base/Command");

class Changelog extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "changelog",
            category: "Dev",
            permLevel: 10
        });
    }

    run(Bot, message) {
        let logMsg = message.content.split(" ");
        logMsg.splice(0, 1);
        logMsg = logMsg.join(" ");

        // Adds it to the db with an auto-incrementing ID
        Bot.database.models.changelogs.create({
            logText: logMsg
        }).then(log => {
            // If it's set up, send the changelog to a Discord channel
            if (Bot.config.changelog.sendChangelogs) {
                const logID = log.dataValues.id;
                const clMessage = `[${Bot.myTime()}]\n${logMsg
                    .replace("[Fixed]",   "**[Fixed]**")
                    .replace("[Updated]", "**[Updated]**")
                    .replace("[Added]",   "**[Added]**")
                    .replace("[Removed]", "**[Removed]**")
                    .replace("[Changed]", "**[Changed]**")}`;
                Bot.sendChangelog(clMessage + "\nAlso listed at https://swgohbot.com/changelog/" + logID);
            }
        });
    }
}

module.exports = Changelog;
