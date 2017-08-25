exports.run = async (client, message, args) => {
    const guildSettings = client.guildSettings;

    if (!args[0]) return message.channel.send(`Need args here`);

    let count = 0;
    const validAnswers = ['yes', 'y', 'no', 'n'];

    if (args[0] === 'replace') {
        if (!args[1] || !args[2]) return message.channel.send(`Needs two arguments here. Usage: \`editconfs replace [replaceThis] [withThis]\``);

        const oldKey = args[1];
        const newKey = args[2];

        const response = await client.awaitReply(message, `Are you sure you want to replace \`${oldKey}\` with \`${newKey}\`? (yes/no)`);
        if (validAnswers.includes(response.toLowerCase())) {
            if (response === "yes" || response === 'y') {
                const  guildList = client.guilds.keyArray();
                // let guildList = [message.guild.id];

                guildList.forEach(g => {
                    var guildConf = guildSettings.get(g);
                    if (guildConf) {
                        if (guildConf[oldKey]) {
                            var oldKeyValue = guildConf[oldKey];
                            delete guildConf[oldKey];
                            guildConf[newKey] = oldKeyValue;
                            guildSettings.set(g, guildConf);
                            count++;
                        }
                    }
                });
                await message.reply(`Replacing \`${oldKey}\` with \`${newKey}\` in ${count} configs.`);
            } else if (response === 'no' || response === 'n') {
                return await message.reply("Canceling replacement.");
            }
        } else {
            return await message.channel.send(`Only \`${validAnswers.join('`, `')}\` are valid, please use one of those.`).then(msg => msg.delete(4000)).catch(console.error);
        }
    } else if (args[0] === 'add') { // To add a new value into the guildSettings
        if (!args[1]) return message.channel.send(`Needs two arguments here. Usage: \`editconfs add [newKey]\``).then(msg => msg.delete(4000)).catch(console.error);

        const fillers = ["-emptyString", "-emptyArray", "-emptyObject"];

        const newKey = args[1];
        var newKeyValue = "";
        if (fillers.includes(newKey)) {
            if (newKey === "-emptyString") {
                newKeyValue = "";
            } else if (newKey === "-emptyArray") {
                newKeyValue =  [];
            } else if (newKey === "-emptyObject") {
                newKeyValue =  {};
            } 
        } else if (newKey !== "") {
            newKeyValue = args.splice(2).join(" ");
        }

        const response = await client.awaitReply(message, `Are you sure you want to add \`${newKey}\` with a value of \`${newKeyValue}\`? (yes/no)`);
        if (validAnswers.includes(response.toLowerCase())) {
            if (response === "yes" || response === 'y') {
                const guildList = client.guilds.keyArray();

                guildList.forEach(g => {
                    var guildConf = guildSettings.get(g);
                    if (guildConf) {
                        if (!guildConf[newKey]) {
                            guildConf[newKey] = newKeyValue;
                            guildSettings.set(g, guildConf);
                            count++;
                        }
                    }
                });
                await message.reply(`Added \`${newKey}\` with value \`${newKeyValue}\` to ${count} configs.`);
            } else if (response === 'no' || response === 'n') {
                return await message.reply("Canceling add.");
            }
        } else {
            return await message.channel.send(`Only \`${validAnswers.join('`, `')}\` are valid, please use one of those.`).then(msg => msg.delete(4000)).catch(console.error);
        }
    } else if (args[0] === 'remove') {
        if (!args[1]) return message.channel.send(`Needs an argument here. Usage: \`editconfs remove [oldKey]\``);

        const oldKey = args[1];

        const response = await client.awaitReply(message, `Are you sure you want to remove \`${oldKey}\`? (yes/no)`);
        if (validAnswers.includes(response.toLowerCase())) {
            if (response === "yes" || response === 'y') {
                const guildList = client.guilds.keyArray();

                guildList.forEach(g => {
                    var guildConf = guildSettings.get(g);
                    if (guildConf) {
                        if (guildConf[oldKey]) {
                            delete guildConf[oldKey];
                            guildSettings.set(g, guildConf);
                            count++;
                        }
                    }
                });
                await message.reply(`Removed \`${oldKey}\`. from ${count} configs`);
            } else if (response === 'no' || response === 'n') {
                return await message.reply("Canceling removal.");
            }
        } else {
            return await message.channel.send(`Only \`${validAnswers.join('`, `')}\` are valid, please use one of those.`).then(msg => msg.delete(4000)).catch(console.error);
        }
    } else if (args[0] === 'replaceType') {
        const fillers = ["-array"];

        const key = args[1];
        const newType = args[2];

        if (fillers.includes(newType)) {
            if (newType === '-array') {
                const  guildList = client.guilds.keyArray();
                
                guildList.forEach(g => {
                    var guildConf = guildSettings.get(g);
                    if (guildConf) {
                        if (guildConf[key]) {
                            if (typeof guildConf[key] === 'string') {
                                var oldKeyValue = guildConf[key];
                                guildConf[key] = [oldKeyValue];
                                guildSettings.set(g, guildConf);
                                count++;
                            }
                        }
                    }
                });
                await message.reply(`Changed type of  \`${key}\`. from ${count} configs`);
            }
        }
    } else if (args[0] === 'help') {
        return message.channel.send(`**Extended help for ${this.help.name}** \n**Usage**: ${this.help.usage} \n${this.help.extended}`);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['edit', 'editconf'],
    permLevel: 10
};

exports.help = {
    name: 'editconfs',
    category: 'Dev',
    description: 'Edit the configs for all guilds the bot is in.',
    usage: 'editconfs [replace|remove|add|replaceType] [var1] [var2]',
    extended: `\`\`\`asciidoc
replace        :: Replaces what the key is called (Can be used to reorder the list).
remove         :: Removes a key from the configs
add            :: Adds a key to the configs. Use one of these for an empty var: \`-emptyString, -emptyArray, -emptyObject\`
replaceType    :: Changes the type from a string to being in an array 
help           :: Shows this help message.
\`\`\``
};
