// Copied from https://github.com/AnIdiotsGuide/guidebot/blob/class-v13-update/commands/deploy.js
const Command = require("../base/Command.js");

class Deploy extends Command {
    constructor(client) {
        super(client, {
            name: "deploy",
            description: "This will deploy all slash commands.",
            category: "System",
            usage: "deploy",
            aliases: ["d"],
            enabled: true
        });
    }

    async run(Bot, message, args, options) { // eslint-disable-line no-unused-vars
    // Filter the slash commands to find guild only ones.
        const guildCmds = message.client.slashcmds.filter(c => c.guildOnly).map(c => c.commandData);

        // Now we filter out global commands by inverting the filter.
        const globalCmds = message.client.slashcmds.filter(c => !c.guildOnly).map(c => c.commandData);

        // Give the user a notification the commands are deploying.
        await message.channel.send("Deploying commands!");

        // We'll use set but please keep in mind that `set` is overkill for a singular command.
        // Set the guild commands like this.
        await message.client.guilds.cache.get(message.guild.id)?.commands.set(guildCmds);

        // Then set the global commands like this.
        await message.client.application?.commands.set(globalCmds).catch(e => console.log(e));

        // Reply to the user that the commands have been deployed.
        await message.channel.send("All commands deployed!");
    }
}

module.exports = Deploy;
