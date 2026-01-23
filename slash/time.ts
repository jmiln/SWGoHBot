import { ApplicationCommandOptionType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { formatCurrentTime, isValidZone } from "../modules/functions.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

export default class Time extends Command {
    constructor(Bot: BotType) {
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

    run(Bot: BotType, interaction: BotInteraction) {
        const guildConf = interaction.guildSettings;
        const timezone = interaction.options.getString("timezone");

        if (timezone && isValidZone(timezone)) {
            return interaction.reply({
                content: interaction.language.get("COMMAND_TIME_CURRENT", formatCurrentTime(timezone), timezone),
            });
        }

        if (guildConf?.timezone && isValidZone(guildConf.timezone)) {
            // If we got here because timezone above had issues, say so, but if it's just here because they left it empty, don'tcomplain
            if (timezone?.length) {
                return super.error(interaction, interaction.language.get("COMMAND_TIME_INVALID_ZONE", formatCurrentTime(guildConf.timezone)));
            }
            return interaction.reply({
                content: `Here's your guild's default time:\n${interaction.language.get(
                    "COMMAND_TIME_CURRENT",
                    formatCurrentTime(guildConf.timezone),
                    guildConf.timezone,
                )}`,
            });
        }

        // Otherwise, no valid zone was available, so note that and spit out whatever default zone the bot has
        return super.error(
            interaction,
            `I couldn't find a valid timezone to match your request, so this is my default one:\n${interaction.language.get(
                "COMMAND_TIME_INVALID_ZONE",
                formatCurrentTime("UTC"),
            )}`,
        );
    }
}
