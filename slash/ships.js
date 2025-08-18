import { ApplicationCommandOptionType } from "discord.js";
import Command from "../base/slashCommand.js";

export default class Ships extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "ships",
            guildOnly: false,
            options: [
                {
                    name: "ship",
                    autocomplete: true,
                    type: ApplicationCommandOptionType.String,
                    description: "The ship to look up",
                    required: true,
                },
            ],
        });
    }

    async run(Bot, interaction) {
        const shipList = Bot.ships;
        const searchName = interaction.options.getString("ship");

        // Find any characters that match that
        const ships = Bot.findChar(searchName, shipList, true);
        if (ships.length <= 0) {
            return super.error(
                interaction,
                `Sorry, but I cannot find **${searchName}**. Please double check the spelling, and that it's a proper ship/ crew crew member.`,
            );
        }
        if (ships.length > 1) {
            return super.error(
                interaction,
                interaction.language.get(
                    "BASE_SWGOH_CHAR_LIST",
                    ships
                        .map((s) => {
                            if (s.crew?.length) {
                                return `${s.name}${`\n${s.crew.map((c) => `- ${c}`).join("\n")}\n`}`;
                            }
                            return s.name;
                        })
                        .join("\n"),
                ),
            );
        }

        const ship = ships[0];
        const unit = await Bot.swgohAPI.getCharacter(ship.uniqueName, interaction.guildSettings.swgohLanguage);

        const shipAbilities = unit.skillReferenceList;

        const fields = [];

        if (unit.crew.length) {
            const crew = [];
            for (const crewMember of unit.crew) {
                const crewName = Bot.characters.find((c) => c.uniqueName === crewMember);
                crew.push(crewName.name);
            }
            fields.push({
                name: interaction.language.get("COMMAND_SHIPS_CREW"),
                value: Bot.toProperCase(crew.join(", ")),
            });
        }
        if (unit.factions.length) {
            fields.push({
                name: interaction.language.get("COMMAND_SHIPS_FACTIONS"),
                value: Bot.toProperCase(unit.factions.join(", ")),
            });
        }
        if (shipAbilities.length) {
            for (const ability of shipAbilities) {
                const a = {
                    type: Bot.toProperCase(ability.skillId.split("_")[0].replace("skill", "")),
                    abilityCooldown: ability.cooldown,
                    abilityDesc: ability.desc,
                };

                const msgArr = Bot.msgArray(Bot.expandSpaces(interaction.language.get("COMMAND_SHIPS_ABILITIES", a)).split(" "), " ", 1000);

                msgArr.forEach((m, ix) => {
                    if (ix === 0) {
                        fields.push({
                            name: ability.name,
                            value: m,
                        });
                    } else {
                        fields.push({
                            name: "-",
                            value: m,
                        });
                    }
                });
            }
        }
        if (!fields.length) {
            fields.push({
                name: "Error",
                value: "Sorry, but this ship has not been fully updated yet.",
            });
        }
        const charImg = await Bot.getBlankUnitImage(ship.uniqueName);
        return interaction.reply({
            embeds: [
                {
                    color: Bot.getSideColor(ship.side),
                    author: {
                        name: Bot.toProperCase(ship.name),
                        url: ship.url,
                    },
                    fields: fields,
                    thumbnail: { url: "attachment://image.png" },
                },
            ],
            files: [
                {
                    attachment: charImg,
                    name: "image.png",
                },
            ],
        });
    }
}
