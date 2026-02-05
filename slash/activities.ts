import { ApplicationCommandOptionType, codeBlock, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import { getCurrentWeekday } from "../modules/functions.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

export default class Activites extends Command {
    static readonly metadata = {
        name: "activities",
        description: "Shows daily guild activities",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "day",
                type: ApplicationCommandOptionType.String,
                description: "Day of the week",
                choices: [
                    { name: "Sunday", value: "day_Sunday" },
                    { name: "Monday", value: "day_Monday" },
                    { name: "Tuesday", value: "day_Tuesday" },
                    { name: "Wednesday", value: "day_Wednesday" },
                    { name: "Thursday", value: "day_Thursday" },
                    { name: "Friday", value: "day_Friday" },
                    { name: "Saturday", value: "day_Saturday" },
                ],
            },
        ],
    };

    constructor(Bot: BotType) {
        super(Bot, Activites.metadata);
    }

    async run(_Bot: BotType, interaction: BotInteraction) {
        const guildConf = interaction.guildSettings;

        let day = interaction.options.getString("day");

        if (!day) {
            const weekday = getCurrentWeekday(guildConf?.timezone || null);
            day = `day_${weekday}`;
        }

        const langKey = `COMMAND_ACTIVITIES_${day?.split("_")[1].toUpperCase()}`;
        const message = interaction.language.get(langKey);
        return interaction.reply({ content: codeBlock("asciiDoc", message) });
    }
}
