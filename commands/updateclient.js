const Command = require("../base/Command");

class UpdateClient extends Command {
    constructor(client) {
        super(client, {
            name: "updateclient",
            category: "Dev",
            enabled: true, 
            aliases: ["uc"],
            permLevel: 10
        });
    }

    async run(client, message) { // eslint-disable-line no-unused-vars
        let msg = null;
        try {
            msg = await message.channel.send("Updating client - please wait...");
        } catch (e) { 
            console.log("Error updating client: " + e); 
        }

        try {
            if (client.config.swgohAPILoc && client.config.swgohAPILoc !== "") {
                let result = await client.swgohAPI.updateRawClient({force: true});
                result = !result ? "Client is already up-to-date" : "Client has been updated";
                msg.edit(result);
            } else {
                message.channel.send(`I'm sorry ${message.author.displayName}, but I can't let you do that`);
            }
        } catch (e) {
            msg.edit("Game data could not be updated");
            console.log("Error updating client: " + e); 
        }
    }
}

module.exports = UpdateClient;

