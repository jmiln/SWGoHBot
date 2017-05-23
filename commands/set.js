exports.run = (client, message, args) => {
    if(args[0].toLowerCase() === "game") {
	if(!args[1]) {
	    client.user.setGame("");
	    } else {
		client.user.setGame(args[1].toString());
	    }
    } else if(args[0].toLowerCase() === "status") {
        client.user.setStatus(args[1].toString());
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 4
};

exports.help = {
    name: 'set',
    description: 'Changes the bot\'s game or status',
    usage: 'set [game|status] [name]'
};

