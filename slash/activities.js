var moment = require("moment-timezone");
const Command = require("../base/slashCommand");

class Activites extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "activities",
            description: "Shows daily guild activities",
            category: "Star Wars",
            aliases: ["act"],
            guildOnly: false,
            options: [{
                name: "day",
                type: "STRING",
                description: "Day of the week",
                choices: [
                    {
                        name: "Sunday",
                        value: "day_Sunday",
                    },
                    {
                        name: "Monay",
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
                    }
                ],
            }]
        });
    }

    async run(Bot, interaction) {
        const guildConf = interaction.guildSettings;

        let day = interaction.options.getString("day");

        if (!day) {
            if (!guildConf["timezone"]) {
                day = "day_" + Bot.toProperCase(moment().format("dddd"));
            } else {
                day = "day_" + Bot.toProperCase(moment().tz(guildConf["timezone"]).format("dddd"));
            }
        }

        switch (day) {
            case "day_Sunday":
                return interaction.reply({content: Bot.codeBlock(interaction.language.get("COMMAND_ACTIVITIES_SUNDAY"), "asciidoc")});
            case "day_Monday":
                return interaction.reply({content: Bot.codeBlock(interaction.language.get("COMMAND_ACTIVITIES_MONDAY"), "asciidoc")});
            case "day_Tuesday":
                return interaction.reply({content: Bot.codeBlock(interaction.language.get("COMMAND_ACTIVITIES_TUESDAY"), "asciidoc")});
            case "day_Wednesday":
                return interaction.reply({content: Bot.codeBlock(interaction.language.get("COMMAND_ACTIVITIES_WEDNESDAY"), "asciidoc")});
            case "day_Thursday":
                return interaction.reply({content: Bot.codeBlock(interaction.language.get("COMMAND_ACTIVITIES_THURSDAY"), "asciidoc")});
            case "day_Friday":
                return interaction.reply({content: Bot.codeBlock(interaction.language.get("COMMAND_ACTIVITIES_FRIDAY"), "asciidoc")});
            case "day_Saturday":
                return interaction.reply({content: Bot.codeBlock(interaction.language.get("COMMAND_ACTIVITIES_SATURDAY"), "asciidoc")});
        }
    }
}
module.exports = Activites;
