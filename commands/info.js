exports.run = (client, message) => {

    let changes = [
        "Added the **modsets** command",
        "Fixed a bunch of bugs and crashes",
        "Added the **info** command to replace multiple others",
        "Added the **raidteams** command"
    ]


    // message.channel.send({embed:{ 
    //     "color": 547474, 
    //     "author": {
    //         "name": "Information"
    //     },
    //     "fields": [{
    //         "name": "Links", 
    //         "value": "Join the bot support server here \nhttps://discord.gg/FfwGvhr\nInvite the bot with this link\nhttps://discordapp.com/oauth2/authorize?permissions=67624000&scope=bot&client_id=315739499932024834"
    //     },
    //     {
    //         "name": "Recent Changes",
    //         "value": `${changes.join('\n')}`
    //     }] 
    // }});
    message.channel.send(`**### INFORMATION ###** \n**Links**\nJoin the bot support server here \n<https://discord.gg/FfwGvhr>\nInvite the bot with this link\n<https://discordapp.com/oauth2/authorize?permissions=67624000&scope=bot&client_id=315739499932024834>\n\n**Recent Changes**\n${changes.join('\n')}`);
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 0,
    type: 'other'
};

exports.help = {
    name: 'info',
    description: 'Shows useful links and recent changes.',
    usage: 'info'
};
