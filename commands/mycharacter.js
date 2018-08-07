const Command = require('../base/Command');
const {promisify, inspect} = require('util');      // eslint-disable-line no-unused-vars

class MyCharacter extends Command {
    constructor(client) {
        super(client, {
            name: 'mycharacter',
            category: "Misc",
            enabled: true, 
            aliases: ['mc', 'mychar'],
            permissions: ['EMBED_LINKS'],   
            permLevel: 0,
        });
    }

    async run(client, message, [userID, ...searchChar]) {
        const lang = 'ENG_US';
        const modsetBonuses = {
            'Health': { setName: 'Health %', set: 2, min: 2.5, max: 5 },
            'Defense': { setName: 'Defense %', set: 2, min: 2.5, max: 5 },
            'Crit Damage': { setName: 'Critical Damage %', set: 4, min: 15, max: 30 },
            'Crit Chance': { setName: 'Critical Chance %', set: 2, min: 2.5, max: 5 },
            'Tenacity': { setName: 'Tenacity %', set: 2, min: 5, max: 10 },
            'Offense': { setName: 'Offense %', set: 4, min: 5, max: 10 },
            'Potency': { setName: 'Potency %', set: 2, min: 5, max: 10 },
            'Speed': { setName: 'Speed %', set: 4, min: 5, max: 10 }
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

        if (!client.users.get(userID)) {
            return message.channel.send(message.language.get('BASE_SWGOH_NO_USER'));
        }
        const ally = await client.database.models.allyCodes.findOne({where: {id: userID}});
        if (!ally) {
            return message.channel.send(message.language.get('BASE_SWGOH_NOT_REG', client.users.get(userID).tag));
        }
        const allyCode = ally.dataValues.allyCode;

        let player = null;
        try {
            // player = await client.swgohAPI.fetchPlayer(allyCode, null, lang);
            player = await client.swgohAPI.player(allyCode, lang);
        } catch (e) {
            console.error(e);
        }

        const thisChar = player.roster.filter(c => (c.name.replace('Î', 'I').replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase() === character.name.replace('Î', 'I').replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase() || c.name === character.uniqueName));

        thisChar.forEach(c => {
            let gearStr = ['   [0]  [3]', '[1]       [4]', '   [2]  [5]'].join('\n');
            const abilities = {
                basic: [],
                special: [],
                leader: [],
                unique: [],
                contract: []
            };
            c.equipped.forEach(e => {
                gearStr = gearStr.replace(e.slot, 'X');
            });
            gearStr = gearStr.replace(/[0-9]/g, '  ');
            gearStr = client.expandSpaces(gearStr);
            c.skills.forEach(a => {
                if (a.tier === 8 || (a.tier === 3 && a.type === 'Contract')) {
                    if (a.isZeta) {
                        // Maxed Zeta ability
                        a.tier = 'Max ✦';
                    } else {
                        // Maxed Omega ability
                        a.tier = 'Max ⭓';
                    }
                } else {
                    // Unmaxed ability
                    a.tier = 'Lvl ' + a.tier;
                }
                try {
                    abilities[`${a.type.toLowerCase()}`].push(`\`${a.tier} [${a.type.charAt(0)}]\` ${a.name}`);
                } catch (e) {
                    console.log('ERROR: bad ability type: ' + inspect(a));
                }
            });
            const abilitiesOut = abilities.basic
                .concat(abilities.special)
                .concat(abilities.leader)
                .concat(abilities.unique)
                .concat(abilities.contract);
            const mods = {};
            const sets = {};
            c.mods.forEach(m => {
                if (!sets[m.set]) {
                    sets[m.set] = {};
                    sets[m.set].count = 1;
                    sets[m.set].lvls = [m.level];
                } else {
                    sets[m.set].count += 1;
                    sets[m.set].lvls.push(m.level);
                }
                if (m.primaryBonusValue.indexOf('%') > -1 && (m.primaryBonusType.indexOf('%') === -1)) {
                    m.primaryBonusType = m.primaryBonusType + ' %';
                }
                if (!mods[m.primaryBonusType]) {
                    mods[m.primaryBonusType] = parseFloat(m.primaryBonusValue);
                } else {
                    mods[m.primaryBonusType] += parseFloat(m.primaryBonusValue);
                }
                for (let ix = 1; ix <= 4; ix++) {
                    if (!m[`secondaryType_${ix}`].length) break;
                    if (m[`secondaryValue_${ix}`].indexOf('%') > -1 && m[`secondaryType_${ix}`].indexOf('%') === -1) {
                        m[`secondaryType_${ix}`] = m[`secondaryType_${ix}`] + ' %';
                    }
                    if (!mods[m[`secondaryType_${ix}`]]) {
                        mods[m[`secondaryType_${ix}`]] = parseFloat(m[`secondaryValue_${ix}`]);
                    } else {
                        mods[m[`secondaryType_${ix}`]] += parseFloat(m[`secondaryValue_${ix}`]);
                    }
                }
            });
            const setBonuses = {};
            Object.keys(sets).forEach(s => {
                const set = sets[s];

                // If there are not enough of the set to form a full set, don't bother
                if (set.count < modsetBonuses[s].set) return;

                // See how manny sets there are
                const setNum = parseInt(set.count / modsetBonuses[s].set);

                // Count the max lvl ones
                for (let ix = setNum; ix > 0; ix--) {
                    const maxCount = set.lvls.filter(lvl => lvl === 15).length;
                    const underMax = set.lvls.filter(lvl => lvl < 15).length;
                    // If there are not enough maxed ones, just put the min bonus in
                    let remCount = 0;
                    if (maxCount < modsetBonuses[s].set) {
                        if (!setBonuses[s]) {
                            setBonuses[s] = modsetBonuses[s].min;
                        } else {
                            setBonuses[s] += modsetBonuses[s].min;
                        }
                        if (underMax >= modsetBonuses[s].set) {
                            const tmp = set.lvls.filter(lvl => lvl < 15);
                            for (let jx = 0; jx < modsetBonuses[s].set; jx++) {
                                set.lvls.splice(set.lvls.indexOf(tmp[jx]), 1);
                            }
                        } else {
                            const tmp = set.lvls.filter(lvl => lvl < 15);
                            tmp.forEach(t => {
                                set.lvls.splice(set.lvls.indexOf(t), 1);
                                remCount += 1;
                            });
                            for (let jx = remCount; jx < modsetBonuses[s].set; jx++) {
                                set.lvls.splice(0, 1);
                            }
                        }
                    } else {
                        if (!setBonuses[s]) {
                            setBonuses[s] = modsetBonuses[s].max;
                        } else {
                            setBonuses[s] += modsetBonuses[s].max;
                        }
                        for (let jx = 0; jx < modsetBonuses[s].set; jx++) {
                            set.lvls.splice(set.lvls.indexOf(15), 1);
                        }
                    }
                }
            });
            const setOut = [];
            for (const s in setBonuses) {
                setOut.push(`+${setBonuses[s]}% ${s}`);
            }

            const modOut = [];
            const sMods = Object.keys(mods).sort((p, c) => p > c ? 1 : -1);
            sMods.forEach(m => {
                if (m.endsWith('%')) {
                    modOut.push(`+${mods[m].toFixed(2)}% **${m.replace('%', '')}**`);
                } else {
                    modOut.push(`+${mods[m]} **${m}**`);
                }
            });

            message.channel.send({embed: {
                author: {
                    name: player.name + "'s " + c.name
                }, 
                description: 
                    [
                        `\`Lvl ${c.level} | ${c.rarity}* | ${parseInt(c.gp)} gp\``,
                        `Gear: ${c.gear}`,
                        `${gearStr}`
                    ].join('\n'),
                fields: [
                    {
                        name: 'Abilities',
                        value: abilitiesOut.join('\n')
                    },
                    {
                        name: 'Mod set bonuses',
                        value: setOut.length ? setOut.join('\n') : 'No set bonuses'
                    },
                    {
                        name: 'Mod stats',
                        value: modOut.length ? modOut.join('\n') : 'No mod stats'
                    }
                ],
                footer: {
                    text: message.language.get('BASE_SWGOH_LAST_UPDATED', client.duration(player.updated, message))
                }
            }});
        });
    }
}

module.exports = MyCharacter;





