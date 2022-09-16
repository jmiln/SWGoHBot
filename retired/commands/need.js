const Command = require("../base/Command");

class Need extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "need",
            category: "SWGoH",
            enabled: true,
            permissions: ["EMBED_LINKS"]
        });
    }

    async run(Bot, message, args) { // eslint-disable-line no-unused-vars
        const shardsLeftAtStar = {
            0: 330,
            1: 320,
            2: 305,
            3: 280,
            4: 250,
            5: 185,
            6: 100
        };
        const {searchChar, allyCode, err} = await super.getUserAndChar(message, args, true);   // eslint-disable-line no-unused-vars
        if (err && !searchChar) {
            return super.error(message, "You need to specify a location or faction.", {usage: "need <faction|location>"});
        }
        if (!allyCode) {
            return super.error(message, message.language.get("COMMAND_NEED_MISSING_USER"));
        }

        const cooldown = await Bot.getPlayerCooldown(message.author.id);
        let player = await Bot.swgohAPI.unitStats(allyCode, cooldown);
        if (Array.isArray(player)) player = player[0];
        if (!player) {
            // Could not find the player, possible api issue?
            // TODO Lang this
            return super.error(message, "I couldn't find that player, please make sure you've got the corect ally code.");
        } else if (!player.roster) {
            return super.error(message, "I couldn't find your roster.");
        }

        let outChars = [];
        let outShips = [];

        let search;
        const staticMatches = {
            cantina: "Cantina Shipments",
            guild:   "Guild Shop",
            fleet:   "Fleet Shipments",
            gw:      "GW Shipments"
        };
        if (staticMatches[searchChar.toLowerCase()]) {
            search = staticMatches[searchChar.toLowerCase()];
        }

        let units = [];
        if (search) {
            units = await getUnitsExact(search);
        } else {
            search = searchChar;
            units = await getUnits(searchChar);
        }

        if (!units.length) {
            // Can't find a match, so let them know
            return super.error(message, message.language.get("COMMAND_NEED_MISSING_SEARCH", searchChar));
        }

        const totalShards = units.length * shardsLeftAtStar[0];
        let shardsLeft = 0;
        for (const unit of units) {
            // Go through the found characters and check them against the player's roster
            let u = player.roster.find(c => c.defId === unit.baseId);
            if (!u) {
                // If Malak
                if (unit.baseId === "DARTHMALAK") continue;
                u = {
                    rarity:  0,
                    nameKey: unit.nameKey || unit.name
                };
            }
            if (u.rarity === 7) continue;
            shardsLeft += shardsLeftAtStar[u.rarity];
            u = await Bot.swgohAPI.langChar(u, message.guildSettings.swgohLanguage);
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
                    name: message.language.get("COMMAND_NEED_CHAR_HEADER") + end,
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
                    name: message.language.get("COMMAND_NEED_SHIP_HEADER") + end,
                    value: m
                });
            });
        }

        let desc = "";
        if (shardsLeft === 0) {
            desc = message.language.get("COMMAND_NEED_COMPLETE");
        } else {
            desc = message.language.get("COMMAND_NEED_PARTIAL", (((totalShards - shardsLeft)/ totalShards) * 100).toFixed(1));
        }

        fields.push({
            name: "-",
            value: "**Check out `" + message.guildSettings.prefix + "help need` for other searches**"
        });

        return message.channel.send({embeds: [{
            author: {
                name: message.language.get("COMMAND_NEED_HEADER", player.name, Bot.toProperCase(search))
            },
            description: desc,
            fields: fields
        }]});

        async function getUnitsExact(searchName) {
            let units = Bot.charLocs.filter(c => c.locations.filter(l => l.type === searchName).length);
            units = units.concat(Bot.shipLocs.filter(s => s.locations.filter(l => l.type === searchName).length));
            for (const c of units) {
                // The char/ ship locations don't have the baseId so need to get those
                let char = Bot.characters.find(char => char.name.replace(/[^\w]/g, "").toLowerCase() === c.name.replace(/[^\w]/g, "").toLowerCase());
                if (!char) {
                    char = Bot.ships.find(char => char.name.replace(/[^\w]/g, "").toLowerCase() === c.name.replace(/[^\w]/g, "").toLowerCase());
                }
                if (!char) {
                    continue;
                }
                c.baseId = char.uniqueName;
            }
            return units;
        }

        async function getUnits(searchName) {
            let search = searchName.replace(/[^\w\s]/g, "").replace(/s$/, "");  // Take out all alphanumeric characters and any s off the end
            if (search.toLowerCase() === "galactic republic") search = "affiliation_republic";
            if (search.toLowerCase() === "galactic war") search = "gw";
            if (search.includes("cantina") && search.includes("battle")) {
                search = search.replace(/(battles|battle)/gi, "");
            } else {
                search = search
                    .replace(/(store|shop|shipment)/g, "shop|store|shipment")
                    .replace(/(battles|battle)/gi, "hard")
                    .replace(/light/gi, "(l)")
                    .replace(/dark/gi, "(d)")
                    .replace("node", "mode");
            }

            const searchReg = search.split(" ").map(s => `(?=.*${s.replace(/(\(|\))/g, "\\$1")})`).join(".*");
            const query = new RegExp(`.*${searchReg}.*`, "gi");

            let units = Bot.charLocs.filter(c => c.locations.filter(l => l.type.match(query)).length);
            units = units.concat(Bot.shipLocs.filter(s => s.locations.filter(l => l.type.match(query)).length));

            for (const c of units) {
                // The char/ ship locations don't have the baseId so need to get those
                let char = Bot.characters.find(char => char.name.replace(/[^\w]/g, "").toLowerCase() === c.name.replace(/[^\w]/g, "").toLowerCase());
                if (!char) {
                    char = Bot.ships.find(char => char.name.replace(/[^\w]/g, "").toLowerCase() === c.name.replace(/[^\w]/g, "").toLowerCase());
                }
                if (!char) {
                    continue;
                }
                c.baseId = char.uniqueName;
            }

            if (!units.length) {
                // Must not be in a shop or node, try checking factions
                units = await Bot.cache.get(Bot.config.mongodb.swapidb, "units",
                    {categoryIdList: query, language: message.guildSettings.swgohLanguage.toLowerCase()},
                    {_id: 0, baseId: 1, nameKey: 1}
                );
            }
            return units;
        }
    }
}

module.exports = Need;
