const Command = require("../base/Command");

class Register extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "register",
            category: "Misc",
            aliases: ["reg"],
            permissions: ["EMBED_LINKS"]
        });
    }

    async run(Bot, message, [userID, allyCode, ...args], options) { // eslint-disable-line no-unused-vars
        const cooldown = await Bot.getPlayerCooldown(message.author.id);
        if (!userID) {
            return super.error(message, message.language.get("COMMAND_REGISTER_MISSING_ALLY"));
        } else {
            if (Bot.isUserID(userID)) {
                userID = userID.replace(/[^\d]*/g, "");
                if (userID !== message.author.id && options.level < 3) {
                    // If they are trying to change someone else and they don't have the right permissions
                    return super.error(message, message.language.get("COMMAND_SHARDTIMES_MISSING_ROLE"));
                } else if (!message.guild.members.cache.has(userID)) {
                    // If they are trying to change something for someone in a different server
                    return super.error(message, message.language.get("COMMAND_REGISTER_ADD_NO_SERVER"));
                }
            } else if (Bot.isAllyCode(userID)) {
                allyCode = await Bot.getAllyCode(message, userID);
                if (allyCode.length) {
                    allyCode = allyCode[0];
                } else {
                    return super.error(message, message.language.get("COMMAND_REGISTER_INVALID_ALLY", allyCode));
                }
                userID = message.author.id;
            } else {
                // Bad code, grumblin time
                return super.error(message, message.language.get("COMMAND_REGISTER_INVALID_ALLY", allyCode));
            }
        }
        let user = await Bot.userReg.getUser(userID);
        if (user && user.accounts.length && userID !== message.author.id) {
            return super.error(message, "This account already has an ally code linked to it.");
        }
        if (!user) {
            user = JSON.parse(JSON.stringify(Bot.config.defaultUserConf));
            user.id = userID;
        } else if (user.accounts.find(a => a.allyCode === allyCode && a.primary)) {
            // This ally code is already registered & primary
            return super.error(message, message.language.get("COMMAND_REGISTER_ALREADY_REGISTERED"));
        } else if (user.accounts.find(a => a.allyCode === allyCode && !a.primary)) {
            // This ally code is already registered but not primary, so just swap it over
            user.accounts = user.accounts.map(a => {
                if (a.primary) a.primary = false;
                if (a.allyCode === allyCode) a.primary = true;
                return a;
            });
            user = await Bot.userReg.updateUser(userID, user);
            const u = user.accounts.find(a => a.primary);
            return super.success(message,
                Bot.codeBlock(message.language.get(
                    "COMMAND_REGISTER_SUCCESS_DESC",
                    u,
                    u.allyCode.toString().match(/\d{3}/g).join("-"),
                ), "asciiDoc"), {
                    title: message.language.get("COMMAND_REGISTER_SUCCESS_HEADER", u.name)
                });
        } else {
            // They're registered with a different ally code, so turn off all the other primaries
            user.accounts = user.accounts.map(a => {
                a.primary = false;
                return a;
            });
        }
        message.channel.send(message.language.get("COMMAND_REGISTER_PLEASE_WAIT")).then(async msg => {
            try {
                let player = await Bot.swgohAPI.unitStats(allyCode, cooldown);
                if (Array.isArray(player)) player = player[0];
                if (!player) {
                    super.error(msg, (message.language.get("COMMAND_REGISTER_FAILURE") + allyCode), {edit: true});
                } else {
                    user.accounts.push({
                        allyCode: allyCode,
                        name: player.name,
                        primary: true
                    });
                    await Bot.userReg.updateUser(userID, user)
                        .then(async () => {
                            return super.success(msg,
                                Bot.codeBlock(message.language.get(
                                    "COMMAND_REGISTER_SUCCESS_DESC",
                                    player,
                                    player.allyCode.toString().match(/\d{3}/g).join("-"),
                                    player.stats.find(s => s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME").value.toLocaleString()
                                ), "asciiDoc"), {
                                    title: message.language.get("COMMAND_REGISTER_SUCCESS_HEADER", player.name),
                                    edit: true
                                });
                        })
                        .catch(e => {
                            Bot.logger.error("REGISTER", "Broke while trying to link new user: " + e);
                            return super.error(msg, Bot.codeBlock(e.message), {
                                title: message.lanugage.get("BASE_SOMETHING_BROKE"),
                                footer: "Please try again in a bit.",
                                edit: true
                            });
                        });
                }
            } catch (e) {
                Bot.logger.error("ERROR[REG]: Incorrect Ally Code: " + e);
                return super.error(message, ("Something broke. Make sure you've got the correct ally code" + Bot.codeBlock(e.message)));
            }
        });
    }
}

module.exports = Register;
