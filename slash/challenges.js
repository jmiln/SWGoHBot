const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class Challenges extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "challenges",
            description: "Show daily guild challenges",
            guildOnly: false,
            options: [{
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
                    }
                ],
            }]
        });
    }

    run(Bot, interaction) {
        const guildConf = interaction.guildSettings;

        const challenges = {
            // Normal Challenges
            [interaction.language.get("COMMAND_CHALLENGES_TRAINING")]: ["Sunday", "Monday",    "Saturday"],
            [interaction.language.get("COMMAND_CHALLENGES_ABILITY")] : ["Sunday", "Wednesday", "Saturday"],
            [interaction.language.get("COMMAND_CHALLENGES_BOUNTY")]  : ["Sunday", "Tuesday",   "Friday"],
            [interaction.language.get("COMMAND_CHALLENGES_AGILITY")] : ["Sunday", "Tuesday",   "Friday"],
            [interaction.language.get("COMMAND_CHALLENGES_STRENGTH")]: ["Sunday", "Monday",    "Thursday"],
            [interaction.language.get("COMMAND_CHALLENGES_TACTICS")] : ["Sunday", "Wednesday", "Saturday"],

            // Ship Challenges
            [interaction.language.get("COMMAND_CHALLENGES_SHIP_ENHANCEMENT")]: ["Monday", "Wednesday", "Saturday"],
            [interaction.language.get("COMMAND_CHALLENGES_SHIP_BUILDING")]   : ["Monday", "Tuesday",   "Friday"],
            [interaction.language.get("COMMAND_CHALLENGES_SHIP_ABILITY")]    : ["Monday", "Thursday",  "Sunday"]
        };

        const dayString = (day) => {
            let dayString = `== Challenges for ${Bot.toProperCase(interaction.language.getDay(day.toUpperCase(), "LONG"))} ==`;
            for (var challenge in challenges) {
                if (challenges[challenge].includes(day)) {
                    dayString += `\n* ${challenge}`;
                }
            }
            return dayString;
        };

        let day = interaction.options.getString("day");

        if (!day) {
            if (!guildConf?.timezone) {
                day = "day_" + Bot.toProperCase(Bot.getCurrentWeekday());
            } else {
                day = "day_" + Bot.toProperCase(Bot.getCurrentWeekday(guildConf.timezone));
            }
        }

        switch (day) {
            case "day_Sunday":
                return sendDay("Sunday");
            case "day_Monday":
                return sendDay("Monday");
            case "day_Tuesday":
                return sendDay("Tuesday");
            case "day_Wednesday":
                return sendDay("Wednesday");
            case "day_Thursday":
                return sendDay("Thursday");
            case "day_Friday":
                return sendDay("Friday");
            case "day_Saturday":
                return sendDay("Saturday");
        }
        function sendDay(day) {
            return interaction.reply({content: Bot.codeBlock(dayString(day), "asciidoc")});
        }
    }
}

module.exports = Challenges;
