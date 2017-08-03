exports.run = (client, message) => {

    let changes = [
        "Added the **modsets** command",
        "Fixed a bunch of bugs and crashes",
        "Added the **info** command to replace multiple others",
        "Added the **raidteams** command",
        "Added timezone and announceChan to the guild configs",
        "Added the time command to see what time it is in the set timezone",
        "Added the events command so guilds can set events to alert everyone that's online (Cannot set events in the past)",
        "Added the faction command, so you can get a list of the characters in a faction",
        "Added extended help to the editconfs command (DEV-only), and to the setconfs command"
    ]

    message.channel.send(`**### INFORMATION ###** \n**Links**\nJoin the bot support server here \n<https://discord.gg/FfwGvhr>\nInvite the bot with this link\n<https://discordapp.com/oauth2/authorize?permissions=67624000&scope=bot&client_id=315739499932024834>\n\n**Recent Changes**\n${changes.slice(Math.max(changes.length - 4, 1)).join('\n')}`);
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 0
};

exports.help = {
    name: 'info',
    category: 'Misc',
    description: 'Shows useful links and recent changes.',
    usage: 'info'
};
