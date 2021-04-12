const Command = require("../base/Command");

class UserConf extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "userconf",
            category: "Misc",
            aliases: ["uc", "uconf", "userconfig", "uconfig"],
            permissions: ["EMBED_LINKS"],
            flags: {},
            subArgs: {
                user: {
                    aliases: ["u"]
                }
            }
        });
    }

    async run(Bot, message, [target, action, ...args], options) { // eslint-disable-line no-unused-vars
        if (target) target = target.toLowerCase();
        if (action) action = action.toLowerCase();

        let userID = message.author.id;

        if (options.subArgs.user && options.level < 9) {
            return super.error(message, message.language.get("COMMAND_USERCONF_CANNOT_VIEW_OTHER"));
        } else if (options.subArgs.user) {
            userID = options.subArgs.user.replace(/[^\d]*/g, "");
            if (!Bot.isUserID(userID)) {
                return super.error(message, "Invalid user ID");
            }
        }

        let user = await Bot.userReg.getUser(userID); // eslint-disable-line no-unused-vars
        if (!user) {
            user = JSON.parse(JSON.stringify(Bot.config.defaultUserConf));
            user.id = userID;
        }
        const cooldown = await Bot.getPlayerCooldown(message.author.id);
        switch (target) {
            case "ac":
            case "allycodes":
            case "allycode": {
                // Allycode   -> add/remove/makePrimary
                let allyCode;
                if (!args[0]) {
                    // Missing ally code
                    return super.error(message, message.language.get("COMMAND_REGISTER_MISSING_ALLY"));
                } else {
                    if (Bot.isAllyCode(args[0])) {
                        allyCode = args[0].replace(/[^\d]*/g, "");
                    } else {
                        // Bad code, grumblin time
                        return super.error(message, message.language.get("COMMAND_REGISTER_INVALID_ALLY", allyCode));
                    }
                }
                if (action === "add") {
                    // Add to the list of ally codes, if the first, make it the primary
                    if (user && user.accounts && user.accounts.find(a => a.allyCode === allyCode)) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_REGISTERED"));
                    }

                    // Cap the ally codes at 10, if they have even that many
                    // accounts, they already have too much free time
                    if (user.accounts.length >= 10) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ALLYCODE_TOO_MANY"));
                    }

                    // Sync up their swgoh account
                    try {
                        let player = await Bot.swgohAPI.unitStats(allyCode, cooldown);
                        if (Array.isArray(player)) player = player[0];
                        if (!player) {
                            super.error(message, message.language.get("COMMAND_REGISTER_FAILURE"));
                        } else {
                            user.accounts.push({
                                allyCode: allyCode,
                                name: player.name,
                                primary: user.accounts.length ? false : true
                            });
                            await Bot.userReg.updateUser(userID, user);
                            return super.success(message,
                                Bot.codeBlock(message.language.get(
                                    "COMMAND_REGISTER_SUCCESS_DESC",
                                    player,
                                    player.allyCode.toString().match(/\d{3}/g).join("-"),
                                    player.stats.find(s => s.nameKey === "STAT_GALACTIC_POWER_ACQUIRED_NAME").value.toLocaleString()
                                ), "asciiDoc"), {
                                    title: message.language.get("COMMAND_REGISTER_SUCCESS_HEADER", player.name)
                                });
                        }
                    } catch (e) {
                        Bot.logger.error("ERROR[REG]: Incorrect Ally Code(" + allyCode + "): " + e);
                        return super.error(message, ("Something broke. Make sure you've got the correct ally code" + Bot.codeBlock(e.message)));
                    }
                } else if (action === "remove") {
                    // Remove from the list, if the chosen one was the primary, set the 1st
                    const acc = user.accounts.find(a => a.allyCode === allyCode);
                    if (!acc) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
                    }
                    // Filter out the one(s) that match the specified allycode
                    user.accounts = user.accounts.filter(a => a.allyCode !== acc.allyCode);
                    // If none of the remaining accounts are marked as primary, mark the first one as such
                    if (user.accounts.length && !user.accounts.find(a => a.primary)) {
                        user.accounts[0].primary = true;
                    }
                    await Bot.userReg.updateUser(userID, user);
                    return super.success(message, message.language.get("COMMAND_USERCONF_ALLYCODE_REMOVED_SUCCESS", acc.name, acc.allyCode));
                } else if (action === "makeprimary") {
                    // Set the selected ally code the primary one
                    const acc = user.accounts.find(a => a.allyCode === allyCode);
                    const prim = user.accounts.find(a => a.primary);
                    if (!acc) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
                    } else if (acc.primary) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_PRIMARY"));
                    }
                    user.accounts = user.accounts.map(a => {
                        if (a.primary) a.primary = false;
                        if (a.allyCode === allyCode) a.primary = true;
                        return a;
                    });
                    await Bot.userReg.updateUser(userID, user);
                    return super.success(message, message.language.get("COMMAND_USERCONF_ALLYCODE_NEW_PRIMARY", prim.name, prim.allyCode, acc.name, acc.allyCode));
                }
                break;
            }
            case "defaults": {
                // Defaults   -> per-command etc?   If there are no found flags when using ___ command, use your personal defaults (Have flag to cancel it?)
                // ;uc defaults set <commandName> <argString>
                // ;uc defaults clear <commandName>
                const [com, ...flag] = args;
                if (!user) {
                    user = Bot.config.defaultUserConf;
                    user.id = userID;
                }

                let command;
                const cmdBlacklist = ["event", "shardtimes"];
                const client = message.client;
                if (client.commands.has(com)) {
                    command = client.commands.get(com);
                } else if (client.aliases.has(com)) {
                    command = client.commands.get(client.aliases.get(com));
                } else {
                    return super.error(message, message.language.get("COMMAND_RELOAD_INVALID_CMD", com));
                }
                if (action === "set") {
                    // Add arg(s) to selected command
                    if (!Object.keys(command.conf.subArgs).length && !Object.keys(command.conf.flags).length) {
                        // If there are no subArgs or flags for the command, no point setting any
                        return super.error(message, message.language.get("COMMAND_USERCONF_DEFAULTS_NO_FLAGS", command.help.name.toProperCase()));
                    } else if (cmdBlacklist.includes(command.help.name)) {
                        return super.error(message, message.langauge.get("COMMAND_USERCONF_DEFAULTS_INVALID_CMD", command.help.name));
                    }
                    user.defaults[command.help.name] = flag.join(" ");
                    message.channel.send(message.language.get("COMMAND_USERCONF_DEFAULTS_SET_DEFAULTS", command.help.name, flag.join(" ")));
                } else if (action === "clear") {
                    // Clear the flags etc. from this command
                    if (!user.defaults[command.help.name]) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_DEFAULTS_NO_DEFAULTS", command.help.name));
                    }
                    delete user.defaults[command.help.name];
                    message.channel.send(message.language.get("COMMAND_USERCONF_DEFAULTS_CLEARED", command.help.name));
                }
                await Bot.userReg.updateUser(userID, user);
                break;
            }
            case "arenaalert": {
                // ArenaAlert -> activate/ deactivate
                const onVar = ["true", "on", "enable"];
                const offVar = ["false", "off", "disable"];
                const pat = Bot.getPatronUser(message.author.id);
                if (!pat || pat.amount_cents < 100) {
                    return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_PATREON_ONLY"));
                }
                const setting = args.length ? args[0].toLowerCase() : null;
                if (action === "enabledms") {
                    // Set it to enable the DM alerts entirely or not
                    if (!setting) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_MISSING_DM"));
                    } else if (setting === "all" && pat.amount_cents < 500) {
                        return super.error(message, "Sorry, but you can only set up alerts for the allycode you have set as your primary.");
                    }
                    if (["all", "primary"].includes(setting)) {
                        user.arenaAlert.enableRankDMs = setting;
                    } else if (offVar.includes(setting)) {
                        user.arenaAlert.enableRankDMs = "off";
                    } else {
                        // They entered an invalid choice
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_INVALID_DM"));
                    }
                } else if (action === "arena") {
                    // Set which arena you want watched
                    if (!setting) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_MISSING_ARENA"));
                    } else if (!["char", "fleet", "both", "none"].includes(setting)) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_INVALID_ARENA"));
                    }
                    user.arenaAlert.arena = setting;
                } else if (action === "payoutresult") {
                    // Set it to tell you the result at your payout
                    if (!setting) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_MISSING_BOOL"));
                    }
                    if (onVar.includes(setting)) {
                        user.arenaAlert.enablePayoutResult = true;
                    } else if (offVar.includes(setting)) {
                        user.arenaAlert.enablePayoutResult = false;
                    } else {
                        // They entered an invalid choice
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_INVALID_BOOL"));
                    }
                } else if (action === "payoutwarning") {
                    // Set it to warn you x minutes ahead of your payout
                    if (!setting) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_MISSING_WARNING"));
                    } else if (isNaN(setting)) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_INVALID_WARNING"));
                    } else if (parseInt(setting, 10) < 0 || parseInt(setting, 10) > 1440) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_INVALID_NUMBER"));
                    }
                    user.arenaAlert.payoutWarning = parseInt(setting, 10);
                } else {
                    return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_INVALID_OPTION"), {title: "Invalid Option"});
                }
                await Bot.userReg.updateUser(userID, user);
                return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_UPDATED"), {title: "Success!", color: "#00FF00"});
            }
            case "lang": {
                let setting = args.length ? args[0].toLowerCase() : null;
                if (!user.lang) user.lang = {};
                if (action === "language") {
                    if (!setting) {
                        return super.error(message, message.language.get("COMMAND_SETCONF_INVALID_LANG", setting, Object.keys(Bot.languages).join(", ")));
                    }
                    if (Object.keys(Bot.languages).map(l => l.toLowerCase()).indexOf(setting) > -1) {
                        const split = setting.split("_");
                        setting = split[0].toLowerCase() + "_" + split[1].toUpperCase();
                        user.lang.language = setting;
                    } else {
                        return super.error(message, message.language.get("COMMAND_SETCONF_INVALID_LANG", setting, Object.keys(Bot.languages).join(", ")));
                    }
                } else if (action === "swgohlanguage") {
                    if (!setting) {
                        return super.error(message, message.language.get("COMMAND_SETCONF_INVALID_LANG", setting, Bot.swgohLangList.join(", ")));
                    }
                    if (Bot.swgohLangList.map(l => l.toLowerCase()).indexOf(setting) > -1) {
                        user.lang.swgohLanguage = setting;
                    } else {
                        return super.error(message, message.language.get("COMMAND_SETCONF_INVALID_LANG", setting, Bot.swgohLangList.join(", ")));
                    }
                } else {
                    return super.error(message, message.language.get("COMMAND_USERCONF_LANG_INVALID_OPTION"), {title: "Invalid Option"});
                }
                await Bot.userReg.updateUser(userID, user);
                return super.error(message, message.language.get("COMMAND_USERCONF_LANG_UPDATED", action, setting), {title: "Success!", color: "#00FF00"});
            }
            case "view": {
                // Show the user's settings/ config
                if (!user) {
                    return super.error(message, message.language.get("COMMAND_USERCONF_VIEW_NO_CONFIG", message.guildSettings.prefix));
                }
                const fields = [];
                fields.push({
                    name: message.language.get("COMMAND_USERCONF_VIEW_ALLYCODES_HEADER"),
                    value: user.accounts.length ? message.language.get("COMMAND_USERCONF_VIEW_ALLYCODES_PRIMARY") + user.accounts.map((a, ix) => `\`[${ix+1}] ${a.allyCode}\`: ` + (a.primary ? `**${a.name}**` : a.name)).join("\n") : message.language.get("COMMAND_USERCONF_VIEW_ALLYCODES_NO_AC")
                });
                fields.push({
                    name: message.language.get("COMMAND_USERCONF_VIEW_DEFAULTS_HEADER"),
                    value: Object.keys(user.defaults).length ? Object.keys(user.defaults).map(d => `**${d}:** \`${user.defaults[d]}\``).join("\n") : message.language.get("COMMAND_USERCONF_VIEW_DEFAULTS_NO_DEF")
                });
                fields.push({
                    name: message.language.get("COMMAND_USERCONF_VIEW_ARENA_HEADER"),
                    value: [
                        `${message.language.get("COMMAND_USERCONF_VIEW_ARENA_DM")}: **${user.arenaAlert.enableRankDMs ? user.arenaAlert.enableRankDMs : "N/A"}**`,
                        `${message.language.get("COMMAND_USERCONF_VIEW_ARENA_SHOW")}: **${user.arenaAlert.arena}**`,
                        `${message.language.get("COMMAND_USERCONF_VIEW_ARENA_WARNING")}: **${user.arenaAlert.payoutWarning ? user.arenaAlert.payoutWarning + " min" : "disabled"}**`,
                        `${message.language.get("COMMAND_USERCONF_VIEW_ARENA_RESULT")}: **${user.arenaAlert.enablePayoutResult ? "ON" : "OFF"}**`
                    ].join("\n")
                });
                fields.push({
                    name: message.language.get("COMMAND_USERCONF_VIEW_LANG_HEADER") ,
                    value: [
                        `Language: **${user.lang ? (user.lang.language ? user.lang.language : "N/A") : "N/A"}**`,
                        `swgohLanguage: **${user.lang ? (user.lang.swgohLanguage ? user.lang.swgohLanguage.toUpperCase() : "N/A") : "N/A"}**`
                    ].join("\n")
                });
                const u = await message.client.users.fetch(userID);
                return message.channel.send({embed: {
                    author: {name: u.username},
                    fields: fields
                }});
            }
            default: {
                return super.error(message, "Try one of these: `allycodes, defaults, lang, arenaAlert, view`",{title: "Invalid option"});
            }
        }
    }
}

module.exports = UserConf;
