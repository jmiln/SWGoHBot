module.exports = (client, member) => {
    // This executes when a member joins, so let's welcome them!
    const guildConf = client.guildSettings.get(member.guild.id);

    // Our welcome message has a bit of a placeholder, let's fix
    if (guildConf.enableWelcome && guildConf.welcomeMessage !== "") { // If they have it turned on, and it's not empty
        let welcomeMessage = guildConf.welcomeMessage.toString();

        // We'll send to the default channel - not the best practice, but whatever
        if (welcomeMessage.includes("{{user}}")) { 
            welcomeMessage = welcomeMessage.replace("{{user}}", member.user.username);
        } 
        if (welcomeMessage.includes("{{userMention}}")) { 
            welcomeMessage = welcomeMessage.replace("{{userMention}}", member.user);
        } 
        member.guild.defaultChannel.send(welcomeMessage).catch(console.error);
    }
};
