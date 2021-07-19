const Command = require("../base/Command");
var moment = require("moment-timezone");

class Challenges extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "challenges",
            category: "Star Wars",
            aliases: ["challenge", "chal"]
        });
    }

    run(Bot, message, args) {
        const guildConf = message.guildSettings;

        const challenges = {
            // Normal Challenges
            [message.language.get("COMMAND_CHALLENGES_TRAINING")]: ["Sunday", "Monday",    "Saturday"],
            [message.language.get("COMMAND_CHALLENGES_ABILITY")] : ["Sunday", "Wednesday", "Saturday"],
            [message.language.get("COMMAND_CHALLENGES_BOUNTY")]  : ["Sunday", "Tuesday",   "Friday"],
            [message.language.get("COMMAND_CHALLENGES_AGILITY")] : ["Sunday", "Tuesday",   "Friday"],
            [message.language.get("COMMAND_CHALLENGES_STRENGTH")]: ["Sunday", "Monday",    "Thursday"],
            [message.language.get("COMMAND_CHALLENGES_TACTICS")] : ["Sunday", "Wednesday", "Saturday"],

            // Ship Challenges
            [message.language.get("COMMAND_CHALLENGES_SHIP_ENHANCEMENT")]: ["Monday", "Wednesday", "Saturday"],
            [message.language.get("COMMAND_CHALLENGES_SHIP_BUILDING")]   : ["Monday", "Tuesday",   "Friday"],
            [message.language.get("COMMAND_CHALLENGES_SHIP_ABILITY")]    : ["Monday", "Thursday",  "Sunday"]
        };

        const dayString = (day) => {
            let dayString = `== Challenges for ${message.language.getDay(day.toUpperCase(), "LONG").toProperCase()} ==`;
            for (var challenge in challenges) {
                if (challenges[challenge].includes(day)) {
                    dayString += `\n* ${challenge}`;
                }
            }
            return dayString;
        };

        let day;
        if (!args[0]) {
            if (!guildConf["timezone"]) {
                day = moment().format("ddd").toProperCase();
            } else {
                day = moment().tz(guildConf["timezone"]).format("ddd").toProperCase();
            }
        } else {
            day = String(args[0]).toProperCase();
        }

        switch (day) {
            case message.language.getDay("SUNDAY", "SHORT"): case  message.language.getDay("SUNDAY", "LONG"): case "Sun":
                return sendDay("Sunday");
            case message.language.getDay("MONDAY", "SHORT"): case message.language.getDay("MONDAY", "LONG"): case "Mon":
                return sendDay("Monday");
            case message.language.getDay("TUESDAY", "SHORT"): case  message.language.getDay("TUESDAY", "LONG"): case "Tue":
                return sendDay("Tuesday");
            case message.language.getDay("WEDNESDAY", "SHORT"): case message.language.getDay("WEDNESDAY", "LONG"): case "Wed":
                return sendDay("Wednesday");
            case message.language.getDay("THURSDAY", "SHORT"): case message.language.getDay("THURSDAY", "LONG"): case "Thu":
                return sendDay("Thursday");
            case message.language.getDay("FRIDAY", "SHORT"): case message.language.getDay("FRIDAY", "LONG"): case "Fri":
                return sendDay("Friday");
            case message.language.getDay("SATURDAY", "SHORT"): case message.language.getDay("SATURDAY", "LONG"): case "Sat":
                return sendDay("Saturday");
            default:
                return Bot.helpOut(message, this);
        }
        function sendDay(day) {
            return message.channel.send({content: Bot.codeBlock(dayString(day), "asciidoc")});
        }
    }
}

module.exports = Challenges;
