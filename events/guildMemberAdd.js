// Initialize **or load** the server configurations
const PersistentCollection = require("djs-collection-persistent");
// const guildSettings = new PersistentCollection({name: 'guildSettings'});

const Discord = require('discord.js');
// const client = new Discord.Client();
// const guildSettings = client.guildSettings;

module.exports = member => {
    // This executes when a member joins, so let's welcome them!
    const guildSettings = member.client.guildSettings;
    const guildConf = guildSettings.get(member.guild.id);
    // console.log(`Member joined, name is ${member.displayName}, to the guild ${member.guild.id}`);

    // Our welcome message has a bit of a placeholder, let's fix
    if(guildConf.welcomeMessageOn && guildConf.welcomeMessage !== "") { // If they have it turned on, and it's not empty
        const welcomeMessage = guildConf.welcomeMessage.toString();
        console.log(`New member joined, welcome message should be "${welcomeMessage}" before the replalce.`)

        // We'll send to the default channel - not the best practice, but whatever
        if(welcomeMessage.includes("{{user}}")) {  // So id doesn't crash if it's not there
            member.guild.defaultChannel.send(welcomeMessage.replace("{{user}}", member.user.tag)).catch(console.error);
        } else {
            member.guild.defaultChannel.send(welcomeMessage).catch(console.error);
        }
    }

};
