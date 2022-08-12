// const util = require("util");
const Command = require("../base/slashCommand");

class Showconf extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "showconf",
            guildOnly: false,
            permLevel: 3
        });
    }

    async run(Bot, interaction) {
        const guildID = interaction.guild.id;
        let guildName = "";

        // // If I or an adminHelper adds a guild ID here, pull up that instead
        // if (args[0] && options && options.level >= 9) {
        //     let found = false;
        //     if (!client.guilds.cache.has(args[0]) && client.shard) {
        //         const names = await client.shard.broadcastEval((client, args) => {
        //             if (client.guilds.cache.has(args[0])) {
        //                 return client.guilds.cache.get(args[0]).name;
        //             }
        //         }, {context: args});
        //         names.forEach(gName => {
        //             if (gName !== null) {
        //                 found = true;
        //                 guildName = gName;
        //             }
        //         });
        //     } else {
        //         guildName = client.guilds.cache.get(guildID).name;
        //         found = true;
        //     }
        //     if (found) {
        //         guildID = args[0];
        //     } else {
        //         return super.error(interaction, `Sorry, but I don't seem to be in the guild ${args[0]}.`);
        //     }
        //
        // } else {
        guildName = interaction.guild.name;
        // }

        const guildConf = await Bot.getGuildConf(guildID);

        var outArr = [];
        if (guildConf) {
            // TODO Make this show nicer instead of just a basic code block
            // Change it so adminRoles show the names instead of ID
            // Change eventCountdown so it shows just a list of numbers instead of as an array, same for the rest, make it look nicer instead of inspected strings and such
            for (const key of Object.keys(Bot.config.typedDefaultSettings)) {
                switch (key) {
                    case "adminRole": {
                        const roleArr = [];
                        if (guildConf.adminRole?.length) {
                            for (const role of guildConf.adminRole) {
                                if (Bot.isUserID(role)) {
                                    // If it's a role ID, try and get a name for it
                                    const roleName = await interaction.guild.roles.cache.find(r => r.id === role);
                                    roleArr.push(roleName.name);
                                } else {
                                    roleArr.push(role);
                                }
                            }
                            outArr.push(`* ${key}: \n${roleArr.sort().map(r => "  - " + r).join("\n")}`);
                        } else {
                            outArr.push(`* ${key}: N/A`);
                        }
                        break;
                    }
                    case "eventCountdown": {
                        if (guildConf.eventCountdown?.length) {
                            outArr.push(`* ${key}: ${guildConf.eventCountdown.join(", ")}`);
                        } else {
                            outArr.push(`* ${key}: N/A`);
                        }
                        break;
                    }
                    default:
                        outArr.push(`* ${key}: ${guildConf[key]}`);
                        break;
                }
            }
            var configKeys = outArr.join("\n");
            return interaction.reply({content: interaction.language.get("COMMAND_SHOWCONF_OUTPUT", configKeys, guildName)});
        } else {
            Bot.logger.error("Something broke in showconf");
        }
    }
}

module.exports = Showconf;
