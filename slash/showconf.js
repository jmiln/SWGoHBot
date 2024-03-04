// const util = require("util");
const Command = require("../base/slashCommand");
const { getServerSupporters, getGuildSupporterTier } = require("../modules/guildConfig/patreonSettings");
const { getGuildSettings } = require("../modules/guildConfig/settings.js");

class Showconf extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "showconf",
            guildOnly: false,
            permLevel: 3
        });
    }

    async run(Bot, interaction) {
        const guildConf = await getGuildSettings({cache: Bot.cache, guildId: interaction.guild.id});

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
                                    const roleRes = await interaction.guild.roles.cache.find(r => r.id === role);
                                    roleArr.push(roleRes?.name || role);
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

            const supporterList = [];
            const totalSuppTier = await getGuildSupporterTier({cache: Bot.cache, guildId: interaction.guild.id});
            const guildSupporters = await getServerSupporters({cache: Bot.cache, guildId: interaction.guild.id});
            for (const supp of guildSupporters) {
                const user = await interaction.guild.members.cache.get(supp.userId);
                if (!user?.displayName) continue;

                supporterList.push(user.displayName);
            }
            outArr.push(`* Current supporters${totalSuppTier > 0 && ` (Combined tier: $${totalSuppTier})`}: ${supporterList?.length ? "\n" : "N/A"}${supporterList.map(s => "  - " + s).join("\n")}`);

            return interaction.reply({content: interaction.language.get("COMMAND_SHOWCONF_OUTPUT", outArr.join("\n"), interaction.guild.name || "")});
        } else {
            Bot.logger.error("Something broke in showconf");
        }
    }
}

module.exports = Showconf;
