var moment = require("moment-timezone");
const Command = require("../base/Command");

class Activites extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "activities",
            category: "Star Wars",
            aliases: ["act"]
        });
    }

    run(Bot, message, args) {
        const guildConf = message.guildSettings;

        let day = "";

        if (!args[0]) {
            if (!guildConf["timezone"]) {
                day = Bot.toProperCase(moment().format("ddd"));
            } else {
                day = Bot.toProperCase(moment().tz(guildConf["timezone"]).format("ddd"));
            }
        } else {
            day = Bot.toProperCase(String(args[0]));
        }

        switch (day) {
            case message.language.getDay("SUNDAY", "SHORT"): case message.language.getDay("SUNDAY", "LONG"): case "Sun":
                message.channel.send({content: Bot.codeBlock(message.language.get("COMMAND_ACTIVITIES_SUNDAY"), "asciidoc")});
                break;
            case message.language.getDay("MONDAY", "SHORT"): case message.language.getDay("MONDAY", "LONG"): case "Mon":
                message.channel.send({content: Bot.codeBlock(message.language.get("COMMAND_ACTIVITIES_MONDAY"), "asciidoc")});
                break;
            case message.language.getDay("TUESDAY", "SHORT"): case message.language.getDay("TUESDAY", "LONG"): case "Tue":
                message.channel.send({content: Bot.codeBlock(message.language.get("COMMAND_ACTIVITIES_TUESDAY"), "asciidoc")});
                break;
            case message.language.getDay("WEDNESDAY", "SHORT"): case message.language.getDay("WEDNESDAY", "LONG"): case "Wed":
                message.channel.send({content: Bot.codeBlock(message.language.get("COMMAND_ACTIVITIES_WEDNESDAY"), "asciidoc")});
                break;
            case message.language.getDay("THURSDAY", "SHORT"): case message.language.getDay("THURSDAY", "LONG"): case "Thu":
                message.channel.send({content: Bot.codeBlock(message.language.get("COMMAND_ACTIVITIES_THURSDAY"), "asciidoc")});
                break;
            case message.language.getDay("FRIDAY", "SHORT"): case message.language.getDay("FRIDAY", "LONG"): case "Fri":
                message.channel.send({content: Bot.codeBlock(message.language.get("COMMAND_ACTIVITIES_FRIDAY"), "asciidoc")});
                break;
            case message.language.getDay("SATURDAY", "SHORT"): case message.language.getDay("SATURDAY", "LONG"): case "Sat":
                message.channel.send({content: Bot.codeBlock(message.language.get("COMMAND_ACTIVITIES_SATURDAY"), "asciidoc")});
                break;
            default:
                return Bot.helpOut(message, this);
        }
    }
}
module.exports = Activites;
