// const settings = require('../settings.json');
// module.exports = message => {
//     let client = message.client;
//     if (message.author.bot) return;
//     if (!message.content.startsWith(settings.prefix)) return;
//     let command = message.content.split(' ')[0].slice(settings.prefix.length);
//     let params = message.content.split(' ').slice(1);
//     let perms = client.elevation(message);
//     let cmd;
//     if (client.commands.has(command)) {
//         cmd = client.commands.get(command);
//     } else if (client.aliases.has(command)) {
//         cmd = client.commands.get(client.aliases.get(command));
//     }
//     if (cmd) {
//         if (perms < cmd.conf.permLevel) return;
//         cmd.run(client, message, params, perms);
//     }
//
// };

// The MESSAGE event runs anytime a message is received
// Note that due to the binding of client to every event, every event
// goes `client, other, args` when this function is run.

module.exports = (client, message) => {
	// It's good practice to ignore other bots. This also makes your bot ignore itself
	// and not get into a spam loop (we call that "botception").
	if(message.author.bot) return;

	// Grab the settings for this server from the PersistentCollection
	if(!message.guild) return;
	const guildSettings = client.guildSettings.get(message.guild.id);

	// For ease of use in commands and functions, we'll attach the settings
	// to the message object, so `message.settings` is accessible.
	message.guildSettings = guildSettings;

	// Also good practice to ignore any message that does not start with our prefix,
	// which is set in the configuration file.
	if(message.content.indexOf(client.config.prefix) !== 0) return;

	// Here we separate our "command" name, and our "arguments" for the command.
	// e.g. if we have the message "+say Is this the real life?" , we'll get the following:
	// command = say
	// args = ["Is", "this", "the", "real", "life?"]
	const args = message.content.split(/\s+/g);
	const command = args.shift().slice(settings.prefix.length).toLowerCase();

	// Get the user or member's permission level from the elevation
	const level = client.permlevel(message);

	// Check whether the command, or alias, exist in the collections defined
	// in app.js.
	const cmd = client.commands.get(command) || client.commands.get(client.aliases.get(command));
	// using this const varName = thing OR otherthing; is a pretty efficient
	// and clean way to grab one of 2 values!

	// If the command exists, **AND** the user has permission, run it.
	if (cmd && level >= cmd.conf.permLevel) {
		client.log("log", `${message.guild.name}/#${message.channel.name}:
			${message.author.username} (${message.author.id}) ran command ${cmd.help.name}`, "CMD");
		cmd.run(client, message, args, level);
	}
};
