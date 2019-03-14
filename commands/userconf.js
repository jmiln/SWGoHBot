const Command = require("../base/Command");

class UserConf extends Command {
    constructor(client) {
        super(client, {
            name: "userconf",
            category: "SWGoH",
            aliases: ["uc", "uconf", "userconfig", "uconfig"],
            subArgs: {
                user: {
                    aliases: ["u"]
                }
            }
        });
    }

    async run(client, message, [target, action, ...args], options) { // eslint-disable-line no-unused-vars
        if (target) target = target.toLowerCase();
        if (action) action = action.toLowerCase();

        let userID = message.author.id;

        if (options.subArgs.user && options.level < 9) {
            return super.error(message, message.language.get("COMMAND_USERCONF_CANNOT_VIEW_OTHER"));
        } else if (options.subArgs.user) {
            userID = options.subArgs.user.replace(/[^\d]*/g, "");
            if (!client.isUserID(userID)) {
                return super.error(message, "Invalid user ID");
            }
        }

        let user = await client.userReg.getUser(userID); // eslint-disable-line no-unused-vars 
        switch (target) {
            case "allycode": {
                // Allycode   -> add/remove/makePrimary
                let allyCode;
                if (!user) {
                    user = JSON.parse(JSON.stringify(client.config.defaultUserConf));
                    user.id = userID;
                }
                if (!args[0]) {
                    // Missing ally code
                    return super.error(message, message.language.get("COMMAND_REGISTER_MISSING_ALLY"));
                } else {
                    if (client.isAllyCode(args[0])) {
                        allyCode = args[0].replace(/[^\d]*/g, "");
                    } else {
                        // Bad code, grumblin time
                        return super.error(message, message.language.get("COMMAND_REGISTER_INVALID_ALLY", allyCode));
                    }
                }
                if (action === "add") {
                    // Add to the list of ally codes, if the first, make it the primary
                    if (user.accounts.find(a => a.allyCode === allyCode)) {
                        return message.channel.send(message.language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_REGISTERED"));
                    }
    
                    // Cap the ally codes at 10, if they have even that many
                    // accounts, they already have too much free time
                    if (user.accounts.length >= 10) {
                        return message.channel.send(message.language.get("COMMAND_USERCONF_ALLYCODE_TOO_MANY"));
                    }

                    // Sync up their swgoh account
                    try {
                        await client.swgohAPI.player(allyCode, "ENG_US").then(async (u) => {
                            if (!u) {
                                super.error(message, (message.language.get("COMMAND_REGISTER_FAILURE")));
                            } else {
                                user.accounts.push({
                                    allyCode: allyCode,
                                    name: u.name,
                                    primary: user.accounts.length ? false : true
                                });
                                await client.swgohAPI.register([
                                    [allyCode, userID]
                                ]);
                                message.channel.send(message.language.get("COMMAND_REGISTER_SUCCESS", u.name));
                            }
                        });
                    } catch (e) {
                        console.log("ERROR[REG]: Incorrect Ally Code(" + allyCode + "): " + e);
                        return super.error(message, ("Something broke. Make sure you've got the correct ally code" + client.codeBlock(e.message)));
                    }
                } else if (action === "remove") {
                    // Remove from the list, if the chosen one was the primary, set the 1st 
                    const acc = user.accounts.find(a => a.allyCode === allyCode);
                    if (!acc) {
                        return message.channel.send(message.langauge.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
                    }
                    user.accounts = user.accounts.filter(a => a.allyCode !== allyCode);
                    user.accounts = user.accounts.filter(a => parseInt(a.allyCode));
                    if (user.accounts.length && !user.accounts.filter(a => a.primary).length) {
                        user.accounts[0].primary = true;
                    }
                    message.channel.send(message.language.get("COMMAND_USERCONF_ALLYCODE_REMOVED_SUCCESS", acc.name, acc.allyCode));
                } else if (action === "makeprimary") {
                    // Set the selected ally code the primary one
                    const acc = user.accounts.find(a => a.allyCode === allyCode);
                    const prim = user.accounts.find(a => a.primary);
                    if (!acc) {
                        return message.channel.send(message.language.get("COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED"));
                    } else if (acc.primary) {
                        return message.channel.send(message.language.get("COMMAND_USERCONF_ALLYCODE_ALREADY_PRIMARY"));
                    }
                    user.accounts = user.accounts.map(a => {
                        if (a.primary) a.primary = false;
                        if (a.allyCode === allyCode) a.primary = true;
                        return a;
                    });
                    message.channel.send(message.language.get("COMMAND_USERCONF_ALLYCODE_NEW_PRIMARY", prim.name, prim.allyCode, acc.name, acc.allyCode));
                }
                await client.userReg.updateUser(userID, user);
                break;
            }
            case "defaults": {
                // Defaults   -> per-command etc?   If there are no found flags when using ___ command, use your personal defaults (Have flag to cancel it?)
                // ;uc defaults set <commandName> <argString>
                // ;uc defaults clear <commandName>
                const [com, ...flag] = args;
                if (!user) {
                    user = client.config.defaultUserConf;
                    user.id = userID;
                }

                let command; 
                const cmdBlacklist = ["event", "shardtimes"];
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
                await client.userReg.updateUser(userID, user);
                break;
            }
            case "arenaalert": {
                // ArenaAlert -> activate/ deactivate
                const onVar = ["true", "on", "enable"];
                const offVar = ["false", "off", "disable"];
                const pat = client.patrons.find(p => p.discordID === message.author.id);
                if (!pat || pat.amount_cents < 500) {
                    return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_PATREON_ONLY"));
                }
                const setting = args[0].toLowerCase();  
                if (action === "enabledms") {
                    // Set it to enable the DM alerts entirely or not
                    if (!setting) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_MISSING_BOOL"));
                    }
                    if (onVar.includes(setting)) {
                        user.arenaAlert.enableRankDMs = true;
                    } else if (offVar.includes(setting)) {
                        user.arenaAlert.enableRankDMs = false;
                    } else {
                        // They entered an invalid choice
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_INVALID_BOOL"));
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
                    } else if (parseInt(setting) < 0 || parseInt(setting) > 1440) {
                        return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_INVALID_NUMBER"));
                    }
                    user.arenaAlert.payoutWarning = parseInt(setting);
                } else {
                    return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_INVALID_OPTION"));
                }
                await client.userReg.updateUser(userID, user);
                return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_UPDATED"), {title: "Success!", color: 0x00FF00});
            }
            case "view":
            default: {
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
                    name: "Arena Rank DMs",
                    value: [
                        `DM for rank drops: **${user.arenaAlert.enableRankDMs ? "ON" : "OFF"}**`, 
                        `Show for arena: **${user.arenaAlert.arena}**`,
                        `Payout warning **${user.arenaAlert.payoutWarning ? user.arenaAlert.payoutWarning + " min**" : "disabled**"}`, 
                        `Payout result alert: **${user.arenaAlert.enablePayoutResult ? "ON" : "OFF"}**`
                    ].join("\n")
                });
                return message.channel.send({embed: {
                    author: {name: client.users.get(userID).username}, 
                    fields: fields
                }});
            }
        }
    }
}

module.exports = UserConf;

