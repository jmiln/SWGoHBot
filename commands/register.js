const Command = require("../base/Command");

class Register extends Command {
    constructor(client) {
        super(client, {
            name: "register",
            category: "SWGoH",
            aliases: ["reg"],
            flags: {
                "guild": {
                    aliases: ["g", "guilds"]
                }
            }
        });
    }

    async run(client, message, [allyCode, ...args], options) { // eslint-disable-line no-unused-vars
        if (!allyCode) {
            return super.error(message, message.language.get("COMMAND_REGISTER_MISSING_ALLY"));
        } else {
            if (client.isAllyCode(allyCode)) {
                allyCode = allyCode.replace(/[^\d]*/g, "");
            } else {
                // Bad code, grumblin time
                return super.error(message, message.language.get("COMMAND_REGISTER_INVALID_ALLY", allyCode));
            }
        }
        let user = await client.userReg.getUser(message.author.id);
        if (!user) {
            user = client.config.defaultUserConf;
            user.id = message.author.id;
        } else if (user.accounts.find(a => a.allyCode === allyCode && a.primary)) {
            // This ally code is already registered & primary
            return message.channel.send(message.language.get("COMMAND_REGISTER_ALREADY_REGISTERED"));
        } else if (user.accounts.find(a => a.allyCode === allyCode && !a.primary)) {
            // This ally code is already registered but not primary, so just swap it over
            user.accounts = user.accounts.map(a => {
                if (a.primary) a.primary = false;
                if (a.allyCode === allyCode) a.primary = true;
                return a;
            });
            user = await client.userReg.updateUser(message.author.id, user);
            const u = user.accounts.find(a => a.primary);
            return message.channel.send(message.language.get("COMMAND_REGISTER_SUCCESS", u.name));
        }
        message.channel.send(message.language.get("COMMAND_REGISTER_PLEASE_WAIT")).then(async msg => {
            try {
                await client.swgohAPI.player(allyCode, "ENG_US").then(async (u) => {
                    if (!u) {
                        super.error(msg, (message.language.get("COMMAND_REGISTER_FAILURE")), {edit: true});
                    } else {
                        await client.userReg.addUser(message.author.id, allyCode)
                            .then(async () => {
                                await client.swgohAPI.register([
                                    [allyCode, message.author.id]
                                ]);
                                await msg.edit(message.language.get("COMMAND_REGISTER_SUCCESS", u.name));
                            })
                            .catch(e => {
                                client.log("REGISTER", "Broke while trying to link new user: " + e);
                                return super.error(msg, client.codeBlock(e.message), {
                                    title: message.lanugage.get("BASE_SOMETHING_BROKE"),
                                    footer: "Please try again in a bit.",
                                    edit: true
                                });
                            });
                    }
                });
            } catch (e) {
                console.log("ERROR[REG]: Incorrect Ally Code: " + e);
                return super.error(message, ("Something broke. Make sure you've got the correct ally code" + client.codeBlock(e.message)));
            }
        });
    }
}

module.exports = Register;

