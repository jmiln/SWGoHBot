const {inspect} = require("util");  // eslint-disable-line no-unused-vars
const Command = require("../base/Command");

class Farm extends Command {
    constructor(client) {
        super(client, {
            name: "farm",
            category: "SWGoH",
            aliases: [],
            permissions: ["EMBED_LINKS"]
        });
    }

    async run(client, message, [...searchChar]) {

        if (!searchChar || !searchChar.length) return super.error(message, message.language.get("COMMAND_FARM_USAGE", message.guildSettings.prefix), {title: message.language.get("COMMAND_FARM_MISSING_CHARACTER"), example: "farm bb8"});
        searchChar = searchChar.join(" ");
        const chars = client.findChar(searchChar, client.characters);
        let character;
        if (!chars.length) {
            // Didn't find one
            return super.error(message, message.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
        } else if (chars.length > 1) {
            // Found too many
            return super.error(message, message.language.get("BASE_SWGOH_CHAR_LIST", chars.map(c => c.name).join("\n")));
        } else {
            character = chars[0];
        }

        const unit = await client.swgohAPI.units(character.uniqueName, message.swgohLanguage);
        if (!unit) {
            return super.error(message, "Broke trying to get the unit.");
        } 
        const recipe = await client.swgohAPI.recipes(unit.creationRecipeReference, message.swgohLanguage);
        if (!recipe) {
            return super.error(message, "Broke trying to get the recipe.");
        } 
        const mat = recipe[0].ingredientsList.find(i => i.id.startsWith("unitshard"));
        const material = await client.swgohAPI.materials(mat.id, message.swgohLanguage);
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
            const battle = await client.swgohAPI.battles(mission.campaignId);
            const found = battle[0].campaignMapList.find(c => c.id === mission.campaignMapId);
            out += parseInt(found.id.replace(/[^\d]/g, ""));
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
            const letter = client.missions[mission.campaignId][mission.campaignMapId][mission.campaignNodeDifficulty][mission.campaignMissionId];
            out += letter;
            outList.push(out);
        }
        if (raidLookupList.length) {
            // For han, gk, traya etc..
            for (const mis of raidLookupList) {
                let out = "";
                const mission = mis.missionIdentifier;
                const battle = await client.swgohAPI.battles(mission.campaignId);
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

        if (character.shardLocations.shops.length) {
            outList = outList.concat(character.shardLocations.shops);
        }
        if (!outList.length) {
            return super.error(message, message.language.get("COMMAND_FARM_CHAR_UNAVAILABLE"));
        } 
        return message.channel.send({embed: {
            author: {
                name: character.name + " farm locations"
            },
            color: character.side === "light" ? 0x0055ff : 0xe01414,
            description: `**${outList.map(f => "* " + f).join("\n")}**`
        }});
    }
}

module.exports = Farm;

