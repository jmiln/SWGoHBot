const Command = require('../base/Command');
// const moment = require('moment');
require('moment-duration-format');

class MyMods extends Command {
    constructor(client) {
        super(client, {
            name: 'mymods',
            category: "SWGoH",
            guildOnly: false,
            aliases: ['charactermods', 'charmods', 'cmods', 'cm', 'mm'],
            permissions: ['EMBED_LINKS']
        });
    }

    async run(client, message, [userID, ...searchChar]) { // eslint-disable-line no-unused-vars
        // const lang = message.guildSettings.swgohLanguage;
        const icons = {
            STATMOD_SLOT_01: await client.getEmoji('362066327101243392') || "Square",
            STATMOD_SLOT_02: await client.getEmoji('362066325474115605') || "Arrow",
            STATMOD_SLOT_03: await client.getEmoji('362066326925082637') || "Diamond",
            STATMOD_SLOT_04: await client.getEmoji('362066327168352257') || "Triangle",
            STATMOD_SLOT_05: await client.getEmoji('362066326996385812') || "Circle",
            STATMOD_SLOT_06: await client.getEmoji('362066327516610570') || "Cross"
        };

        if (searchChar) searchChar = searchChar.join(' ');

        // Need to get the allycode from the db, then use that
        if (!userID) {
            return message.channel.send(message.language.get('BASE_SWGOH_MISSING_CHAR'));
        } else if (userID === "me") {
            userID = message.author.id;
        } else if (userID.match(/\d{17,18}/)) {
            userID = userID.replace(/[^\d]*/g, '');
        } else {
            // If they're just looking for a character for themselves, get the char
            searchChar = userID + ' ' + searchChar;
            searchChar = searchChar.trim();
            userID = message.author.id;
        }

        if (!client.users.get(userID)) {
            return message.channel.send(message.language.get('BASE_SWGOH_NO_USER'));
        }
        const ally = await client.database.models.allyCodes.findOne({where: {id: userID}});
        if (!ally) {
            return message.channel.send(message.language.get('BASE_SWGOH_NOT_REG', client.users.get(userID).tag));
        }
        const allyCode = ally.dataValues.allyCode;

        const chars = client.findChar(searchChar, client.characters);
        let character;
        if (!searchChar) {
            return message.channel.send(message.language.get('BASE_SWGOH_MISSING_CHAR'));
        }

        if (chars.length === 0) {
            return message.channel.send(message.language.get('BASE_SWGOH_NO_CHAR_FOUND', searchChar));
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
                charL.push(c.name);
            });
            return message.channel.send(message.language.get('BASE_SWGOH_CHAR_LIST', charL.join('\n')));
        } else {
            character = chars[0];
        }

        const cooldown = client.getcooldown(message.author.id);
        let player;
        try {
            player = await client.swgohAPI.player(allyCode, null, cooldown);
        } catch (e) {
            console.log(e);
        }

        const charMods = player.roster.filter(c => c.defId === character.uniqueName)[0].mods;

        const slots = {};

        const sets = message.language.get('BASE_MODSETS_FROM_GAME');
        const stats = message.language.get('BASE_MODS_FROM_GAME');
        charMods.forEach(mod => {
            slots[mod.slot] = {
                stats: [],
                type: sets[mod.set],
                lvl: mod.level,
                pip: mod.pips
            };
            
            // Add the primary in
            slots[mod.slot].stats.push(`${mod.primaryBonusValue.replace('+', '')} ${stats[mod.primaryBonusType].replace('%', '')}`);

            // Then all the secondaries
            for (let ix = 1; ix <= 4; ix++) {
                let statStr = mod[`secondaryValue_${ix}`].replace('+', '');
                if (!statStr.length) break;
                if (statStr.indexOf('%') > -1) {
                    statStr = parseFloat(statStr).toFixed(2) + '%';
                }
                const t = stats[mod[`secondaryType_${ix}`]].replace('%', '').trim();
                statStr += ' ' + t;
                slots[mod.slot].stats.push(statStr);
            }
        });
        
        const fields = [];
        Object.keys(slots).forEach(mod => {
            const stats = slots[mod].stats;
            fields.push({
                name: `${icons[`STATMOD_SLOT_0${mod}`]} ${slots[mod].type} (${slots[mod].pip}* Lvl: ${slots[mod].lvl})`,
                value: `**${stats.shift()}**\n${stats.join('\n')}\n\`${'-'.repeat(28)}\``,
                inline: true
            });
        });

        message.channel.send({embed: {
            author: {
                name: `${player.name}'s ${character.name}`,
                icon_url: character.avatarURL
            },
            fields: fields,
            footer: {
                text: message.language.get('BASE_SWGOH_LAST_UPDATED', client.duration(player.updated, message))
            }
        }});
    }
}

module.exports = MyMods;

