// const util = require('util');
const Command = require('../base/Command');

class Ships extends Command {
    constructor(client) {
        super(client, {
            name: 'ships',
            aliases: ['s', 'ship'],
            category: 'Star Wars'
        });
    }

    run(client, message, args) {
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
            return message.channel.send(message.language.get('COMMAND_SHIPS_NEED_CHARACTER', message.guildSettings.prefix));
        }

        // Find any characters that match that
        const ships = client.findChar(searchName, shipList, true);
        if (ships.length <= 0) {
            return message.channel.send(message.language.get('COMMAND_SHIPS_INVALID_CHARACTER', message.guildSettings.prefix));
        } else if (ships.length > 1) {
            console.log(ships);
            return message.channel.send(message.language.get('BASE_SWGOH_CHAR_LIST', ships.map(s => `${s.name}${s.crew.length ? '\n' + s.crew.map(c => '- ' + c).join('\n') + '\n' : '\n'}`).join('\n')));
        }

        const ship = ships[0];

        if (embeds) { // if Embeds are enabled
            const fields = [];

            if (ship.crew.length) {
                fields.push({
                    "name": message.language.get('COMMAND_SHIPS_CREW'),
                    "value": ship['crew'].join(', ').toProperCase()
                });
            }
            if (ship.factions.length) {
                fields.push({
                    "name": message.language.get('COMMAND_SHIPS_FACTIONS'),
                    "value": ship['factions'].join(', ').toProperCase()
                });
            }
            if (Object.keys(ship.abilities).length) {
                for (var ability in ship.abilities) {
                    fields.push({
                        "name": ability,
                        "value": message.language.get('COMMAND_SHIPS_ABILITIES', ship.abilities[ability])
                    });
                }
            }
            if (!fields.length) {
                fields.push({
                    "name": 'Error',
                    "value": 'Sorry, but this ship has not been fully updated yet.'
                });
            }
            message.channel.send({
                embed: {
                    "color": `${ship.side === "light" ? 0x5114e0 : 0xe01414}`,
                    "author": {
                        "name": ship.name.toProperCase(),
                        "url": ship.url,
                        "icon_url": ship.avatarURL
                    },
                    "fields": fields
                }
            });
        } else { // Embeds are disabled
            let shipString = '';

            shipString += ` * ${ship.name.toProperCase()} *\n`;
            shipString += `${message.language.get('COMMAND_SHIPS_CREW')}: ${ship.crew.join(', ').toProperCase()}\n`;
            shipString += `${message.language.get('COMMAND_SHIPS_FACTIONS')}: ${ship.factions.join(', ').toProperCase()}\n\n`;
            shipString += message.language.get('COMMAND_SHIPS_CODE_ABILITES_HEADER');
        
            for (var thisAbility in ship.abilities) {
                const abilities = ship.abilities[thisAbility];
                shipString += message.language.get('COMMAND_SHIPS_CODE_ABILITIES', ability, abilities);
            }

            return message.channel.send(shipString, { code: 'md', split: true });
        }
    }
}

module.exports = Ships;
