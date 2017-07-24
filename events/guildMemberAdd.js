const PersistentCollection = require("djs-collection-persistent");
const Discord = require('discord.js');

module.exports = (client, member) => {
    // This executes when a member joins, so let's welcome them!
    if(!message.guild) return;
    const guildConf = client.guildSettings.get(member.guild.id);

    // Our welcome message has a bit of a placeholder, let's fix
    if(guildConf.welcomeMessageOn && guildConf.welcomeMessage !== "") { // If they have it turned on, and it's not empty
        const welcomeMessage = guildConf.welcomeMessage.toString();

        // We'll send to the default channel - not the best practice, but whatever
        if(welcomeMessage.includes("{{user}}")) {  // So it doesn't crash if it's not there
            member.guild.defaultChannel.send(welcomeMessage.replace("{{user}}", member.user.username)).catch(console.error);
        } else {
            member.guild.defaultChannel.send(welcomeMessage).catch(console.error);
        }
    }

};
