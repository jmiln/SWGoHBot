const Command = require("../base/Command");

class Nickname extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "nickname",
            aliases: ["nick"],
            guildOnly: true,
            permLevel: 3,
            category: "Admin"
        });
    }

    run(Bot, message, args) {
        const client = message.client;
        try {
            if (message.channel.permissionsFor(message.guild.me).has(["MANAGE_NICKNAMES"])) {
                if (args.length > 0) {
                    const name = String(args.join(" "));
                    if (name.length > 32) {
                        return super.error(message, message.language.get("COMMAND_NICKNAME_TOO_LONG"));
                    }
                    message.guild.member(client.user).setNickname(name);
                } else {
                    message.guild.member(client.user).setNickname("");
                }
                message.channel.send(message.language.get("COMMAND_NICKNAME_SUCCESS"));
            } else {
                super.error(message, message.language.get("COMMAND_NICKNAME_FAILURE"));
            }
        } catch (e) {
            Bot.logger.error("Broke", "I broke while trying to set a nickname\n" + e);
        }
    }
}

module.exports = Nickname;
