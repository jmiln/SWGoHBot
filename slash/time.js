const { ApplicationCommandOptionType } = require("discord.js");

const Command = require("../base/slashCommand");

class Time extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "time",
            guildOnly: false,
            options: [
                {
                    name: "timezone",
                    type: ApplicationCommandOptionType.String,
                    description: "A valid timezone to view",
                },
            ],
        });
    }

    run(Bot, interaction) {
        const guildConf = interaction.guildSettings;
        const timezone = interaction.options.getString("timezone");

        if (timezone && Bot.isValidZone(timezone)) {
            return interaction.reply({
                content: interaction.language.get("COMMAND_TIME_CURRENT", Bot.formatCurrentTime(timezone), timezone),
            });
        }

        if (guildConf?.timezone && Bot.isValidZone(guildConf.timezone)) {
            // If we got here because timezone above had issues, say so, but if it's just here because they left it empty, don'tcomplain
            if (timezone?.length) {
                return super.error(interaction, interaction.language.get("COMMAND_TIME_INVALID_ZONE", Bot.formatCurrentTime()));
            }
            return interaction.reply({
                content: `Here's your guild's default time:\n${interaction.language.get(
                    "COMMAND_TIME_CURRENT",
                    Bot.formatCurrentTime(guildConf.timezone),
                    guildConf.timezone,
                )}`,
            });
        }

        // Otherwise, no valid zone was available, so note that and spit out whatever default zone the bot has
        return super.error(
            interaction,
            `I couldn't find a valid timezone to match your request, so this is my default one:\n${interaction.language.get(
                "COMMAND_TIME_INVALID_ZONE",
                Bot.formatCurrentTime(),
            )}`,
        );
    }
}

module.exports = Time;
