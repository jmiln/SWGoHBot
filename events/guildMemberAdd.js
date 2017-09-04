module.exports = (client, member) => {
    // This executes when a member joins, so let's welcome them!
    const guildConf = client.guildSettings.get(member.guild.id);
    const guild = member.guild;

    // Make sure the config option exists. Should not need this, but just in case
    if(!guildConf['announceChan']) {
        guildConf['announceChan'] = '';
        guildSettings.set(guild.id, guildConf);
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
            channel.send(welcomeMessage);
        }
    }
};
