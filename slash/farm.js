const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class Farm extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "farm",
            guildOnly: false,
            options: [
                {
                    name: "character",
                    autocomplete: true,
                    description: "The character or ship you want to search for",
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        });
    }

    async run(Bot, interaction) {
        // Grab the character they're looking for
        const searchChar = interaction.options.getString("character");
        let isChar = true;

        // Check the characters list
        let chars = Bot.findChar(searchChar, Bot.characters);

        // If there was no luck with characters, try checking the ships
        if (!chars?.length) {
            isChar = false;
            chars = Bot.findChar(searchChar, Bot.ships, true);
        }
        if (!chars?.length) {
            // Didn't find one
            return super.error(interaction, interaction.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
        } else if (chars.length > 1) {
            // Found too many
            return super.error(interaction, interaction.language.get("BASE_SWGOH_CHAR_LIST", chars.map(c => c.name).join("\n")));
        }

        // There was only one result, so lets use it
        const character = chars[0];

        const unit = await Bot.swgohAPI.units(character.uniqueName, interaction.swgohLanguage);
        if (!unit) {
            return super.error(interaction, "[FARM] Broke trying to get the unit.");
        }

        const outList = [];
        let unitLocs = null;
        if (!isChar) {
            unitLocs = Bot.shipLocs.find(s => s.name.toLowerCase() === character.name.toLowerCase());
        } else {
            unitLocs = Bot.charLocs.find(c => c.name.toLowerCase() === character.name.toLowerCase());
        }

        if (unitLocs) {
            unitLocs.locations.forEach(loc => {
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
        if (!outList.length) {
            return super.error(interaction, interaction.language.get("COMMAND_FARM_CHAR_UNAVAILABLE"));
        }
        return interaction.reply({embeds: [{
            author: {
                name: character.name + interaction.language.get("COMMAND_FARM_LOCATIONS")
            },
            color: Bot.getSideColor(character.side),
            description: `**${outList.map(f => "* " + f).join("\n")}**`
        }]});
    }
}

module.exports = Farm;
