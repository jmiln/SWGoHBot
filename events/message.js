// The MESSAGE event runs anytime a message is received
// Note that due to the binding of client to every event, every event
// goes `client, other, args` when this function is run.

module.exports = (client, message) => {
    // It's good practice to ignore other bots. This also makes your bot ignore itself
    // and not get into a spam loop (we call that "botception").
    if (message.author.bot) return;

    // Grab the settings for this server from the PersistentCollection
    // If there is no guild, get default conf (DMs)
    const guildSettings = message.guild ? client.guildSettings.get(message.guild.id) : client.config.defaultSettings;
        
    // For ease of use in commands and functions, we'll attach the settings
    // to the message object, so `message.guildSettings` is accessible.
    message.guildSettings = guildSettings;

    // Also good practice to ignore any message that does not start with our prefix,
    // which is set in the configuration file.
    if (message.content.indexOf(client.config.prefix) !== 0) return;

    // If we don't have permission to respond, don't bother
    if(message.guild && !message.channel.permissionsFor(message.guild.me).has("SEND_MESSAGES")) return;

    // Here we separate our "command" name, and our "arguments" for the command.
    // e.g. if we have the message "+say Is this the real life?" , we'll get the following:
    // command = say
    // args = ["Is", "this", "the", "real", "life?"]
    const args = message.content.split(/\s+/g);
    const command = args.shift().slice(client.config.prefix.length).toLowerCase();

    // Get the user or member's permission level from the elevation
    const level = client.permlevel(message);

    // Check whether the command, or alias, exist in the collections defined
    // in app.js.
    const cmd = client.commands.get(command) || client.commands.get(client.aliases.get(command));
    // using this const varName = thing OR otherthing; is a pretty efficient
    // and clean way to grab one of 2 values!

    // Some commands may not be useable in DMs. This check prevents those commands from running
    // and return a friendly error message.
    if (cmd && !message.guild && cmd.conf.guildOnly) {
        return message.channel.send("This command is unavailable via private message. Please run this command in a guild.").then(msg => msg.delete(4000)).catch(console.error);
    }

    // If the command exists, **AND** the user has permission, run it.
    if (cmd && level >= cmd.conf.permLevel) {
        cmd.run(client, message, args, level);
    }
};
