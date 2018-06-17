const Command = require('../base/Command');

class Changelog extends Command {
    constructor(client) {
        super(client, {
            name: "changelog",
            category: "Dev",
            permLevel: 10
        });
    }

    run(client, message) {
        let logMsg = message.content.split(' ');
        logMsg.splice(0, 1);
        logMsg = logMsg.join(' ');

        // If it's set up, send the changelog to a Discord channel
        if (client.config.changelog.sendChangelogs) {
            const clMessage = `[${client.myTime()}]\n${logMsg
                .replace('[Fixed]',   '**[Fixed]**')
                .replace('[Updated]', '**[Updated]**')
                .replace('[Added]',   '**[Added]**')
                .replace('[Removed]', '**[Removed]**')
                .replace('[Changed]', '**[Changed]**')}`;

            client.sendChangelog(clMessage);
        }

        // Adds it to the db with an auto-incrementing ID
        client.database.models.changelogs.create({
            logText: logMsg
        });
    }
}

module.exports = Changelog;
