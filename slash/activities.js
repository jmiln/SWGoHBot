const { ApplicationCommandOptionType, codeBlock } = require("discord.js");
const Command = require("../base/slashCommand");

class Activites extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "activities",
            description: "Shows daily guild activities",
            guildOnly: false,
            options: [
                {
                    name: "day",
                    type: ApplicationCommandOptionType.String,
                    description: "Day of the week",
                    choices: [
                        {
                            name: "Sunday",
                            value: "day_Sunday",
                        },
                        {
                            name: "Monday",
                            value: "day_Monday",
                        },
                        {
                            name: "Tuesday",
                            value: "day_Tuesday",
                        },
                        {
                            name: "Wednesday",
                            value: "day_Wednesday",
                        },
                        {
                            name: "Thursday",
                            value: "day_Thursday",
                        },
                        {
                            name: "Friday",
                            value: "day_Friday",
                        },
                        {
                            name: "Saturday",
                            value: "day_Saturday",
                        },
                    ],
                },
            ],
        });
    }

    async run(Bot, interaction) {
        const guildConf = interaction.guildSettings;

        let day = interaction.options.getString("day");

        if (!day) {
            if (!guildConf?.timezone) {
                day = `day_${Bot.toProperCase(Bot.getCurrentWeekday())}`;
            } else {
                day = `day_${Bot.toProperCase(Bot.getCurrentWeekday(guildConf.timezone))}`;
            }
        }

        switch (day) {
            case "day_Sunday":
                return interaction.reply({ content: codeBlock("asciiDoc", interaction.language.get("COMMAND_ACTIVITIES_SUNDAY")) });
            case "day_Monday":
                return interaction.reply({ content: codeBlock("asciiDoc", interaction.language.get("COMMAND_ACTIVITIES_MONDAY")) });
            case "day_Tuesday":
                return interaction.reply({ content: codeBlock("asciiDoc", interaction.language.get("COMMAND_ACTIVITIES_TUESDAY")) });
            case "day_Wednesday":
                return interaction.reply({ content: codeBlock("asciiDoc", interaction.language.get("COMMAND_ACTIVITIES_WEDNESDAY")) });
            case "day_Thursday":
                return interaction.reply({ content: codeBlock("asciiDoc", interaction.language.get("COMMAND_ACTIVITIES_THURSDAY")) });
            case "day_Friday":
                return interaction.reply({ content: codeBlock("asciiDoc", interaction.language.get("COMMAND_ACTIVITIES_FRIDAY")) });
            case "day_Saturday":
                return interaction.reply({ content: codeBlock("asciiDoc", interaction.language.get("COMMAND_ACTIVITIES_SATURDAY")) });
        }
    }
}
module.exports = Activites;
