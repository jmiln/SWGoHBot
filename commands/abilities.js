exports.run = (client, message, args) => {
    const config = client.config;
    const charList = client.characters;

    const searchName = String(args.join(' ')).toLowerCase().replace(/[^\w\s]/gi, '');

    let embeds = true;
 
    const guildConf = message.guildSettings;
    if (message.guild) {
        if (guildConf['useEmbeds'] !== true || !message.channel.permissionsFor(client.user).has('EMBED_LINKS')) {
            embeds = false;
        }
    }

    const zeta = client.emojis.find("name", "zeta");
    const omega = client.emojis.find("name", "omega");
    const abilityMatMK3 = client.emojis.find("name", "abilityMatMK3");

    // Make sure they gave a character to find
    if (searchName === "") {
        return message.channel.send(message.language.COMMAND_ABILITIES_NEED_CHARACTER(config.prefix, this.help.usage)).then(msg => msg.delete(4000)).catch(console.error);
    }

    // Find any characters that match that
    const chars = client.findChar(searchName, charList);
    if (chars.length <= 0) {
        return message.channel.send(message.language.COMMAND_ABILITIES_INVALID_CHARACTER(config.prefix, this.help.usage)).then(msg => msg.delete(4000)).catch(console.error);        
    }

    chars.forEach(character => {
        if (embeds) { // if Embeds are enabled
            const fields = [];
            for (const ability in character.abilities) {
                const abilities = character.abilities[ability];
                
                var mat = omega;
                if (abilities.tier === 'zeta') {
                    mat = zeta;
                } else if (abilities.tier === 'abilityMatMK3') {
                    mat = abilityMatMK3;
                }

                var cooldownString = "";
                if (abilities.abilityCooldown > 0) {
                    cooldownString = message.language.COMMAND_ABILITIES_COOLDOWN(abilities.abilityCooldown);
                }
            
                fields.push({
                    "name": ability,
                    "value": message.language.COMMAND_ABILITIES_ABILITY(abilities.type, mat, cooldownString, abilities.abilityDesc)
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
            for (const ability in character.abilities) {
                const abilities = character.abilities[ability];
                abilityString += message.language.COMMAND_ABILITIES_ABILITY_CODE(ability, abilities.type, abilities.tier, abilities.abilityDesc);
            }
            message.channel.send(` * ${character.name} * \n${abilityString}`, { code: 'md', split: true });
        }
    });         
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
    usage: 'abilities <character>',
    example: `;abilities rex`,
    extended: `\`\`\`asciidoc
No extended help for this command.
    \`\`\``
};

