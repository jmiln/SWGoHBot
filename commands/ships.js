const util = require('util');

exports.run = (client, message, args) => {
    const config = client.config;
    const shipList = client.ships;

    // Remove any junk from the name
    const searchName = args.join(' ');

    // Check if it should send as an embed or a code block
    const guildConf = message.guildSettings;
    let embeds = true;
    if (message.guild) {
        if (guildConf['useEmbeds'] !== true || !message.channel.permissionsFor(client.user).has('EMBED_LINKS')) {
            embeds = false;
        }
    }

    // Make sure they gave a character to find
    if (searchName === "") {
        return message.channel.send(`Need a character or ship. Usage is \`${config.prefix}${this.help.usage}\``).then(msg => msg.delete(4000)).catch(console.error);
    }

    // Find any characters that match that
    const ships = client.findShip(searchName, shipList);
    if (ships.length <= 0) {
        return message.channel.send(`Invalid character or ship. Usage is \`${config.prefix}${this.help.usage}\``).then(msg => msg.delete(4000)).catch(console.error);
    } else if(ships.length > 1) {
        return message.channel.send(`I found more than one result from that search. Please try to be more specific.`).then(msg => msg.delete(10000)).catch(console.error);
    }

    const ship = ships[0];

    if (embeds) { // if Embeds are enabled
        const fields = [];

        fields.push({
            "name": 'Crew',
            "value": ship['crew'].join(', ')
        });
        fields.push({
            "name": 'Factions',
            "value": ship['factions'].join(', ')
        });
        for(var ability in ship.abilities) {
            const abilities = ship.abilities[ability]
            fields.push({
                "name": ability,
                "value": `**Ability Type:** ${abilities.type}   **Ability Cooldown:** ${abilities.abilityCooldown} \n${abilities.abilityDesc}`
            });
        }
        message.channel.send({
            embed: {
                "color": `${ship.side === "light" ? 0x5114e0 : 0xe01414}`,
                "author": {
                    "name": ship.name,
                    "url": ship.url,
                    "icon_url": ship.avatarURL
                },
                "fields": fields
            }
        });
    } else { // Embeds are disabled
        let shipString = '';

        shipString += ` * ${ship.name} *\n`;
        shipString += `Crew: ${ship.crew.join(', ')}\n`;
        shipString += `Factions: ${ship.factions.join(', ')}\n\n`;
        shipString += ` * Abilities *\n`;
    
        for(var ability in ship.abilities) {
            const abilities = ship.abilities[ability]
            shipString += `### ${ability} ###\nAbility Type: ${abilities.type}   Ability Cooldown: ${abilities.abilityCooldown}\n${abilities.abilityDesc}\n\n`;
        }

        return message.channel.send(shipString, { code: 'md', split: true });
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ['s', 'ship'],
    permLevel: 0
};

exports.help = {
    name: 'ships',
    category: 'Star Wars',
    description: 'Shows the info about the specified ship.',
    usage: 'ships <ship|character>'
};
