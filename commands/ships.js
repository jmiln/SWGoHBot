// const util = require('util');
const Command = require("../base/Command");

class Ships extends Command {
    constructor(client) {
        super(client, {
            name: "ships",
            aliases: ["s", "ship"],
            category: "Star Wars"
        });
    }

    async run(client, message, args) {
        const shipList = client.ships;

        // Remove any junk from the name
        const searchName = args.join(" ");

        // Make sure they gave a character to find
        if (searchName === "") {
            return super.error(message, message.language.get("COMMAND_SHIPS_NEED_CHARACTER", message.guildSettings.prefix));
        }

        // Find any characters that match that
        const ships = client.findChar(searchName, shipList, true);
        if (ships.length <= 0) {
            return super.error(message, message.language.get("COMMAND_SHIPS_INVALID_CHARACTER", message.guildSettings.prefix));
        } else if (ships.length > 1) {
            return super.error(message, message.language.get("BASE_SWGOH_CHAR_LIST", ships.map(s => `${s.name}${s.crew.length ? "\n" + s.crew.map(c => "- " + c).join("\n") + "\n" : "\n"}`).join("\n")));
        }

        const ship = ships[0];
        const unit = await client.swgohAPI.getCharacter(ship.uniqueName, message.guildSettings.swgohLanguage);

        const shipAbilities = unit.skillReferenceList;

        const fields = [];

        if (unit.crew.length) {
            const crew = [];
            unit.crew.forEach(crewMember => {
                const crewName = client.characters.find(c => c.uniqueName === crewMember);
                crew.push(crewName.name);
            });
            fields.push({
                "name": message.language.get("COMMAND_SHIPS_CREW"),
                "value": crew.join(", ").toProperCase()
            });
        }
        if (unit.factions.length) {
            fields.push({
                "name": message.language.get("COMMAND_SHIPS_FACTIONS"),
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
                    "value": message.language.get("COMMAND_SHIPS_ABILITIES", a)
                });
            }
        }
        if (!fields.length) {
            fields.push({
                "name": "Error",
                "value": "Sorry, but this ship has not been fully updated yet."
            });
        }
        message.channel.send({
            embed: {
                "color": `${ship.side === "light" ? 0x5114e0 : 0xe01414}`,
                "author": {
                    "name": ship.name.toProperCase(),
                    "url": ship.url,
                    "icon_url": ship.avatarURL
                },
                "fields": fields
            }
        });
    }
}

module.exports = Ships;
