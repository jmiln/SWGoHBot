const { ApplicationCommandOptionType, codeBlock } = require("discord.js");
const Command = require("../base/slashCommand");
const { typedDefaultSettings } = require("../config.js");
const { getGuildSettings, setGuildSettings } = require("../modules/guildConfig/settings.js");
const { getGuildAliases } = require("../modules/guildConfig/aliases");
const { getGuildTWList, setGuildTWList } = require("../modules/guildConfig/twlist");

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
        options: []
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
        ]
    }
};

// Check out each option in the config file, and set it up in each subarg as needed
for (const set of Object.keys(typedDefaultSettings)) {
    // Fill out the options based on the default settings in the config file
    const thisSet = typedDefaultSettings[set];
    const optOut = {
        name: set.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`),
        type: thisSet.type,
        description: thisSet.description,
    };
    if (thisSet?.choices) {
        optOut.choices = thisSet.choices.map((choice) => {
            return {
                name: choice,
                value: choice,
            };
        });
    }
    if (thisSet.isArray) {
        options.add.options.push(optOut);
        options.remove.options.push(optOut);
    } else {
        options.set.options.push(optOut);
    }
}

class SetConf extends Command {
    constructor(Bot) {
        super(Bot, {
            guildOnly: false,
            name: "setconf",
            permLevel: 3,
            options: Object.values(options),
        });
    }

    async run(Bot, interaction) {
        if (!interaction?.guild?.id) {
            return super.error(interaction, "Sorry, but this command is only usable in servers");
        }

        const guildConf = await getGuildSettings({ cache: Bot.cache, guildId: interaction.guild.id });
        if (!guildConf) {
            return super.error(
                interaction,
                "I cannot find a config for your guild. Please report this to the folks over at this bot's server, check `/info` for the invite code",
            );
        }

        const subCommandGroup = interaction.options.getSubcommandGroup();
        const subCommand = interaction.options.getSubcommand();

        const cleanKey = {
            GLs: "Galactic Legends",
            characters: "Characters",
            ships: "Ships",
            capitalShips: "Capital Ships",
            blacklist: "Blacklist",
        }

        function getCharName(defId) {
            return Bot.CharacterNames.find((char) => char.defId === defId)?.name ||
                Bot.ShipNames.find((ship) => ship.defId === defId)?.name ||
                "N/A";
        }

        if (subCommandGroup === "twlist") {
            const guildTWList = await getGuildTWList({ cache: Bot.cache, guildId: interaction.guild.id });

            // View the available list
            if (subCommand === "view") {
                const outArr = [];
                for (const key of Object.keys(guildTWList)) {
                    if (!guildTWList[key].length) continue;
                    outArr.push(`* **${cleanKey[key]}**: \n${guildTWList[key].map((defId) => `  - ${getCharName(defId)}`).join("\n")}`);
                }
                if (!outArr.length) return super.error(interaction, "You have no units in your list");
                return super.success(interaction, outArr.join("\n"), {title: "Your current list:"});
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
                        if (key === "blacklist") continue;
                        if (guildTWList[key].includes(removeUnitDefId)) {
                            return super.error(interaction, `Trying to add ${addUnitDefId}. This unit is already in your list`);
                        }
                    }
                    const thisChar = Bot.characters.find((u) => u.uniqueName === addUnitDefId || u.name === addUnitDefId);
                    if (thisChar) {
                        if (thisChar.factions.includes("Galactic Legend")) {
                            guildTWList.GLs.push(thisChar.uniqueName);
                        } else {
                            guildTWList.characters.push(thisChar.uniqueName);
                        }
                    } else {
                        const thisShip = Bot.ships.find((u) => u.uniqueName === addUnitDefId || u.name === addUnitDefId);
                        if (thisShip) {
                            if (thisShip.factions.includes("Capital Ship")) {
                                guildTWList.capitalShips.push(thisShip.uniqueName);
                            } else {
                                guildTWList.ships.push(thisShip.uniqueName);
                            }
                        }
                    }


                    try {
                        await setGuildTWList({ cache: Bot.cache, guildId: interaction.guild.id, twListOut: guildTWList });
                        return super.success(interaction, `Added ${addUnitDefId} to your list`);
                    } catch (err) {
                        return super.error(interaction, `Broke while trying to add ${addUnitDefId}.\n${err.message}`);
                    }
                } else if (subCommand === "blacklist") {
                    if (!guildTWList.blacklist) guildTWList.blacklist = [];
                    if (guildTWList.blacklist?.includes(addUnitDefId)) {
                        return super.error(interaction, `Trying to add ${addUnitDefId}. This unit is already in your blacklist`);
                    }
                    guildTWList.blacklist.push(addUnitDefId);
                    try {
                        await setGuildTWList({ cache: Bot.cache, guildId: interaction.guild.id, twListOut: guildTWList });
                        return super.success(interaction, `Added ${addUnitDefId} to your blacklist`);
                    } catch (err) {
                        return super.error(interaction, `Broke while trying to add ${addUnitDefId} to the blacklist.\n${err.message}`);
                    }
                }
            }

            if (removeUnitDefId) {
                if (subCommand === "manage_list") {
                    for (const key of Object.keys(guildTWList)) {
                        if (key === "blacklist") continue;
                        if (guildTWList[key].includes(removeUnitDefId)) {
                            guildTWList[key] = guildTWList[key].filter((u) => u !== removeUnitDefId);
                        }
                    }
                    try {
                        await setGuildTWList({ cache: Bot.cache, guildId: interaction.guild.id, twListOut: guildTWList });
                        return super.success(interaction, `Removed ${removeUnitDefId} from your list`);
                    } catch (err) {
                        return super.error(interaction, `Broke while trying to remove ${removeUnitDefId}.\n${err.message}`);
                    }
                } else if (subCommand === "blacklist") {
                    if (!guildTWList.blacklist.includes(removeUnitDefId)) {
                        return super.error(interaction, `Trying to remove ${removeUnitDefId}. This unit is not in your blacklist`);
                    }
                    guildTWList.blacklist = guildTWList.blacklist.filter((u) => u !== removeUnitDefId);
                    try {
                        await setGuildTWList({ cache: Bot.cache, guildId: interaction.guild.id, twListOut: guildTWList });
                        return super.success(interaction, `Removed ${removeUnitDefId} from your blacklist`);
                    } catch (err) {
                        return super.error(interaction, `Broke while trying to remove ${removeUnitDefId} from the blacklist.\n${err.message}`);
                    }
                }
            }
        }

        const settingsIn = {};
        const errors = [];
        const changeLog = [];
        for (const key of Object.keys(typedDefaultSettings)) {
            const optionKey = key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
            const keyType = typedDefaultSettings[key]?.type;
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
                settingStr = interaction.options.getRole(optionKey);
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

        function changeSetting(action, key, setting, name) {
            if (setting === null) return null;
            if (action === "set") {
                // Just send back the setting
                changeLog.push(`Set ${key} to ${name ? name : setting}`);
                return setting;
            }
            if (action === "add") {
                // Stick it into the old one
                const newArr = [...guildConf[key]];
                if (key === "adminRole") {
                    newArr.push(setting.id);
                    changeLog.push(`Added ${setting?.name} to AdminRole`);
                } else {
                    newArr.push(setting);
                    changeLog.push(`Added ${setting} to ${key}`);
                }

                return [...new Set(newArr)];
            }
            if (action === "remove") {
                // Take out a setting from an array
                let newArr = [...guildConf[key]];
                if (key === "adminRole") {
                    newArr = newArr.filter((s) => s !== setting.id && s !== setting.name);
                    changeLog.push(`Removed ${setting.id} from ${key}`);
                } else {
                    newArr = newArr.filter((s) => s !== setting);
                    changeLog.push(`Removed ${setting} from ${key}`);
                }

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
            await setGuildSettings({ cache: Bot.cache, guildId: interaction.guild.id, settings: guildConf });
            return super.success(interaction, codeBlock(changeLog.map((c) => `* ${c}`).join("\n")));
        }
        return super.error(interaction, "It looks like nothing needed to be updated");
    }

    async autocomplete(Bot, interaction, focusedOption) {
        const subCommandGroup = interaction.options.getSubcommandGroup();
        const subCommand = interaction.options.getSubcommand();

        if (subCommandGroup === "twlist") {
            if (focusedOption.name === "add_unit") {
                const searchKey = focusedOption.value?.toLowerCase();
                const aliases = await getGuildAliases({ cache: Bot.cache, guildId: interaction?.guild?.id });
                const unitList = [
                    ...aliases.map((alias) => ({ name: `${alias.name} (${alias.alias})`, defId: alias.defId })),
                    ...Bot.CharacterNames,
                    ...Bot.ShipNames,
                ];
                const outArr = unitList.filter((unit) => unit.name.toLowerCase().includes(searchKey)).map((key) => ({ name: key.name, value: key.defId})).slice(0, 24) || [];
                await interaction.respond(outArr);
            } else if (focusedOption.name === "remove_unit") {
                const searchKey = focusedOption.value;
                const guildTWList = await getGuildTWList({ cache: Bot.cache, guildId: interaction?.guild?.id });
                if (subCommand === "blacklist") {
                    const outArr = guildTWList.blacklist
                        .filter(defId => {
                            if (!defId?.length) return true;
                            const thisUnit = Bot.CharacterNames.find((char) => char.defId === defId) || Bot.ShipNames.find((ship) => ship.defId === defId);
                            return thisUnit.name.toLowerCase().includes(searchKey);
                        })
                        .map((defId) => {
                            const thisUnit = Bot.CharacterNames.find((char) => char.defId === defId) || Bot.ShipNames.find((ship) => ship.defId === defId);
                            return { name: thisUnit.name, value: thisUnit.defId}
                        }).slice(0, 24) || [];
                    await interaction.respond(outArr);
                } else if (subCommand === "manage_list") {
                    const defIdList = [...guildTWList.GLs, ...guildTWList.characters, ...guildTWList.ships, ...guildTWList.capitalShips];
                    const outArr = defIdList
                        .filter(defId => {
                            if (!defId?.length) return true;
                            const thisUnit = Bot.CharacterNames.find((char) => char.defId === defId) || Bot.ShipNames.find((ship) => ship.defId === defId);
                            return thisUnit.name.toLowerCase().includes(searchKey);
                        })
                        .map((key) => {
                            const thisUnit = Bot.CharacterNames.find((char) => char.defId === key) || Bot.ShipNames.find((ship) => ship.defId === key);
                            return { name: thisUnit.name, value: thisUnit.defId}
                        }).slice(0, 24) || [];
                    await interaction.respond(outArr);
                }
            }
        }
    }
}

module.exports = SetConf;
