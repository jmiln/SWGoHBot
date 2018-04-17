// The MESSAGE event runs anytime a message is received
// Note that due to the binding of client to every event, every event
// goes `client, other, args` when this function is run.

module.exports = async (client, message) => {
    // It's good practice to ignore other bots. This also makes your bot ignore itself
    // and not get into a spam loop (we call that "botception").
    if (message.author.bot) return;
    if (message.guild && !message.guild.me) await message.guild.members.fetch(this.client.user);
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

    // Here we separate our "command" name, and our "arguments" for the command.
    // e.g. if we have the message "+say Is this the real life?" , we'll get the following:
    // command = say
    // args = ["Is", "this", "the", "real", "life?"]
    const args = message.content.split(/\s+/g);
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
                missingPerms.forEach((p, ix) => {missingPerms[ix] = p.replace('_', ' ').toProperCase();});
                try {
                    return message.channel.send(`This bot is missing the following permissions to run this command here: \`${missingPerms.join(', ')}\``);
                } catch (err) { 
                    /* stuff */ 
                    console.log('Broke trying to report missing Perms for (${cmd.help.name}): ' + err);
                }
            }
        }

        // If they're just looking for the help, don't bother going through the command
        if (args.length === 1 && args[0].toLowerCase() === 'help') {
            client.helpOut(message, cmd);
        } else {
            try {
                cmd.run(client, message, args, level);
            } catch (err) {
                client.log('ERROR', `Command ${cmd.help.name} broke: ${err}`);
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

