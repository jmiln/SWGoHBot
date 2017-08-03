const PersistentCollection = require("djs-collection-persistent");
const util = require('util');

exports.run = async(client, message, args) => {
    config = client.config;
    const guildSettings = client.guildSettings;
    const defaultSettings = client.config.defaultSettings;

    if (!args[0]) return message.channel.send(`Need args here`);

    if (args[0] === 'replace') {
        if (!args[1] || !args[2]) return message.channel.send(`Needs two arguments here. Usage: \`editconfs replace [replaceThis] [withThis]\``);

        let oldKey = args[1];
        let newKey = args[2];

        const response = await client.awaitReply(message, `Are you sure you want to replace \`${oldKey}\` with \`${newKey}\`? (yes/no)`);
        const validAnswers = ['yes', 'y', 'no', 'n'];
        if (validAnswers.includes(response.toLowerCase())) {
            if (response === "yes" || response === 'y') {
                let guildList = client.guilds.keyArray();
                // let guildList = [message.guild.id];

                guildList.forEach(g => {
                    guildConf = guildSettings.get(g);
                    if (guildConf) {
                        oldKeyValue = guildConf[oldKey];
                        delete guildConf[oldKey];
                        guildConf[newKey] = oldKeyValue;
                        guildSettings.set(g, guildConf);
                    }
                });
                await message.reply(`Replacing \`${oldKey}\` with \`${newKey}\`.`)
            } else if (response === 'no' || response === 'n') {
                return await message.reply("Canceling replacement.");
            }
        } else {
            return await message.channel.send(`Only \`${validAnswers.join('`, `')}\` are valid, please use one of those.`).catch(() => console.error);
        }
    } else if (args[0] === 'add') { // To add a new value into the guildSettings
        if (!args[1]) return message.channel.send(`Needs two arguments here. Usage: \`editconfs add [newKey]\``);

        let newKey = args[1];
        let newKeyValue = "";
        if (args[2]) {
            newKeyValue = args.splice(2).join(" ");
        }

        const response = await client.awaitReply(message, `Are you sure you want to add \`${newKey}\` with a value of \`${newKeyValue}\`? (yes/no)`);
        const validAnswers = ['yes', 'y', 'no', 'n'];
        if (validAnswers.includes(response.toLowerCase())) {
            if (response === "yes" || response === 'y') {
                let guildList = client.guilds.keyArray();

                guildList.forEach(g => {
                    guildConf = guildSettings.get(g);
                    if (guildConf) {
                        guildConf[newKey] = newKeyValue;
                        guildSettings.set(g, guildConf);
                    }
                });
                await message.reply(`Added \`${newKey}\` with value \`${newKeyValue}\`.`)
            } else if (response === 'no' || response === 'n') {
                return await message.reply("Canceling add.");
            }
        } else {
            return await message.channel.send(`Only \`${validAnswers.join('`, `')}\` are valid, please use one of those.`).catch(() => console.error);
        }
    } else if (args[0] === 'remove') {
        if (!args[1]) return message.channel.send(`Needs an argument here. Usage: \`editconfs remove [oldKey]\``);

        let oldKey = args[1];

        const response = await client.awaitReply(message, `Are you sure you want to remove \`${oldKey}\`? (yes/no)`);
        const validAnswers = ['yes', 'y', 'no', 'n'];
        if (validAnswers.includes(response.toLowerCase())) {
            if (response === "yes" || response === 'y') {
                let guildList = client.guilds.keyArray();

                guildList.forEach(g => {
                    guildConf = guildSettings.get(g);
                    if (guildConf) {
                        delete guildConf[oldKey];
                        guildSettings.set(g, guildConf);
                    }
                });
                await message.reply(`Removed \`${oldKey}\`.`)
            } else if (response === 'no' || response === 'n') {
                return await message.reply("Canceling removal.");
            }
        } else {
            return await message.channel.send(`Only \`${validAnswers.join('`, `')}\` are valid, please use one of those.`).catch(() => console.error);
        }
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    permLevel: 10
};

exports.help = {
    name: 'editconfs',
    category: 'Dev',
    description: 'Edit the configs for all guilds the bot is in.',
    usage: 'editconfs [replace|remove|add] [var1] [var2]'
};