const Fuse = require("fuse-js-latest");
const fs = require('fs');
const snekfetch = require('snekfetch');
const cheerio = require('cheerio');

exports.run = async (client, message, args) => {
    const usableArgs = ['gear', 'info', 'mods'];
    let characterIndex, action;
    // Make sure they're trying to update something that exists
    if (!usableArgs.includes(args[0])) {
        return message.channel.send(`Sorry, but ${args[0]} isn't a valid argument. Try one of these: ${usableArgs.join(', ')}`);
    } else {
        action = args[0];
    }
    
    // If their message only has what to update, but not who
    if (args.length < 2) {
        return message.channel.send(`You need to specify a character to update.`);
    }

    const charName = args.splice(1).join(' ');

    var options = {
        keys: ['name'],
        threshold: 0.0
    };
    const fuse = new Fuse(client.characters, options);
    const chars = fuse.search(charName);
    // If there's a ton of em, only return the first 4
    if (chars.length === 0) {
        return message.channel.send(`Sorry, but your search for '${charName}' did not find any results. Please try again.`);
    } else {
        client.characters.some(function(obj, ix) {
            if (obj.uniqueName === chars[0].uniqueName) {
                characterIndex = ix;
                return true;
            }
        });
    }

    if (action === 'mods') {
        console.log('Trying to update mods');
        await updateCharacterMods(client, message, characterIndex);
    } else if (action === 'gear') {
        await updateCharacterGear(client, message, characterIndex);
    } else if (action === 'info') {
        await updateCharacterInfo(client, message, characterIndex);
    }

};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ["u"],
    permLevel: 10
};

exports.help = {
    name: 'updatechar',
    category: 'Dev',
    description: 'Update the info on a specified character',
    usage: 'updatechar [gear|info|mods] [charater]',
    extended: `\`\`\`asciidoc
\`\`\``,
    example: ``
};


function getModType(type) {
    switch (type) {
        case 'CC':
            return 'Critical Chance x2';
        case 'CD':
            return 'Critical Damage x4';
        case 'SPE':
            return 'Speed x4';
        case 'TEN':
            return 'Tenacity x2';
        case 'OFF':
            return 'Offense x4';
        case 'POT':
            return 'Potency x2';
        case 'HP':
            return 'Health x2';
        case 'DEF':
            return 'Defense x2';
        default:
            return '';
    }
}

async function updateCharacterMods(client, message, charIndex) {
    const jsonGrab = await snekfetch.get('http://apps.crouchingrancor.com/mods/advisor.json');
    const characterListCR = JSON.parse(jsonGrab.text).data;

    const upChar = client.characters[charIndex];

    let updated = false;
    const cleanReg = /['-\s]/g;

    characterListCR.forEach(thisChar => {
        if (thisChar.cname.toLowerCase().replace(cleanReg, '') === upChar.name.toLowerCase().replace(cleanReg, '')) {
            console.log('Found the Character Mods');
            let setName = '';
            if (thisChar.name.includes(thisChar.cname)) {
                setName = thisChar.name.split(' ').splice(thisChar.cname.split(' ').length).join(' ');
                if (setName === '') {
                    setName = 'General';
                }
            } else {
                setName = thisChar.name;
            }
            if (upChar[setName]) {
                setName = thisChar.name;
            }

            // Go through all the variations of mods, and if they're the same,
            // ignore em. If they're different, add it in as a new set
            let newSet = true;
            for (var thisSet in upChar.mods) {
                const set = upChar.mods[thisSet];

                // Take out the space behind any slashes
                thisChar.square = thisChar.square.replace(/\s+\/\s/g, '/ ');
                thisChar.arrow = thisChar.arrow.replace(/\s+\/\s/g, '/ ');
                thisChar.diamond = thisChar.diamond.replace(/\s+\/\s/g, '/ ');
                thisChar.triangle = thisChar.triangle.replace(/\s+\/\s/g, '/ ');
                thisChar.circle = thisChar.circle.replace(/\s+\/\s/g, '/ ');
                thisChar.cross = thisChar.cross.replace(/\s+\/\s/g, '/ ');
                console.log('checking for new sets');
                if (getModType(thisChar.set1) === set.sets[0] && getModType(thisChar.set2) === set.sets[1] && getModType(thisChar.set3) === set.sets[2] && thisChar.square === set.square && thisChar.arrow === set.arrow && thisChar.diamond === set.diamond && thisChar.triangle === set.triangle && thisChar.circle === set.circle && thisChar.cross === set.cross) {
                    newSet = false;
                    console.log('not new');
                    break;
                }
            }
            if (newSet) {
                console.log('Found a new set');
                client.characters[charIndex].mods[setName] = {
                    "sets": [
                        getModType(thisChar.set1),
                        getModType(thisChar.set2),
                        getModType(thisChar.set3)
                    ],
                    "square": thisChar.square,
                    "arrow": thisChar.arrow,
                    "diamond": thisChar.diamond,
                    "triangle": thisChar.triangle,
                    "circle": thisChar.circle,
                    "cross": thisChar.cross
                };
                console.log('Adding a new modset');
                updated = true;
            }
        }
    });
    
    // If anything was updated, save it
    if (updated) {
        updated = false;
        fs.writeFile("./data/characters.json", JSON.stringify(client.characters, null, 4), 'utf8', function(err) {
            if (err) {
                return console.log(err);
            }
        });
        message.channel.send(`I have updated the mods for ${client.characters[charIndex].name}.`);
    } else {
        message.channel.send(`Sorry, but there were no new modsets for ${client.characters[charIndex].name}.`);
    }
}

async function updateCharacterInfo(client, message, charIndex) {
    const charList = client.characters;
    const ggGrab = await snekfetch.get(charList[charIndex].url);
    const ggGrabText = ggGrab.text;

    const $ = cheerio.load(ggGrabText);

    // Get the character's image link
    charList[charIndex].avatarURL = 'https:' + $('.panel-profile-img').attr('src');

    // Get the character's affiliations
    let affiliations = [];
    $('.panel-body').each(function() {
        if ($(this).find('h5').text().indexOf('Affiliations') !== -1) {
            affiliations = $(this).text().split('\n').slice(2, -1);  // Splice to get the blank and  the header out
            charList[charIndex].factions = affiliations;
            if (affiliations.indexOf('Light Side') !== -1) {
                charList[charIndex].side = 'light';
                affiliations.splice(affiliations.indexOf('Light Side'), 1);
            } else {
                charList[charIndex].side = 'dark';
                affiliations.splice(affiliations.indexOf('Dark Side'), 1);
            }
        }
    });
    // Get the character's abilities and such
    $('.char-detail-info').each(function() {
        let abilityName = $(this).find('h5').text();    // May have the cooldown included, need to get rid of it
        let desc = $(this).find('p').text().split('\n')[1];
        let abilityMat = $(this).find('img').attr('title').split(' ').join('');
        let abilityType = $(this).find('small').text();
        let cooldown = $(this).find('h5 small').text().split(' ')[0];

        // Make sure it doesn't have any line returns in there
        if (abilityName.indexOf('\n') !== -1) {
            abilityName = abilityName.replace(/\n/g, '');
        }
        if (desc.indexOf('\n') !== -1) {
            desc = desc.replace(/\n/g, '');
        }
        if (abilityMat.indexOf('\n') !== -1) {
            abilityMat = abilityMat.replace(/\n/g, '');
        }

        // Make sure it grabs the right one to work with the rest
        if (abilityMat === "AbilityMaterialOmega") {
            abilityMat = "omega";
        } else if (abilityMat === "AbilityMaterialMkIII") {
            abilityMat = "abilityMatMK3";
        } else if (abilityMat === "AbilityMaterialZeta") {
            abilityMat = "zeta";
        }

        // Grab the ability type
        if (abilityType.indexOf('Basic') !== -1) {
            abilityType = 'Basic';
        } else if (abilityType.indexOf('Special') !== -1) {
            abilityType = 'Special';
        } else if (abilityType.indexOf('Leader') !== -1) {
            abilityType = 'Leader';
        } else if (abilityType.indexOf('Unique') !== -1) {
            abilityType = 'Unique';
        }
        // If the cooldown isn't there, set it to 0
        if (cooldown === '') {
            cooldown = '0';
        } else {
            abilityName = abilityName.split(' ').slice(0, -3).join(' ').toString();
        }

        charList[charIndex].abilities[abilityName] = {
            "type": abilityType,
            "abilityCooldown": cooldown,
            "abilityDesc": desc,
            "tier": abilityMat,
            "cost": {
                'mk3': 0,
                'omega': 0,
                'zeta': 0
            }
        };
    });

    $('.list-group-item-ability').each(function() {
        const aName = $(this).find('.ability-mechanics-link').text().replace(/^View /, '').replace(/\sMechanics$/, '');

        let mk3s = 0, omegas = 0, zetas = 0;
        // Each level of the ability is in a tr
        const aCost = [];
        $(this).find('tr').each(function() {
            // And the cost of each is in the 2nd td in each row
            const lvl = [];
            $(this).find('td').each(function() {
                lvl.push($(this).html());
            });
            aCost.push(lvl[1]);
        });
        aCost.splice(0,2);  // Ignore the first two (Header then default unlock)
        aCost.forEach(lvl => {
            const count = getCount(lvl);
            // console.log('Count1: ' + inspect(count));
            mk3s += count.mk3;
            omegas += count.omega;
            zetas += count.zeta;
            // console.log('Count2: ' + inspect(count));
        });
        // console.log(`${mk3s} MK3, ${omegas} Omegas, ${zetas} Zetas`);
        charList[charIndex].abilities[aName].cost = {
            'mk3': mk3s,
            'omega': omegas,
            'zeta': zetas
        };
    });

    fs.writeFile("./data/characters.json", JSON.stringify(client.characters, null, 4), 'utf8', function(err) {
        if (err) {
            return console.log(err);
        } else {
            client.characters = charList;
            message.channel.send(`I have updated the info for ${client.characters[charIndex].name}.`);
        }
    });
}

async function updateCharacterGear(client, message, charIndex) {
    const charList = client.characters;
    let gearLink = client.characters[charIndex].url;
    if (gearLink.endsWith('/')) {
        gearLink += 'gear';
    } else {
        gearLink += '/gear';
    }
    const gearGrab = await snekfetch.get(gearLink);
    const gearGrabText = gearGrab.text;

    const $ = cheerio.load(gearGrabText);

    // Get the gear
    const gear = {};
    $('.media.list-group-item.p-0.character').each(function(i) {
        const thisGear = $(this).find('a').attr('title');
        const gearLvl = 'Gear ' + (Math.floor(i / 6) + 1).toString();

        if (gear[gearLvl]) {
            gear[gearLvl].push(thisGear);
        } else {
            gear[gearLvl] = [thisGear];
        }
    });

    Object.keys(gear).forEach(gearLvl => {
        charList[charIndex].gear[gearLvl] = gear[gearLvl];
    });

    fs.writeFile("./data/characters.json", JSON.stringify(charList, null, 4), 'utf8', function(err) {
        if (err) {
            return console.log(err);
        } else {
            client.characters = charList;
            message.channel.send(`I have updated the gear for ${charList[charIndex].name}.`);
        }
    });
}


const mk3 = '<img src="//swgoh.gg/static/img/assets/tex.skill_pentagon_white.png" style="width: 25px;">';
const omega = '<img src="//swgoh.gg/static/img/assets/tex.skill_pentagon_gold.png" style="width: 25px;">';
const zeta =  '<img src="//swgoh.gg/static/img/assets/tex.skill_zeta.png" style="width: 25px;">';

// Lvl is the string from each level of the ability
function getCount(lvl) {
    const lvlCost = {
        'mk3': 0,
        'omega': 0,
        'zeta': 0
    };
    if (lvl.indexOf(mk3) > -1) {
        let lvlmk3 = lvl;
        lvlmk3 = lvlmk3.replace(new RegExp(`^.*${mk3} x`), '');
        lvlmk3 = lvlmk3.replace(/\s.*/, '');
        lvlCost.mk3 = parseInt(lvlmk3);
    }
    if (lvl.indexOf(omega) > -1) {
        let lvlomega = lvl;
        lvlomega = lvlomega.replace(new RegExp(`^.*${omega} x`), '');
        lvlomega = lvlomega.replace(/\s.*/, '');
        lvlCost.omega = parseInt(lvlomega);
    }
    if (lvl.indexOf(zeta) > -1) {
        let lvlzeta = lvl;
        lvlzeta = lvlzeta.replace(new RegExp(`^.*${zeta} x`), '');
        lvlzeta = lvlzeta.replace(/\s.*/, '');
        lvlCost.zeta = parseInt(lvlzeta);
    }
    return lvlCost;
}