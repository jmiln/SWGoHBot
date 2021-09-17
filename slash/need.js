const Command = require("../base/slashCommand");
const factionMap = require("../data/factionMap");
const shopMap = [
    { name: "Arena Shop",        value: "Arena Shipments" },
    { name: "Cantina Shop",      value: "Cantina Shipments" },
    { name: "Fleet Shop",        value: "Fleet Shipments" },
    { name: "Galactic War Shop", value: "GW Shipments" },
    { name: "Guild Event Shop",  value: "Guild Event Shop" },
    { name: "Guild Shop",        value: "Guild Shop" },
    { name: "Shard Shop",        value: "Shard Shop" }
];
const kwMap = [
    { name: "All Battles", value: "battles" },
    { name: "All Shops",   value: "shops" },
    { name: "Everything",  value: "*" }
];
const battleMap = [
    { name: "Cantina Battles",    value: "Cantina" },
    { name: "Dark Side Battles",  value: "Hard Modes (D)" },
    { name: "Fleet Battles",      value: "Hard Modes (Fleet)" },
    { name: "Light Side Battles", value: "Hard Modes (L)" }
];

class Need extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "need",
            description: "Shows your progress towards 7* characters from a faction or shop.",
            category: "SWGoH",
            enabled: true,
            guildOnly: false,
            permissions: ["EMBED_LINKS"],
            options: [
                // Allycode (Of course)
                {
                    name: "allycode",
                    description: "The ally code for the user you want to look up",
                    type: "STRING"
                },
                // put in faction|shop|battle|keyword on their own
                {
                    name: "battle",
                    description: "Which section of battles you want to check on",
                    type: "STRING",
                    choices: battleMap
                },
                {
                    name: "keyword",
                    description: "Choose all of a section",
                    type: "STRING",
                    choices: kwMap
                },
                {
                    name: "shop",
                    description: "Which shop you want to check the progress on",
                    type: "STRING",
                    choices: shopMap
                },
                // The faction tags listed as in game, but needed to be split up into multiple lists because of
                // how many there are (Choices are limited to 20 choices...)
                {
                    name: "faction_group_1",
                    description: "Which faction you want to check the progress on",
                    type: "STRING",
                    choices: factionMap.slice(0, 20)
                },
                {
                    name: "faction_group_2",
                    description: "Which faction you want to check the progress on",
                    type: "STRING",
                    choices: factionMap.slice(20, 40)
                },
            ]
        });
    }

    async run(Bot, interaction, options) { // eslint-disable-line no-unused-vars
        const shardsLeftAtStar = { 0: 330, 1: 320, 2: 305, 3: 280, 4: 250, 5: 185, 6: 100 };

        let allycode = interaction.options.getString("allycode");
        allycode = await Bot.getAllyCode(interaction, allycode, true);
        if (!allycode) {
            return super.error(interaction, "I could not find a valid ally code for you. Please make sure to supply one.");
        }

        const battle = interaction.options.getString("battle");
        const faction1 = interaction.options.getString("faction_group_1");
        const faction2 = interaction.options.getString("faction_group_2");
        const keyword = interaction.options.getString("keyword");
        const shop = interaction.options.getString("shop");

        if (!battle && !faction1 && !faction2 && !keyword && !shop) {
            return super.error(interaction, "You need to specify a location or faction.");
        }
        await interaction.reply({content: "Please wait while I look up your data."});

        const cooldown = await Bot.getPlayerCooldown(interaction.user.id);
        let player = await Bot.swgohAPI.unitStats(allycode, cooldown);
        if (Array.isArray(player)) player = player[0];
        if (!player) {
            return super.error(interaction, "I couldn't find that player, please make sure you've got the corect ally code.");
        } else if (!player.roster) {
            return super.error(interaction, "I couldn't find your roster.");
        }

        const units = [];
        let namesToSearch = [];
        if (battle) {
            namesToSearch.push(battle);
        }
        if (faction1) {
            const factionUnits = await getFactionUnits(faction1);
            units.push(...factionUnits);
            namesToSearch.push(faction1);
        }
        if (faction2) {
            const factionUnits = await getFactionUnits(faction2);
            units.push(...factionUnits);
            namesToSearch.push(faction2);
        }
        if (shop) {
            namesToSearch.push(shop);
        }
        if (keyword) {
            if (keyword === "*") {
                // Just get everything
                namesToSearch.push("*");
            } else if (keyword === "battles") {
                namesToSearch.push(...battleMap.map(b => b.value));
            } else if (keyword === "shops") {
                namesToSearch.push(...shopMap.map(s => s.value));
            }
        }
        namesToSearch = [...new Set(namesToSearch)];
        const matchingChars = await getUnitsExact(namesToSearch);
        if (matchingChars.length) {
            units.push(...matchingChars);
        }

        const totalShards = units.length * shardsLeftAtStar[0];
        let shardsLeft = 0;
        let outChars = [];
        let outShips = [];
        for (const unit of units) {
            // Go through the found characters and check them against the player's roster
            let u = player.roster.find(c => c.defId === unit.baseId);
            if (!u) {
                // If Malak (I don't remember why...)
                if (unit.baseId === "DARTHMALAK") continue;
                u = {};
                u.rarity = 0;
                u.nameKey = unit.name;
            }
            if (u.rarity === 7) continue;
            shardsLeft += shardsLeftAtStar[u.rarity];
            u = await Bot.swgohAPI.langChar(u, interaction.guildSettings.swgohLanguage);
            if (Bot.characters.find(c => c.uniqueName === unit.baseId)) {
                // It's a character
                outChars.push({
                    rarity: u.rarity,
                    name: u.nameKey
                });
            } else if (Bot.ships.find(s => s.uniqueName === unit.baseId)) {
                // It's a ship
                outShips.push({
                    rarity: u.rarity,
                    name: u.nameKey
                });
            } else {
                // It's neither and shouldn't be there
                continue;
            }
        }

        const fields = [];
        if (outChars.length) {
            outChars = outChars.filter(c => c.name);
            outChars = outChars.sort((a,b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
            outChars = outChars.map(c => `\`${c.rarity}*\` ${c.rarity ? c.name : "~~" + c.name + "~~"}`);
            const msgArr = Bot.msgArray(outChars, "\n", 1000);
            msgArr.forEach((m, ix) => {
                let end = "";
                if (msgArr.length > 1) end = `(${ix+1})`;
                fields.push({
                    name: interaction.language.get("COMMAND_NEED_CHAR_HEADER") + end,
                    value: m
                });
            });
        }
        if (outShips.length) {
            outShips = outShips.filter(a => !!a.name).sort((a,b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
            outShips = outShips.map(s => `\`${s.rarity}*\` ${s.rarity ? s.name : "~~" + s.name + "~~"}`);
            const msgArr = Bot.msgArray(outShips, "\n", 1000);
            msgArr.forEach((m, ix) => {
                let end = "";
                if (msgArr.length > 1) end = `(${ix+1})`;
                fields.push({
                    name: interaction.language.get("COMMAND_NEED_SHIP_HEADER") + end,
                    value: m
                });
            });
        }

        let desc = "";
        if (shardsLeft === 0) {
            desc = interaction.language.get("COMMAND_NEED_COMPLETE");
        } else {
            desc = interaction.language.get("COMMAND_NEED_PARTIAL", (((totalShards - shardsLeft)/ totalShards) * 100).toFixed(1));
        }

        const headerNames = getHeaderNames(namesToSearch);
        if (fields.map(f => f.value).join("\n").length > 5000) {
            // Just in case it's too big for one embed (Someone without a enough characters unlocked/ 7*), split it up
            await interaction.editReply({content: null, embeds: [
                {
                    author: {
                        name: interaction.language.get("COMMAND_NEED_HEADER", player.name, headerNames.join(", ").toProperCase())
                    },
                    description: desc,
                    fields: fields.slice(0, Math.floor(fields.length/2))
                }
            ]});
            return interaction.followUp({content: null, embeds: [
                {
                    fields: fields.slice(Math.floor(fields.length/2), 500)
                }
            ]});
        } else {
            // It's small enough for one embed, just send it
            return interaction.editReply({content: null, embeds: [{
                author: {
                    name: interaction.language.get("COMMAND_NEED_HEADER", player.name, headerNames.join(", ").toProperCase())
                },
                description: desc,
                fields: fields
            }]});
        }
        function getHeaderNames(namesIn) {
            const namesOut = [];
            for (const name of namesIn) {
                let n = kwMap.find(k => k.value === name)?.name;
                if (!n) {
                    n = shopMap.find(k => k.value === name)?.name;
                }
                if (!n) {
                    n = battleMap.find(k => k.value === name)?.name;
                }
                if (!n) {
                    n = factionMap.find(k => k.value === name)?.name;
                }
                if (n) {
                    namesOut.push(n);
                }
            }
            return namesOut;
        }

        async function getUnitsExact(searchNames) {
            // Get unit matches based on the exact name of their locations
            if (!Array.isArray(searchNames)) searchNames = [searchNames];
            let unitsOut = [];
            if (searchNames.includes("*")) {
                unitsOut.push(...Bot.charLocs);
                unitsOut.push(...Bot.shipLocs);
            } else {
                for (const searchName of searchNames) {
                    unitsOut = unitsOut.concat(Bot.charLocs.filter(c => c.locations.filter(l => l.type === searchName).length));
                    unitsOut = unitsOut.concat(Bot.shipLocs.filter(s => s.locations.filter(l => l.type === searchName).length));
                }
            }
            for (const c of unitsOut) {
                // The char/ ship locations don't have the baseId so need to get those
                let char = Bot.characters.find(char => char.name.replace(/[^\w]/g, "").toLowerCase() === c.name.replace(/[^\w]/g, "").toLowerCase());
                if (!char) {
                    char = Bot.ships.find(char => char.name.replace(/[^\w]/g, "").toLowerCase() === c.name.replace(/[^\w]/g, "").toLowerCase());
                    if (char) char.isShip = true;
                }
                if (!char) {
                    continue;
                }
                c.baseId = char.uniqueName;
            }
            return unitsOut;
        }

        async function getFactionUnits(searchName) {
            // Get units based on their faction
            const units = await Bot.cache.get(Bot.config.mongodb.swapidb, "units",
                {categoryIdList: searchName, language: interaction.guildSettings.swgohLanguage.toLowerCase()},
                {_id: 0, baseId: 1, nameKey: 1}
            );
            return units;
        }
    }
}

module.exports = Need;
