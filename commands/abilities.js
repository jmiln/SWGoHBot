exports.run = (client, message, args) => {
    const config = client.config;
    const guildSettings = client.guildSettings;
    const charList = client.characters;

    if (!message.guild) return message.reply(`Sorry, something went wrong, please try again`);
    const guildConf = guildSettings.get(message.guild.id);

    const searchName = String(args.join(' ')).toLowerCase().replace(/[^\w\s]/gi, '');

    let found = false;
    let modSetString = "";

    let embeds = false;
    if (guildConf['useEmbeds'] === true && message.channel.permissionsFor(client.user).has('EMBED_LINKS')) {
        embeds = true;
    }

    const zeta = client.emojis.find("name", "zeta");
    const omega = client.emojis.find("name", "omega");
    const abilityMatMK3 = client.emojis.find("name", "abilityMatMK3");

    if (searchName !== "") {
        for (var ix = 0; ix < charList.length; ix++) {
            var character = charList[ix];
            for (var jx = 0; jx < character.aliases.length; jx++) {
                if (searchName.toLowerCase() === character.aliases[jx].toLowerCase()) {
                    // Found the character, now just need to show it
                    found = true;

                    if (embeds) { // if Embeds are enabled
                        const fields = [];
                        for (var ability in character.abilities) {
                            const abilities = character.abilities[ability];

                            var mat = omega;
                            if(abilities.tier === 'zeta') {
                                mat = zeta;
                            } else if(abilities.tier === 'abilityMatMK3'){
                                mat = abilityMatMK3;
                            }

                            fields.push({
                                "name": ability,
                                "value": `**Ability Type:** ${abilities.type}     **Max ability mat needed:** ${mat}\n${abilities.abilityDesc}`
                            });
                        }
                        message.channel.send({
                            embed: {
                                "color": `${character.side === "light" ? 0x5114e0 : 0xe01414}`,
                                "author": {
                                    "name": character.name,
                                    "url": character.url,
                                    "icon_url": character.avatarURL
                                },
                                "fields": fields
                            }
                        });
                    } else { // Embeds are disabled
                        let abilityString = "";
                        for (var ability in character.abilities) {
                            const abilities = character.abilities[ability];

                            abilityString += `### ${ability} ###\n* Ability type: ${abilities.type}\n* Max ability mat needed: ${abilities.tier}\n* Description: ${abilities.abilityDesc}\n\n`
                        }
                        message.channel.send(` * ${character.name} * \n${abilityString}`, { code: 'md' });
                    }
                }
            }
        }

        if (found === false) {
            message.channel.send(`Invalid character, usage is \`${config.prefix}${this.help.name} [character]\``).then(msg => msg.delete(4000)).catch(console.error);
        }
    } else {
        message.channel.send(`Invalid character, usage is \`${config.prefix}${this.help.name} [character]\``).then(msg => msg.delete(4000)).catch(console.error);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['a'],
    permLevel: 0
};

exports.help = {
    name: 'abilities',
    category: 'Star Wars',
    description: 'Shows the abilities for the specified character.',
    usage: 'abilities [character]'
};
