// const util = require('util');
const Command = require('../base/Command');

class Ships extends Command {
    constructor(client) {
        super(client, {
            name: 'ships',
            aliases: ['s', 'ship'],
            category: 'Star Wars',
            description: 'Shows the info about the specified ship.',
            usage: 'ships <ship|character>',
            example: `;ships tie reaper`,
            extended: `\`\`\`asciidoc
ship|character  :: The ship you're wanting to look up. Also accepts their crew members.
            \`\`\``
        });
    }

    run(client, message, args) {
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
            return message.channel.send(message.language.COMMAND_SHIPS_NEED_CHARACTER(config.prefix, this.help.usage)).then(msg => msg.delete(4000)).catch(console.error);
        }

        // Find any characters that match that
        const ships = client.findChar(searchName, shipList);
        if (ships.length <= 0) {
            return message.channel.send(message.language.COMMAND_SHIPS_INVALID_CHARACTER(config.prefix, this.help.usage)).then(msg => msg.delete(4000)).catch(console.error);
        } else if (ships.length > 1) {
            return message.channel.send(message.language.COMMAND_SHIPS_TOO_MANY).then(msg => msg.delete(10000)).catch(console.error);
        }

        const ship = ships[0];

        if (embeds) { // if Embeds are enabled
            const fields = [];

            fields.push({
                "name": message.language.COMMAND_SHIPS_CREW,
                "value": ship['crew'].join(', ').toProperCase()
            });
            fields.push({
                "name": message.language.COMMAND_SHIPS_FACTIONS,
                "value": ship['factions'].join(', ').toProperCase()
            });
            for (var ability in ship.abilities) {
                const abilities = ship.abilities[ability];
                fields.push({
                    "name": ability,
                    "value": message.language.COMMAND_SHIPS_ABILITIES(abilities)
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
            shipString += `${message.language.COMMAND_SHIPS_CREW}: ${ship.crew.join(', ').toProperCase()}\n`;
            shipString += `${message.language.COMMAND_SHIPS_FACTIONS}: ${ship.factions.join(', ').toProperCase()}\n\n`;
            shipString += message.language.COMMAND_SHIPS_CODE_ABILITES_HEADER;
        
            for (var thisAbility in ship.abilities) {
                const abilities = ship.abilities[thisAbility];
                shipString += message.language.COMMAND_SHIPS_CODE_ABILITIES(ability, abilities);
            }

            return message.channel.send(shipString, { code: 'md', split: true });
        }
    }
}

module.exports = Ships;
