var moment = require('moment-timezone');

exports.run = (client, message, args) => {
    const config = client.config;
    const guildSettings = client.guildSettings;

    if (!message.guild) return message.reply(`Sorry, something went wrong, please try again`);

    const guildConf = guildSettings.get(message.guild.id);

    if (guildConf) {
        if (message.author.id !== message.guild.owner.id) {
            if (!message.member.roles.has(guildConf["adminRole"])) {
                return message.reply(`Sorry, but either you're not an admin, or your server leader has not set up the configs.`);
            }
        }
        if (!args[0]) return message.reply(`You must select a config option to change.`);
        const key = args[0].toLowerCase();

        if (!args[1]) return message.reply(`You must give a value to change that option to.`);
        const value = args.splice(1).join(" ");

        const onVar = ["true", "on", "enable"];
        const offVar = ["false", "off", "disable"];

        // Now we can finally change the value. Here we only have strings for values so we won't
        // bother trying to make sure it's the right type and such. 
        newKey = "";
        switch (key) {
            case "adminrole":
                newKey = "adminRole";
                guildConf[newKey] = value;
                break;
            case "enablewelcome":
                newKey = "enableWelcome";
                if (onVar.includes(value.toLowerCase())) {
                    guildConf[newKey] = true;
                } else if (offVar.includes(value.toLowerCase())) {
                    guildConf[newKey] = false;
                } else {
                    return message.reply(`Invalid value, try true or false`);
                }
                break;
            case "welcomemessage":
                newKey = "welcomeMessage";
                guildConf[newKey] = value;
                break;
            case "useembeds":
                newKey = "useEmbeds";
                if (onVar.includes(value.toLowerCase())) {
                    guildConf[newKey] = true;
                } else if (offVar.includes(value.toLowerCase())) {
                    guildConf[newKey] = false;
                } else {
                    return message.reply(`Invalid value, try true or false`);
                }
                break;
            case "timezone":
                newKey = "timezone";
                if (moment.tz.zone(value)) { // Valid time zone
                    guildConf(newKey) = value;
                } else { // Not so valid
                    return message.reply(`Invalid timezone, look here https://en.wikipedia.org/wiki/List_of_tz_database_time_zones 
                    and find the one that you need, then enter what it says in the TZ column`);                
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
        message.channel.send(`No guild settings found, run \`${config.prefix}showconf\` to build them.`);
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
    extended: `\`\`\`md
adminRole      :: The role that you want to be able to modify bot settings or set up events.
enableWlecome  :: Toggles the welcome message on/ off.
welcomeMessage :: The welcome message to send it you have it enabled. '{{user}}' gets replaced with the new user's name.
useEmbeds      :: Toggles whether or not to use embeds for the mods output.
timezone       :: Sets the timezone that you want all time related commands to use.
\`\`\``,
    example: 'setconf adminRole Admin\nOr "setconf help" for more info'
};