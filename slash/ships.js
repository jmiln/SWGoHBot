// const util = require('util');
const Command = require("../base/slashCommand");

class Ships extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "ships",
            aliases: ["s", "ship"],
            category: "Star Wars",
            options: [
                {
                    name: "ship",
                    type: "STRING",
                    description: "The ship to look up",
                    required: true
                }
            ]
        });
    }

    async run(Bot, interaction) {
        const shipList = Bot.ships;
        const searchName = interaction.options.getString("ship");

        // Find any characters that match that
        const ships = Bot.findChar(searchName, shipList, true);
        if (ships.length <= 0) {
            return super.error(interaction, `Sorry, but I cannot find **${searchName}**. Please double check the spelling, and that it's a proper ship/ crew crew member.`);
        } else if (ships.length > 1) {
            return super.error(interaction, interaction.language.get("BASE_SWGOH_CHAR_LIST", ships.map(s => {
                let outStr = null;
                if (s.crew?.length) {
                    outStr = `${s.name}${"\n" + s.crew.map(c => "- " + c).join("\n") + "\n"}`
                } else {
                    outStr = s.name
                }
                return outStr;
            }).join("\n")));
        }

        const ship = ships[0];
        const unit = await Bot.swgohAPI.getCharacter(ship.uniqueName, interaction.guildSettings.swgohLanguage);

        const shipAbilities = unit.skillReferenceList;

        const fields = [];

        if (unit.crew.length) {
            const crew = [];
            unit.crew.forEach(crewMember => {
                const crewName = Bot.characters.find(c => c.uniqueName === crewMember);
                crew.push(crewName.name);
            });
            fields.push({
                "name": interaction.language.get("COMMAND_SHIPS_CREW"),
                "value": crew.join(", ").toProperCase()
            });
        }
        if (unit.factions.length) {
            fields.push({
                "name": interaction.language.get("COMMAND_SHIPS_FACTIONS"),
                "value": unit.factions.join(", ").toProperCase()
            });
        }
        if (shipAbilities.length) {
            for (const ability of shipAbilities) {
                const a = {
                    type: ability.skillId.split("_")[0].replace("skill", "").toProperCase(),
                    abilityCooldown: ability.cooldown,
                    abilityDesc: ability.desc
                };
                fields.push({
                    "name": ability.name,
                    "value": interaction.language.get("COMMAND_SHIPS_ABILITIES", a)
                });
            }
        }
        if (!fields.length) {
            fields.push({
                "name": "Error",
                "value": "Sorry, but this ship has not been fully updated yet."
            });
        }
        return interaction.reply({
            embeds: [{
                "color": `${ship.side === "light" ? "#5114e0" : "#e01414"}`,
                "author": {
                    "name": ship.name.toProperCase(),
                    "url": ship.url,
                    "icon_url": ship.avatarURL
                },
                "fields": fields
            }]
        });
    }
}

module.exports = Ships;