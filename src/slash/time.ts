import moment from "moment-timezone";

import SlashCommand from "../base/slashCommand";

class Time extends SlashCommand {
    constructor(Bot) {
        super(Bot, {
            name: "time",
            category: "Misc",
            guildOnly: false,
            options: [
                {
                    name: "timezone",
                    type: "STRING",
                    description: "A valid timezone to view"
                }
            ]
        });
    }

    run(Bot, interaction) {
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
