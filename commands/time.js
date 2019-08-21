var moment = require("moment-timezone");

const Command = require("../base/Command");

class Time extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "time",
            category: "Misc"
        });
    }

    run(Bot, message, args) {
        const guildConf = message.guildSettings;

        if (args[0]) {
            if (moment.tz.zone(args[0])) { // Valid time zone
                return message.channel.send(message.language.get("COMMAND_TIME_CURRENT", moment.tz(args[0]).format("DD/MM/YYYY [at] H:mm:ss"), args[0]));
            } else { // Not so valid
                return super.error(message, message.language.get("COMMAND_TIME_INVALID_ZONE", moment.tz(guildConf["timezone"]).format("DD/MM/YYYY [at] H:mm:ss"), guildConf["timezone"]));
            }
        }

        if (!guildConf["timezone"]) {
            return message.channel.send(message.language.get("COMMAND_TIME_NO_ZONE", moment().format("DD/MM/YYYY [at] H:mm:ss")));
        } else {
            return message.channel.send(message.language.get("COMMAND_TIME_WITH_ZONE", moment.tz(guildConf["timezone"]).format("DD/MM/YYYY [at] H:mm:ss"), guildConf["timezone"]));
        }
    }
}

module.exports = Time;
