const Command = require("../base/Command");

class Nickname extends Command {
    constructor(client) {
        super(client, {
            name: "nickname",
            aliases: ["nick"],
            guildOnly: true,
            permLevel: 3,
            category: "Admin"
        });
    }

    run(client, message, args) {
        try {
            if (message.channel.permissionsFor(message.guild.me).has(["MANAGE_NICKNAMES"])) {
                if (args.length > 0) {
                    const name = String(args.join(" "));
                    if (name.length > 32) {
                        return message.channel.send(message.language.get("COMMAND_NICKNAME_TOO_LONG"));
                    }
                    message.guild.member(client.user).setNickname(name);
                } else {
                    message.guild.member(client.user).setNickname("");
                }
                message.channel.send(message.language.get("COMMAND_NICKNAME_SUCCESS"));
            } else {
                message.channel.send(message.language.get("COMMAND_NICKNAME_FAILURE"));
            }
        } catch (e) {
            client.log("Broke", "I broke while trying to set a nickname\n" + e);
        }
    }
}

module.exports = Nickname;
