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
            return super.error(message, "[FARM] Broke trying to get the unit.");
        }

        let outList = [];
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
                char.locations.forEach(loc => {
                    if (loc.cost) {
                        // This will be anything in a store
                        outList.push( `${loc.type} - ${loc.cost.replace("/", " per ")} shards`);
                    } else if (loc.level) {
                        // It's a node, fleet, cantina, light/ dark side
                        loc.type = loc.type.replace("Hard Modes (", "").replace(")", "");
                        if (loc.type === "L") {
                            outList.push(`Light Side Hard ${loc.level}`);
                        } else if (loc.type === "D") {
                            outList.push(`Dark Side Hard ${loc.level}`);
                        } else if (loc.type === "Fleet") {
                            outList.push(`Fleet Hard ${loc.level}`);
                        } else if (loc.type === "Cantina") {
                            outList.push(`Cantina ${loc.level}`);
                        }
                    } else if (loc.name) {
                        // This will be any of the events
                        outList.push(Bot.expandSpaces(`__${loc.type}__: ${loc.name}`));
                    }
                });
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
        return message.channel.send({embeds: [{
            author: {
                name: character.name + message.language.get("COMMAND_FARM_LOCATIONS")
            },
            color: character.side === "light" ? "#0055ff" : "#e01414",
            description: `**${outList.map(f => "* " + f).join("\n")}**`,
            fields: fields
        }]});
    }
}

module.exports = Farm;
