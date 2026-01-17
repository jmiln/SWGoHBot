import { ApplicationCommandOptionType, type AutocompleteFocusedOption, codeBlock } from "discord.js";
import Command from "../base/slashCommand.ts";
import cache from "../modules/cache.ts";
import { typedDefaultSettings } from "../data/constants/defaultGuildConf.ts"
import { getGuildAliases } from "../modules/guildConfig/aliases.ts";
import { getGuildSettings, setGuildSettings } from "../modules/guildConfig/settings.ts";
import { getGuildTWList, setGuildTWList } from "../modules/guildConfig/twlist.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

// Set the base subargs up
const options = {
    add: {
        name: "add",
        description: "Add a value to one of the array settings",
        type: ApplicationCommandOptionType.Subcommand,
        options: [],
    },
    remove: {
        name: "remove",
        description: "Remove a value from one of the array settings",
        type: ApplicationCommandOptionType.Subcommand,
        options: [],
    },
    set: {
        name: "set",
        type: ApplicationCommandOptionType.Subcommand,
        description: "Set the value of one of the options",
        options: [],
    },
    twlist: {
        name: "twlist",
        type: ApplicationCommandOptionType.SubcommandGroup,
        description: "Manage the Territory War unit list",
        options: [
            {
                name: "manage_list",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Update the Territory War unit list",
                options: [
                    {
                        name: "add_unit",
                        type: ApplicationCommandOptionType.String,
                        description: "Add a unit to the list",
                        autocomplete: true,
                    },
                    {
                        name: "remove_unit",
                        description: "Remove a unit from the list",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                ],
            },
            {
                name: "blacklist",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Blacklist units you don't want showing up",
                options: [
                    {
                        name: "add_unit",
                        type: ApplicationCommandOptionType.String,
                        description: "Add a unit to the list",
                        autocomplete: true,
                    },
                    {
                        name: "remove_unit",
                        description: "Remove a unit from the list",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                    },
                ],
            },
            {
                name: "view",
                type: ApplicationCommandOptionType.Subcommand,
                description: "View the current list",
            },
        ],
    },
};

// Check out each option in the config file, and set it up in each subarg as needed
for (const [key, value] of Object.entries(typedDefaultSettings)) {
    // Fill out the options based on the default settings in the config file
    const optOut = {
        name: key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`),
        type: value.type,
        description: value.description,
        choices: null,
    };
    if (value?.choices) {
        optOut.choices = value.choices.map((choice: string) => {
            return {
                name: choice,
                value: choice,
            };
        });
    }
    if (value.isArray) {
        options.add.options.push(optOut);
        options.remove.options.push(optOut);
    } else {
        options.set.options.push(optOut);
    }
}

export default class SetConf extends Command {
    constructor(Bot: BotType) {
        super(Bot, {
            guildOnly: false,
            name: "setconf",
            permLevel: 3,
            options: Object.values(options),
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        if (!interaction?.guild?.id) {
            return super.error(interaction, "Sorry, but this command is only usable in servers");
        }

        const guildConf = await getGuildSettings({ cache: cache, guildId: interaction.guild.id });
        if (!guildConf) {
            return super.error(
                interaction,
                "I cannot find a config for your guild. Please report this to the folks over at this bot's server, check `/info` for the invite code",
            );
        }

        const subCommandGroup = interaction.options.getSubcommandGroup();
        const subCommand = interaction.options.getSubcommand();

        function getCharName(defId: string) {
            return (
                Bot.CharacterNames.find((char) => char.defId === defId)?.name ||
                Bot.ShipNames.find((ship) => ship.defId === defId)?.name ||
                "N/A"
            );
        }

        if (subCommandGroup === "twlist") {
            const guildTWList = await getGuildTWList({ cache: cache, guildId: interaction.guild.id });

            // View the available list
            if (subCommand === "view") {
                const outArr = [];
                for (const key of Object.keys(guildTWList)) {
                    if (!guildTWList[key].length) continue;
                    outArr.push(`* **${key}**: \n${guildTWList[key].map((defId: string) => `  - ${getCharName(defId)}`).join("\n")}`);
                }
                if (!outArr.length) return super.error(interaction, "You have no units in your list");
                return super.success(interaction, outArr.join("\n"), { title: "Your current list:" });
            }

            // Otherwise we're gonna be managing the lists
            const addUnitDefId = interaction.options.getString("add_unit");
            const removeUnitDefId = interaction.options.getString("remove_unit");

            if (!addUnitDefId && !removeUnitDefId) {
                return super.error(interaction, "You must specify a unit to add or remove");
            }

            if (addUnitDefId) {
                if (subCommand === "manage_list") {
                    for (const key of Object.keys(guildTWList)) {
                        if (key === "Blacklist") continue;
                        if (guildTWList[key].includes(removeUnitDefId)) {
                            return super.error(interaction, `Trying to add ${addUnitDefId}. This unit is already in your list`);
                        }
                    }
                    const thisChar = Bot.characters.find((u) => u.uniqueName === addUnitDefId || u.name === addUnitDefId);
                    if (thisChar) {
                        if (thisChar.factions.includes("Galactic Legend")) {
                            guildTWList["Galactic Legends"].push(thisChar.uniqueName);
                        } else if (thisChar.side === "dark") {
                            guildTWList["Dark Side"].push(thisChar.uniqueName);
                        } else {
                            guildTWList["Light Side"].push(thisChar.uniqueName);
                        }
                    } else {
                        const thisShip = Bot.ships.find((u) => u.uniqueName === addUnitDefId || u.name === addUnitDefId);
                        if (thisShip) {
                            if (thisShip.factions.includes("Capital Ship")) {
                                guildTWList["Capital Ships"].push(thisShip.uniqueName);
                            } else {
                                guildTWList.Ships.push(thisShip.uniqueName);
                            }
                        }
                    }

                    try {
                        await setGuildTWList({ cache: cache, guildId: interaction.guild.id, twListOut: guildTWList });
                        return super.success(interaction, `Added ${addUnitDefId} to your list`);
                    } catch (err) {
                        return super.error(interaction, `Broke while trying to add ${addUnitDefId}.\n${err.message}`);
                    }
                } else if (subCommand === "blacklist") {
                    if (!guildTWList.Blacklist) guildTWList.Blacklist = [];
                    if (guildTWList.Blacklist?.includes(addUnitDefId)) {
                        return super.error(interaction, `Trying to add ${addUnitDefId}. This unit is already in your blacklist`);
                    }
                    guildTWList.Blacklist.push(addUnitDefId);
                    try {
                        await setGuildTWList({ cache: cache, guildId: interaction.guild.id, twListOut: guildTWList });
                        return super.success(interaction, `Added ${addUnitDefId} to your blacklist`);
                    } catch (err) {
                        return super.error(interaction, `Broke while trying to add ${addUnitDefId} to the blacklist.\n${err.message}`);
                    }
                }
            }

            if (removeUnitDefId) {
                if (subCommand === "manage_list") {
                    for (const key of Object.keys(guildTWList)) {
                        if (key === "Blacklist") continue;
                        if (guildTWList[key].includes(removeUnitDefId)) {
                            guildTWList[key] = guildTWList[key].filter((u: string) => u !== removeUnitDefId);
                        }
                    }
                    try {
                        await setGuildTWList({ cache: cache, guildId: interaction.guild.id, twListOut: guildTWList });
                        return super.success(interaction, `Removed ${removeUnitDefId} from your list`);
                    } catch (err) {
                        return super.error(interaction, `Broke while trying to remove ${removeUnitDefId}.\n${err.message}`);
                    }
                } else if (subCommand === "blacklist") {
                    if (!guildTWList.Blacklist.includes(removeUnitDefId)) {
                        return super.error(interaction, `Trying to remove ${removeUnitDefId}. This unit is not in your blacklist`);
                    }
                    guildTWList.Blacklist = guildTWList.Blacklist.filter((u) => u !== removeUnitDefId);
                    try {
                        await setGuildTWList({ cache: cache, guildId: interaction.guild.id, twListOut: guildTWList });
                        return super.success(interaction, `Removed ${removeUnitDefId} from your blacklist`);
                    } catch (err) {
                        return super.error(
                            interaction,
                            `Broke while trying to remove ${removeUnitDefId} from the blacklist.\n${err.message}`,
                        );
                    }
                }
            }
        }

        const settingsIn = {};
        const errors = [];
        const changeLog = [];
        for (const [key, defConf] of Object.entries(typedDefaultSettings)) {
            const optionKey = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
            const keyType = defConf?.type;
            let settingStr = null;
            let nameStr = null;
            if (keyType === ApplicationCommandOptionType.String) {
                settingStr = interaction.options.getString(optionKey);
                if (!settingStr) continue;
                if (key === "timezone" && !Bot.isValidZone(settingStr)) {
                    // If it's not a valid timezone, let em know
                    errors.push(interaction.language.get("COMMAND_SETCONF_TIMEZONE_NEED_ZONE"));
                    continue;
                }
            } else if (keyType === ApplicationCommandOptionType.Integer) {
                settingStr = interaction.options.getInteger(optionKey);
                if (!settingStr) continue;
                if (key === "eventCountdown" && settingStr < 0) {
                    // Make sure the entered number is positive
                    errors.push(`${settingStr} is not a valid entry, it __must__ be above 0`);
                    continue;
                }
            } else if (keyType === ApplicationCommandOptionType.Boolean) {
                settingStr = interaction.options.getBoolean(optionKey);
                if (["enable_part", "enable_welcome"].includes(key) && settingStr === true) {
                    // If they're trying to enable the welcome or part message, make sure there's an announcement channel set up
                    if (!guildConf.announce_chan?.length) {
                        await interaction.channel.send(
                            "The welcome and parting messages will not work without an announcement channel set.",
                        );
                    }
                }
            } else if (keyType === ApplicationCommandOptionType.Channel) {
                const channel = interaction.options.getChannel(optionKey);
                if (!channel) continue;
                nameStr = `#${channel.name}`;
                settingStr = channel.id;
            } else if (keyType === ApplicationCommandOptionType.Role) {
                const role = interaction.options.getRole(optionKey);
                nameStr = role.name;
                settingStr = role.id;
                if (!settingStr) continue;
            } else {
                errors.push(`[Setconf] Invalid keyType: ${keyType}`);
                continue;
            }

            const newSetting = changeSetting(subCommand, key, settingStr, nameStr);

            // If it got here, then the setting should be valid and changed
            if (newSetting !== null && newSetting !== guildConf[key]) {
                settingsIn[key] = newSetting;
            }
        }

        function changeSetting(action: string, key: string, setting: string, name: string) {
            if (setting === null) return null;
            if (action === "set") {
                // Just send back the setting
                changeLog.push(`Set ${key} to ${name ? name : setting}`);
                return setting;
            }
            if (action === "add") {
                // Stick it into the old one
                const newArr = [...guildConf[key]];
                newArr.push(setting);
                changeLog.push(`Added ${setting} to ${key}`);

                return [...new Set(newArr)];
            }
            if (action === "remove") {
                // Take out a setting from an array
                let newArr = [...guildConf[key]];
                newArr = newArr.filter((s) => s !== setting && s !== name);
                changeLog.push(`Removed ${setting} from ${key}`);

                return [...new Set(newArr)];
            }
        }

        // If there are any errors, tell em and don't actually change anything
        if (errors.length) {
            return super.error(interaction, codeBlock(errors.map((e) => `* ${e}`).join("\n")));
        }

        if (Object.keys(settingsIn)?.length) {
            // Go through and make all the changes to the guildConf
            for (const key of Object.keys(settingsIn)) {
                guildConf[key] = settingsIn[key];
            }

            // Actually change stuff in the db
            await setGuildSettings({ cache: cache, guildId: interaction.guild.id, settings: guildConf });
            return super.success(interaction, codeBlock(changeLog.map((c) => `* ${c}`).join("\n")));
        }
        return super.error(interaction, "It looks like nothing needed to be updated");
    }

    async autocomplete(Bot: BotType, interaction: BotInteraction, focusedOption: AutocompleteFocusedOption) {
        const subCommandGroup = interaction.options.getSubcommandGroup();
        const subCommand = interaction.options.getSubcommand();

        if (subCommandGroup === "twlist") {
            const searchKey = focusedOption.value?.trim().toLowerCase();
            if (focusedOption.name === "add_unit") {
                const aliases = await getGuildAliases({ cache: cache, guildId: interaction?.guild?.id });
                const unitList = [
                    ...aliases.map((alias) => ({ name: `${alias.name} (${alias.alias})`, defId: alias.defId })),
                    ...Bot.CharacterNames,
                    ...Bot.ShipNames,
                ];
                const outArr =
                    unitList
                        .filter((unit) => unit.name.toLowerCase().includes(searchKey))
                        .map((key) => ({ name: key.name, value: key.defId }))
                        .slice(0, 24) || [];
                await interaction.respond(outArr);
            } else if (focusedOption.name === "remove_unit") {
                const guildTWList = await getGuildTWList({ cache: cache, guildId: interaction?.guild?.id });
                if (subCommand === "blacklist") {
                    const outArr =
                        guildTWList.Blacklist.filter((defId) => {
                            if (!searchKey?.length) return true;
                            const thisUnit =
                                Bot.CharacterNames.find((char) => char.defId === defId) ||
                                Bot.ShipNames.find((ship) => ship.defId === defId);
                            return thisUnit.name.toLowerCase().includes(searchKey);
                        })
                            .map((defId) => {
                                const thisUnit =
                                    Bot.CharacterNames.find((char) => char.defId === defId) ||
                                    Bot.ShipNames.find((ship) => ship.defId === defId);
                                return { name: thisUnit.name, value: thisUnit.defId };
                            })
                            .slice(0, 24) || [];
                    await interaction.respond(outArr);
                } else if (subCommand === "manage_list") {
                    const defIdList = Object.keys(guildTWList).reduce((acc, key) => {
                        if (key === "Blacklist" || !guildTWList[key]?.length) return acc;
                        return acc.concat(guildTWList[key]);
                    }, []);
                    // [...guildTWList.GLs, ...guildTWList.characters, ...guildTWList.ships, ...guildTWList.capitalShips];
                    const outArr =
                        defIdList
                            .filter((defId) => {
                                if (!searchKey?.length) return true;
                                const thisUnit =
                                    Bot.CharacterNames.find((char) => char.defId === defId) ||
                                    Bot.ShipNames.find((ship) => ship.defId === defId);
                                return thisUnit.name.toLowerCase().includes(searchKey);
                            })
                            .map((key) => {
                                const thisUnit =
                                    Bot.CharacterNames.find((char) => char.defId === key) ||
                                    Bot.ShipNames.find((ship) => ship.defId === key);
                                return { name: thisUnit.name, value: thisUnit.defId };
                            })
                            .slice(0, 24) || [];
                    await interaction.respond(outArr);
                }
            }
        }
    }
}
