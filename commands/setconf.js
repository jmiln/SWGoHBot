// Initialize **or load** the server configurations
const PersistentCollection = require("djs-collection-persistent");
const settings = require('../settings.json');

exports.run = (client, message, args) => {
    const guildSettings = client.guildSettings;
    const guildConf = guildSettings.get(message.guild.id); 

    if(guildConf) {
        if(message.member.roles.has(guildConf["adminRole"] || message.author.id === message.guild.owner.id)) {
            return message.reply(`Sorry, but either you're not an admin, or your server leader has not set up the configs`);
        }
        const key = args[0];
        // Since we inserted an object, it comes back as an object, and we can use it with the same properties:
        if(!guildConf.hasOwnProperty(key)) return message.reply("This key is not in the configuration.");

        // Now we can finally change the value. Here we only have strings for values so we won't
        // bother trying to make sure it's the right type and such. 
        const value = args.splice(1).join(" ");

        lowerKey = key.toLowerCase();
        if(lowerKey ==="adminrole" || lowerKey === "modrole" || lowerKey === "welcomemessage") {
            // If they are trying to change any of the string based ones
            guildConf[key] = value;
        } else if(lowerKey === "welcomemessageon" || lowerKey === "fancymods") {
            // If they are trying to change a true/false one
            lowerValue = value.toLowerCase();
            if(lowerValue === "true" || lowerValue === "on" || lowerValue === "enable") {
                guildConf[key] = true;
            } else if(lowerValue === "false" || lowerValue === "off" || lowerValue === "disable") {
                guildConf[key] = false;
            } else {
                return message.reply(`Invalid value, try true or false`);
            }
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
    permLevel: 0,
    type: 'admin'
};

exports.help = {
    name: 'setconf',
    description: 'Used to set the bot\'s config settings',
    usage: 'setconf [key] [value]'
};

