// The MESSAGE event runs anytime a message is received
// Note that due to the binding of client to every event, every event
// goes `client, other, args` when this function is run.

module.exports = async (client, message) => {
    // It's good practice to ignore other bots. This also makes your bot ignore itself
    // and not get into a spam loop (we call that "botception").
    if (message.author.bot) return;
    // if (message.guild && !message.guild.me) await message.guild.members.fetch(client.user);
    // If we don't have permission to respond, don't bother
    if (message.guild && !message.channel.permissionsFor(message.guild.me).has("SEND_MESSAGES")) return;

    // Grab the settings for this server from the PersistentCollection
    // If there is no guild, get default conf (DMs)
    let guildSettings;
    if (!message.guild) {
        guildSettings = client.config.defaultSettings;
    } else {
        guildSettings = await client.guildSettings.findOne({where: {guildID: message.guild.id}, attributes: Object.keys(client.config.defaultSettings)});
        guildSettings = guildSettings.dataValues;
    }
    

    // For ease of use in commands and functions, we'll attach the settings
    // to the message object, so `message.guildSettings` is accessible.
    message.guildSettings = guildSettings;
    
    // Load the language file for whatever language they have set
    message.language = client.languages[guildSettings.language];

    // If the message is just mentioning the bot, tell them what the prefix is
    if (message.content === client.user.toString() || (message.guild && message.content === message.guild.me.toString())) {
        return message.channel.send(`The prefix is \`${client.config.prefix}\`.`);
    }

    // Also good practice to ignore any message that does not start with our prefix, which is set in the configuration file.
    if (message.content.indexOf(client.config.prefix) !== 0) return;

    // Splits on line returns, then on spaces to preserve the line returns
    const nArgs = message.content.split(/(\n+)/);
    let args = [];
    nArgs.forEach(e => {
        const ne = e.split(' ').filter(String);
        args = args.concat(ne);    
    });

    // Get the command name/ remove it from the args
    const command = args.shift().slice(client.config.prefix.length).toLowerCase();

    // Get the user or member's permission level from the elevation
    const level = client.permlevel(message);

    // Check whether the command, or alias, exist in the collections defined in swgohbot.js.
    const cmd = client.commands.get(command) || client.commands.get(client.aliases.get(command));

    // Some commands may not be useable in DMs. This check prevents those commands from running
    // and return a friendly error message.
    if (cmd && !message.guild && cmd.conf.guildOnly) {
        return message.channel.send(message.language.BASE_COMMAND_UNAVAILABLE).then(msg => msg.delete(4000)).catch(console.error);
    }

    // If the command exists, **AND** the user has permission, run it.
    if (cmd && level >= cmd.conf.permLevel) {
        if (message.guild) {
            const defPerms = ['SEND_MESSAGES', 'VIEW_CHANNEL'];
            if (args.length === 1 && args[0].toLowerCase() === 'help') {
                // If they want the help, it's embeds now, so they need that activated
                defPerms.push('EMBED_LINKS');
            }
            // Merge the permission arrays to make sure it has at least the minimum
            const perms = [...new Set([...defPerms, ...cmd.conf.permissions])];
            const missingPerms = message.channel.permissionsFor(message.guild.me).missing(perms);

            if (missingPerms.length > 0) {
                // If it can't send messages, don't bother trying
                if (missingPerms.includes('SEND_MESSAGES')) return;
                // Make it more readable
                missingPerms.forEach((p, ix) => {missingPerms[ix] = p.replace('_', ' ').toProperCase();});
                return message.channel.send(`This bot is missing the following permissions to run this command here: \`${missingPerms.join(', ')}\``);
            }
        }

        

        const flagArgs = getFlags(cmd.conf.flags, cmd.conf.subArgs, args);
        
        
        // If they're just looking for the help, don't bother going through the command
        if (args.length === 1 && args[0].toLowerCase() === 'help') {
            client.helpOut(message, cmd);
        } else {
            try {
                cmd.run(client, message, args, {
                    level: level,
                    flags: flagArgs.flags,
                    subArgs: flagArgs.subArgs
                });
            } catch (err) {
                client.log('ERROR', `I broke: ${err}`, cmd.help.name.toProperCase());
            }
        }
        if (client.config.logs.logComs) {
            client.commandLogs.create({
                id: `${cmd.help.name}-${message.author.id}-${message.id}`,
                commandText: args.join(' ')
            });
        }
    }
};

// Checks for any args that start with - or -- that match what the command is looking for
function checkForArgs(key, args) {
    if (args.includes('-'+key)) { 
        return [true, '-'+key];
    } else if (args.includes('--'+key)) {
        return [true, '--'+key];
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
                break;
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

