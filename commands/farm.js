const Command = require("../base/Command");

class Farm extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "farm",
            category: "SWGoH",
            aliases: [],
            permissions: ["EMBED_LINKS"],
            flags: {
                ships: {
                    aliases: ["s"]
                }
            }
        });
    }

    async run(Bot, message, [...searchChar], options) {

        if (!searchChar || !searchChar.length) return super.error(message, message.language.get("COMMAND_FARM_USAGE", message.guildSettings.prefix), {title: message.language.get("COMMAND_FARM_MISSING_CHARACTER"), example: "farm bb8"});
        searchChar = searchChar.join(" ");
        let chars;
        if (!options.flags.ships) {
            // If they don't specify ships, look for chars
            chars = Bot.findChar(searchChar, Bot.characters);
        }
        if (options.flags.ships || !chars?.length) {
            // If they are looking for a ship or if the char search doesn't work, then check ships in case
            chars = Bot.findChar(searchChar, Bot.ships, true);
        }
        let character;
        if (!chars?.length) {
            // Didn't find one
            return super.error(message, message.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
        } else if (chars.length > 1) {
            // Found too many
            return super.error(message, message.language.get("BASE_SWGOH_CHAR_LIST", chars.map(c => c.name).join("\n")));
        } else {
            character = chars[0];
        }

        const unit = await Bot.swgohAPI.units(character.uniqueName, message.swgohLanguage);
        if (!unit) {
            return super.error(message, "Broke trying to get the unit.");
        }
        const recipe = await Bot.swgohAPI.recipes(unit.creationRecipeReference, message.swgohLanguage);
        if (!recipe) {
            return super.error(message, "Broke trying to get the recipe.");
        }
        const mat = recipe[0].ingredientsList.find(i => i.id.startsWith("unitshard"));
        const material = await Bot.swgohAPI.materials(mat.id, message.swgohLanguage);
        if (!material) {
            return super.error(message, "Broke trying to get the unit.");
        }

        const eventChars = message.language.get("COMMAND_FARM_EVENT_CHARS");
        let outList = [];
        if (Object.keys(eventChars).includes(character.uniqueName)) {
            outList.push(eventChars[character.uniqueName]);
        }
        const lookupList = material[0].lookupMissionList.filter(m => m.missionIdentifier.campaignId !== "EVENTS");
        const raidLookupList = material[0].raidLookupList;
        for (const mis of lookupList) {
            let out = "";
            const mission = mis.missionIdentifier;
            if (mission.campaignMapId === "PRELUDE") continue;
            const battle = await Bot.swgohAPI.battles(mission.campaignId);
            const found = battle[0].campaignMapList.find(c => c.id === mission.campaignMapId);
            out += parseInt(found.id.replace(/[^\d]/g, ""), 10);
            let tier;
            found.difficultyList.forEach(d => {
                const node = d.nodeList.find(n => n.id === mission.campaignNodeId);
                if (node) {
                    if (d.difficulty === 5) out = message.language.get("COMMAND_FARM_HARD") + out;
                    tier = node;
                }
            });
            if (!tier) return super.error(message, "Something Broke: Cannot find tier");
            if (tier.forceAlignment === "DARK") {
                out = message.language.get("COMMAND_FARM_DARK") + out;
            } else if (tier.forceAlignment === "LIGHT") {
                out = message.language.get("COMMAND_FARM_LIGHT") + out;
            } else if (mission.campaignId.endsWith("SP")) {
                out = message.language.get("COMMAND_FARM_FLEET") + out;
            } else if (tier.forceAlignment === "NEUTRAL") {
                out = message.language.get("COMMAND_FARM_CANTINA") + out;
            }
            const diff = {
                5: "HARDDIFF",
                4: "NORMALDIFF"
            };
            if (Number.isInteger(mission.campaignNodeDifficulty)) {
                mission.campaignNodeDifficulty = diff[mission.campaignNodeDifficulty];
            }
            const letter = Bot.missions[mission.campaignId][mission.campaignMapId][mission.campaignNodeDifficulty][mission.campaignMissionId];
            const nodeCost = Bot.missions[mission.campaignId][mission.campaignMapId][mission.campaignNodeDifficulty]["COST"];
            out += letter + " - " + nodeCost + message.language.get("COMMAND_FARM_ENERGY_PER");
            outList.push(out);
        }
        if (raidLookupList.length) {
            // For han, gk, traya etc..
            for (const mis of raidLookupList) {
                let out = "";
                const mission = mis.missionIdentifier;
                const battle = await Bot.swgohAPI.battles(mission.campaignId);
                const found = battle[0].campaignMapList.find(c => c.id === mission.campaignMapId);
                let tier;
                found.difficultyList.forEach(d => {
                    const node = d.nodeList.find(n => n.id === mission.campaignNodeId);
                    if (node) {
                        tier = node;
                    }
                });
                if (!tier) return super.error(message, "Something Broke: Cannot find tier");
                out += tier.id.replace("_", " ").toProperCase() + " ";
                const name =  tier.missionList.find(m => m.id === mission.campaignMissionId).nameKey;
                if (name && name.length) {
                    out = name.replace(/\[.*\]/, "").toProperCase() + out;
                }

                outList.push(out);
            }
        }

        if (options.flags.ships) {
            const ship = Bot.shipLocs.find(s => s.name.toLowerCase() === character.name.toLowerCase());
            if (ship) {
                const shopLoc = ship.locations.filter(l => l.cost);
                if (shopLoc.length) {
                    outList = outList.concat(shopLoc.map(l => `${l.type} - ${l.cost.replace("/", " per ")} shards`));
                }
            }
        } else {
            const char = Bot.charLocs.find(c => c.name.toLowerCase() === character.name.toLowerCase());
            if (char) {
                const shopLoc = char.locations.filter(l => l.cost);
                if (shopLoc.length) {
                    outList = outList.concat(shopLoc.map(l => `${l.type} - ${l.cost.replace("/", " per ")} shards`));
                }
            }
        }
        if (!outList.length) {
            return super.error(message, message.language.get("COMMAND_FARM_CHAR_UNAVAILABLE"));
        }
        const fields = [];
        if (options.defaults) {
            fields.push({
                name: "Default flags used:",
                value: Bot.codeBlock(options.defaults)
            });
        }
        return message.channel.send({embed: {
            author: {
                name: character.name + message.language.get("COMMAND_FARM_LOCATIONS")
            },
            color: character.side === "light" ? "#0055ff" : "#e01414",
            description: `**${outList.map(f => "* " + f).join("\n")}**`,
            fields: fields
        }});
    }
}

module.exports = Farm;
