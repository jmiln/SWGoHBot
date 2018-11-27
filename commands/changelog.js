const Command = require("../base/Command");

class Changelog extends Command {
    constructor(client) {
        super(client, {
            name: "changelog",
            category: "Dev",
            permLevel: 10
        });
    }

    run(client, message) {
        let logMsg = message.content.split(" ");
        logMsg.splice(0, 1);
        logMsg = logMsg.join(" ");

        // Adds it to the db with an auto-incrementing ID
        client.database.models.changelogs.create({
            logText: logMsg
        }).then(log => {
            // If it's set up, send the changelog to a Discord channel
            if (client.config.changelog.sendChangelogs) {
                const logID = log.dataValues.id;
                const clMessage = `[${client.myTime()}]\n${logMsg
                    .replace("[Fixed]",   "**[Fixed]**")
                    .replace("[Updated]", "**[Updated]**")
                    .replace("[Added]",   "**[Added]**")
                    .replace("[Removed]", "**[Removed]**")
                    .replace("[Changed]", "**[Changed]**")}`;
                client.sendChangelog(clMessage + "\nAlso listed at https://swgohbot.com/changelogs/" + logID);
            }
        });
    }
}

module.exports = Changelog;
