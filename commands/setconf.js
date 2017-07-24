exports.run = (client, message, args) => {
    const config = client.config;
    const guildSettings = client.guildSettings;

    if(!message.guild) return message.reply(`Sorry, something went wrong, please try again`);

    const guildConf = guildSettings.get(message.guild.id); 

    if(guildConf) {
        if(!message.author.id === message.guild.owner.id) {
            if(!message.member.roles.has(guildConf["adminRole"])) {
                return message.reply(`Sorry, but either you're not an admin, or your server leader has not set up the configs.`);
            }
        }
        if(!args[0]) return message.reply(`You must select a config option to change.`);
        const key = args[0].toLowerCase();
        
        if(!args[1]) return message.reply(`You must give a value to change that option to.`);
        const value = args.splice(1).join(" ");

        const onVar =  ["true", "on", "enable"];
        const offVar = ["false", "off", "disable"];

        // Now we can finally change the value. Here we only have strings for values so we won't
        // bother trying to make sure it's the right type and such. 
        newKey = "";
        switch(key) {
            case "adminrole":
                newKey = "adminRole";
                guildConf["adminRole"] = value;
                break;
            case "modrole":
                newKey = "modRole";
                guildConf["modRole"] = value;
                break;
            case "welcomemessageon":
                newKey = "welcomeMessageOn";
                if(onVar.includes(value.toLowerCase())) {
                    guildConf["welcomeMessageOn"] = true;
                } else if(offVar.includes(value.toLowerCase())) {
                    guildConf["welcomeMessageOn"] = false;
                } else {
                    return message.reply(`Invalid value, try true or false`);
                }
                break;
            case "welcomemessage":
                newKey = "welcomeMessage";
                guildConf["welcomeMessage"] = value;
                break;
            case "useembeds":
                newKey = "useEmbeds";
                if(onVar.includes(value.toLowerCase())) {
                    guildConf["useEmbeds"] = true;
                } else if(offVar.includes(value.toLowerCase())) {
                    guildConf["useEmbeds"] = false;
                } else {
                    return message.reply(`Invalid value, try true or false`);
                }
                break;
            default:
                return message.reply("This key is not in the configuration.");
        }

        // Then we re-apply the changed value to the PersistentCollection
        guildSettings.set(message.guild.id, guildConf);

        // We can confirm everything's done to the client.
        message.channel.send(`Guild configuration item ${key} has been changed to:\n\`${value}\``);
    } else {
        message.channel.send(`No guild settings found, run \`${settings.prefix}showconf\` to build them.`);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['setconfig'],
    permLevel: 3
};

exports.help = {
    name: 'setconf',
    category: 'Admin',
    description: 'Used to set the bot\'s config settings.',
    usage: 'setconf [key] [value]',
    example: 'setconf adminRole Admin'
};

