const {inspect} = require("util");

module.exports = async (Bot, message) => {
    // It's good practice to ignore other bots. This also makes your bot ignore itself
    // and not get into a spam loop (we call that "botception").
    if (message.author.bot) return;

    // Grab the settings for this server
    // If there is no guild, get default conf (DMs)
    let guildSettings;
    if (!message.guild) {
        guildSettings = Bot.config.defaultSettings;
    } else {
        guildSettings = await Bot.getGuildConf(message.guild.id);
    }

    // If the guild has the activity log turned on, log the user's last activity
    if (message.guild && guildSettings.useActivityLog && !Bot.talkedRecently.has(message.author.id)) {
        let activityLog = await Bot.cache.get(Bot.config.mongodb.swgohbotdb, "activityLog", {guildID: message.guild.id});
        if (Array.isArray(activityLog)) activityLog = activityLog[0];
        if (!activityLog) {
            activityLog = {
                guildID: message.guild.id,
                log: {}
            };
        }
        activityLog.log[message.author.id] = new Date().getTime();
        await Bot.cache.put(Bot.config.mongodb.swgohbotdb, "activityLog", {guildID: message.guild.id}, activityLog);

        // Add em to the recently talked
        Bot.talkedRecently.add(message.author.id);
        setTimeout(() => {
            // Removes the user from the set after 2.5 seconds
            Bot.talkedRecently.delete(message.author.id);
        }, 2500);
    }

    // If we don't have permission to respond, don't bother
    if (message.guild && message.channel.permissionsFor(message.guild.me) && !message.channel.permissionsFor(message.guild.me).has("SEND_MESSAGES")) return;


    // For ease of use in commands and functions, we'll attach the settings
    // to the message object, so `message.guildSettings` is accessible.
    message.guildSettings = guildSettings;

    // If the message is just mentioning the bot, tell them what the prefix is
    if (message.content === message.client.user.toString() || (message.guild && typeof message.guild.me !== "undefined" && message.content === message.guild.me.toString())) {
        return message.channel.send(`The prefix is \`${message.guildSettings.prefix}\`.`);
    }

    // https://discordjs.guide/popular-topics/miscellaneous-examples.html#mention-prefix
    // Used to convert special characters into literal characters by escaping them, so that they don't terminate the pattern within the regex
    const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixRegex = new RegExp(`^(<@!?${message.client.user.id}>|${escapeRegex(message.guildSettings.prefix)})\\s*`);
    if (!prefixRegex.test(message.content)) return;
    const [, matchedPrefix] = message.content.match(prefixRegex);

    // Also good practice to ignore any message that does not start with our prefix, which is set in the configuration file.
    if (!matchedPrefix || message.content.indexOf(matchedPrefix) !== 0) return;

    // Splits on line returns, then on spaces to preserve the line returns
    const nArgs = message.content.slice(matchedPrefix.length).trim().split(/(\n+)/);
    let args = [];
    nArgs.forEach(line => {
        const ne = line.split(" ").filter(String);
        args = args.concat(ne);
    });

    // Get the command name/ remove it from the args
    const command = args && args.length ? args.shift().toLowerCase() : null;
    if (!command) return;

    // Get the user or member's permission level from the elevation
    const level = Bot.permlevel(message);

    // Check whether the command, or alias, exist in the collections defined in swgohbot.js.
    const cmd = message.client.commands.get(command) || message.client.commands.get(message.client.aliases.get(command));

    if (!cmd || !cmd.conf.enabled) return;

    const user = await Bot.userReg.getUser(message.author.id);

    // Load the language file for whatever language they have set
    if (user && user.lang) {
        if (user.lang.language) {
            message.guildSettings.language = user.lang.language || Bot.config.defaultSettings.language;
        }
        if (user.lang.swgohLanguage) {
            message.guildSettings.swgohLanguage = user.lang.swgohLanguage || Bot.config.defaultSettings.swgohLanguage;
        }
    }
    message.language = Bot.languages[message.guildSettings.language] || Bot.languages[Bot.config.defaultSettings.language];
    message.swgohLanguage = message.guildSettings.swgohLanguage || Bot.config.defaultSettings.swgohLanguage;

    // Some commands may not be useable in DMs. This check prevents those commands from running
    // and return a friendly error message.
    if (cmd && !message.guild && cmd.conf.guildOnly) {
        return message.channel.send(message.language.get("BASE_COMMAND_UNAVAILABLE"));
    }

    // If the command exists, **AND** the user has permission, run it.
    if (cmd && level >= cmd.conf.permLevel) {
        if (message.guild) {
            const defPerms = ["SEND_MESSAGES", "VIEW_CHANNEL", "EMBED_LINKS"];

            // Merge the permission arrays to make sure it has at least the minimum
            const perms = [...new Set([...defPerms, ...cmd.conf.permissions])];
            if (message.guild && message.channel && !message.channel.permissionsFor(message.guild.me).has(perms)) {
                const missingPerms = message.channel.permissionsFor(message.guild.me).missing(perms);

                if (missingPerms.length > 0) {
                    // If it can't send messages, don't bother trying
                    if (missingPerms.includes("VIEW_CHANNEL") || missingPerms.includes("SEND_MESSAGES")) return;
                    // Make it more readable
                    missingPerms.forEach((p, ix) => {missingPerms[ix] = p.replace("_", " ").toProperCase();});
                    return message.channel.send(`This bot is missing the following permissions to run this command here: \`${missingPerms.join(", ")}\``);
                }
            }
        }

        let flagArgs = getFlags(cmd.conf.flags, cmd.conf.subArgs, args);

        const noFlags   = Object.keys(flagArgs.flags).every(f => !flagArgs.flags[f]);
        const noSubArgs = Object.keys(flagArgs.subArgs).every(s => !flagArgs.subArgs[s]);
        let def = null;
        if (noFlags && noSubArgs && user) {
            if (user.defaults[cmd.help.name]) {
                flagArgs = getFlags(cmd.conf.flags, cmd.conf.subArgs, args.concat(user.defaults[cmd.help.name].split(" ")));
                def = user.defaults[cmd.help.name];
            }
        }

        // Quick shortcut to any extra ally codes you have registered
        // -1 for the first in the list, -2 for the second, etc.
        const toRep = args.filter(a => a.match(/^-\d{1,2}$/));
        if (toRep.length) {
            const ix = args.indexOf(toRep[0]);
            const jx = parseInt(args[ix].replace("-", ""), 10)-1;
            if (user && user.accounts && user.accounts.length && user.accounts.length > jx && jx >= 0) {
                args[ix] = user.accounts[jx].allyCode;
            }
        }

        // If they're just looking for the help, don't bother going through the command
        if (args.length === 1 && args[0].toLowerCase() === "help") {
            try {
                Bot.helpOut(message, cmd);
            } catch (err) {
                if (cmd.help.name === "test") {
                    console.log(`ERROR(msg) I broke with ${cmd.help.name}: \nContent: ${message.content} \n${inspect(err)}`, true);
                } else {
                    Bot.logger.error(`ERROR(msg) I broke with ${cmd.help.name}: \nContent: ${message.content} \n${inspect(err)}`, true);
                }
            }
        } else {
            try {
                await cmd.run(Bot, message, args, {
                    level: level,
                    flags: flagArgs.flags,
                    subArgs: flagArgs.subArgs,
                    defaults: def
                });
            } catch (err) {
                if (cmd.help.name === "test") {
                    console.log(`ERROR(msg) I broke with ${cmd.help.name}: \nContent: ${message.content} \n${inspect(err)}`, true);
                } else {
                    Bot.logger.error(`ERROR(msg) I broke with ${cmd.help.name}: \nContent: ${message.content} \n${inspect(err)}`, true);
                }
            }
        }
        if (Bot.config.logs.logComs) {
            Bot.database.models.commands.create({
                id: `${cmd.help.name}-${message.author.id}-${message.id}`,
                commandText: args.join(" ")
            });
        }
    }
};

// Checks for any args that start with - or -- that match what the command is looking for
function checkForArgs(key, args) {
    if (args.includes("-"+key)) {
        return [true, "-"+key];
    } else if (args.includes("--"+key)) {
        return [true, "--"+key];
    } else {
        return [false, null];
    }
}

// Get the flags and extra args for the command
function getFlags(cFlags, cSubArgs, args) {
    const flags = {};
    const subArgs = {};

    const flagKeys = Object.keys(cFlags);
    flagKeys.forEach(key => {
        let found = checkForArgs(key, args);
        flags[key] = false;
        if (!found[0]) {
            for (let ix = 0; ix < cFlags[key].aliases.length; ix++) {
                found = checkForArgs(cFlags[key].aliases[ix], args);
                if (found[0]) break;
            }
        }
        if (found[0]) {
            args.splice(args.indexOf(found[1]), 1);
            flags[key] = true;
        }
    });

    const subKeys = Object.keys(cSubArgs);
    subKeys.forEach(key => {
        let found = checkForArgs(key, args);
        if (!found[0]) {
            for (let ix = 0; ix < cSubArgs[key].aliases.length; ix++) {
                found = checkForArgs(cSubArgs[key].aliases[ix], args);
                if (found[0]) {
                    break;
                }
            }
        }
        if (found[0]) {
            const res = args.splice(args.indexOf(found[1]), 2);
            subArgs[key] = res[1] ? res[1] : null;
        } else {
            subArgs[key] = cSubArgs[key].default ? cSubArgs[key].default : null;
        }
    });

    return {
        subArgs: subArgs,
        flags: flags
    };
}