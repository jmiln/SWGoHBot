const {inspect} = require('util');
module.exports = async (client, member) => {
    // This executes when a member joins, so let's welcome them!
    const guild = member.guild;
    const guildSettings = await client.guildSettings.findOne({where: {guildID: guild.id}, attributes: ['adminRole', 'enableWelcome', 'useEmbeds', 'welcomeMessage', 'timezone', 'announceChan']});
    const guildConf = guildSettings.dataValues;

    // Make sure the config option exists. Should not need this, but just in case
    if(!guildConf['announceChan']) {
        guildConf['announceChan'] = '';
        client.guildSettings.set(guild.id, guildConf);
    }

    // Our welcome message has a bit of a placeholder, let's fix
    if (guildConf.enableWelcome && guildConf.welcomeMessage !== "" && guildConf.announceChan !== "") { // If they have it turned on, and it's not empty
        var channel = guild.channels.find('name', guildConf['announceChan']);
        if (channel && channel.permissionsFor(guild.me).has(["SEND_MESSAGES", "READ_MESSAGES"])) {
            if(!channel) return;  // No reason for it to ever do this, but it's still breaking for some reason with the .send
            let welcomeMessage = guildConf.welcomeMessage.toString();

            if (welcomeMessage.includes("{{user}}")) {
                welcomeMessage = welcomeMessage.replace("{{user}}", member.user.username);
            }
            if (welcomeMessage.includes("{{userMention}}")) {
                welcomeMessage = welcomeMessage.replace("{{userMention}}", member.user);
            }
            // client.log('HERE', `This should be a channel: ${channel}`);
            try {
                channel.send(welcomeMessage);
            } catch (e) {
                client.log('ERROR', `Error sending welcomeMessage:\n\nGuildConf:\n${inspect(guildConf)}\n\nError:\n${e}`);
            } 
        }
    }
};
