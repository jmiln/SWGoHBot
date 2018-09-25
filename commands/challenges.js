const Command = require("../base/Command");
var moment = require("moment-timezone");

class Challenges extends Command {
    constructor(client) {
        super(client, {
            name: "challenges",
            category: "Star Wars",
            aliases: ["challenge", "chal"]
        });
    }

    run(client, message, args) {
        const guildConf = message.guildSettings;

        const challenges = {
            // Normal Challenges
            [message.language.get("COMMAND_CHALLENGES_TRAINING")]: ["Sunday", "Monday", "Saturday"],
            [message.language.get("COMMAND_CHALLENGES_ABILITY")] : ["Sunday", "Wednesday", "Saturday"],
            [message.language.get("COMMAND_CHALLENGES_BOUNTY")]  : ["Sunday", "Tuesday", "Friday"],
            [message.language.get("COMMAND_CHALLENGES_AGILITY")] : ["Sunday", "Tuesday", "Friday"],
            [message.language.get("COMMAND_CHALLENGES_STRENGTH")]: ["Sunday", "Monday", "Thursday"],
            [message.language.get("COMMAND_CHALLENGES_TACTICS")] : ["Sunday", "Wednesday", "Saturday"],
        
            // Ship Challenges
            [message.language.get("COMMAND_CHALLENGES_SHIP_ENHANCEMENT")]: ["Monday", "Wednesday", "Saturday"],
            [message.language.get("COMMAND_CHALLENGES_SHIP_BUILDING")]   : ["Monday", "Tuesday", "Friday"],
            [message.language.get("COMMAND_CHALLENGES_SHIP_ABILITY")]    : ["Monday", "Thursday", "Sunday"]
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
                return message.channel.send(dayString("Sunday"), {code:"asciidoc"});
            case message.language.getDay("MONDAY", "SHORT"): case message.language.getDay("MONDAY", "LONG"): case "Mon":
                return message.channel.send(dayString("Monday"), {code:"asciidoc"});
            case message.language.getDay("TUESDAY", "SHORT"): case  message.language.getDay("TUESDAY", "LONG"): case "Tue":
                return message.channel.send(dayString("Tuesday"), {code:"asciidoc"});
            case message.language.getDay("WEDNESDAY", "SHORT"): case message.language.getDay("WEDNESDAY", "LONG"): case "Wed":
                return message.channel.send(dayString("Wednesday"), {code:"asciidoc"});
            case message.language.getDay("THURSDAY", "SHORT"): case message.language.getDay("THURSDAY", "LONG"): case "Thu":
                return message.channel.send(dayString("Thursday"), {code:"asciidoc"});
            case message.language.getDay("FRIDAY", "SHORT"): case message.language.getDay("FRIDAY", "LONG"): case "Fri":
                return message.channel.send(dayString("Friday"), {code:"asciidoc"});
            case message.language.getDay("SATURDAY", "SHORT"): case message.language.getDay("SATURDAY", "LONG"): case "Sat":
                return message.channel.send(dayString("Saturday"), {code:"asciidoc"});
            default:
                return client.helpOut(message, this);
        }
    }
}

module.exports = Challenges;
