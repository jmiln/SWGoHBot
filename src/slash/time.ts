import { Interaction } from "discord.js";
import moment from "moment-timezone";

import SlashCommand from "../base/slashCommand";
import { BotInteraction, BotType } from "../modules/types";

class Time extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "time",
            category: "Misc",
            guildOnly: false,
            options: [
                {
                    name: "timezone",
                    type: Bot.constants.optionType.STRING,
                    description: "A valid timezone to view"
                }
            ]
        });
    }

    run(Bot: BotType, interaction: BotInteraction) {
        const guildConf = interaction.guildSettings;
        const timezone = interaction.options.getString("timezone");

        if (timezone) {
            if (moment.tz.zone(timezone)) { // Valid time zone
                return interaction.reply({content: interaction.language.get("COMMAND_TIME_CURRENT", moment.tz(timezone).format("DD/MM/YYYY [at] H:mm:ss"), timezone)});
            } else { // Not so valid
                return super.error(interaction, interaction.language.get("COMMAND_TIME_INVALID_ZONE", moment.tz(guildConf["timezone"]).format("DD/MM/YYYY [at] H:mm:ss"), guildConf["timezone"]));
            }
        }

        if (!guildConf["timezone"]) {
            return interaction.reply({content: interaction.language.get("COMMAND_TIME_NO_ZONE", moment().format("DD/MM/YYYY [at] H:mm:ss"))});
        } else {
            return interaction.reply({content: interaction.language.get("COMMAND_TIME_WITH_ZONE", moment.tz(guildConf["timezone"]).format("DD/MM/YYYY [at] H:mm:ss"), guildConf["timezone"])});
        }
    }
}

module.exports = Time;
