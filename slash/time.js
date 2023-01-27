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
                    description: "A valid timezone to view"
                }
            ]
        });
    }

    run(Bot, interaction) {
        const guildConf = interaction.guildSettings;
        const timezone = interaction.options.getString("timezone");

        if (timezone && isValidZone(timezone)) {
            return interaction.reply({
                content: interaction.language.get(
                    "COMMAND_TIME_CURRENT",
                    formatCurrentTime(timezone),
                    timezone
                )
            });
        }

        if (guildConf?.timezone && isValidZone(guildConf.timezone)) {
            // If we got here because timezone above had issues, say so, but if it's just here because they left it empty, don'tcomplain
            if (timezone?.length) {
                return super.error(
                    interaction,
                    interaction.language.get(
                        "COMMAND_TIME_INVALID_ZONE",
                        formatCurrentTime()
                    )
                );
            }
            return interaction.reply({
                content:
                "Here's your guild's default time:\n" +
                interaction.language.get(
                    "COMMAND_TIME_CURRENT",
                    formatCurrentTime(guildConf.timezone),
                    guildConf.timezone
                )
            });
        }

        // Otherwise, no valid zone was available, so note that and spit out whatever default zone the bot has
        return super.error(
            interaction,
            "I couldn't find a valid timezone to match your request, so this is my default one:\n" +
            interaction.language.get(
                "COMMAND_TIME_INVALID_ZONE",
                formatCurrentTime()
            )
        );

        function formatCurrentTime(zone) {
            if (!zone || !isValidZone(zone)) {
                // Format it with whatever zone the server is
                return Intl.DateTimeFormat("en", {year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric"}).format(new Date());
            }

            return Intl.DateTimeFormat("en", {year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", timeZone: zone}).format(new Date());
        }

        function isValidZone(zone) {
            // Check if the entered string is a valid timezone (According to Wikipedia's list), so go ahead and process
            return Bot.timezones.find(tz => tz.toLowerCase() === zone?.toLowerCase()) || false;
        }
    }
}

module.exports = Time;
