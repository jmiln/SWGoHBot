import {
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    codeBlock,
    InteractionContextType,
} from "discord.js";
import type Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import { setconfOptions } from "../data/constants/setconfOptions.ts";
import { characterNameList, characters, shipNameList, ships } from "../data/constants/units.ts";
import { isValidZone } from "../modules/functions.ts";
import { getGuildAliases } from "../modules/guildConfig/aliases.ts";
import { getGuildSettings, setGuildSettings } from "../modules/guildConfig/settings.ts";
import { getGuildTWList, setGuildTWList } from "../modules/guildConfig/twlist.ts";
import type { GuildConfigSettings } from "../schemas/guildConfigs.schema.ts";
import type { GuildConfigTWList } from "../types/guildConfig_types.ts";
import type { BotUnit, CommandContext } from "../types/types.ts";

// Set the base subargs up
type OptOut = {
    name: string;
    type: ApplicationCommandOptionType;
    description: string;
    choices?: { name: string; value: string }[];
};
const options = {
    add: {
        name: "add",
        description: "Add a value to one of the array settings",
        type: ApplicationCommandOptionType.Subcommand,
        options: [] as OptOut[],
    },
    remove: {
        name: "remove",
        description: "Remove a value from one of the array settings",
        type: ApplicationCommandOptionType.Subcommand,
        options: [] as OptOut[],
    },
    set: {
        name: "set",
        type: ApplicationCommandOptionType.Subcommand,
        description: "Set the value of one of the options",
        options: [] as OptOut[],
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
for (const [key, value] of Object.entries(setconfOptions)) {
    // Fill out the options based on the default settings in the config file
    const optOut: OptOut = {
        name: toOptionName(key),
        type: value.type,
        description: value.description,
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
    static readonly metadata = {
        name: "setconf",
        description: "Change settings for your guild",
        contexts: [InteractionContextType.Guild],
        permLevel: 3,
        options: Object.values(options),
        category: "Admin",
    };
    constructor() {
        super(SetConf.metadata);
    }

    async run({ interaction, language }: CommandContext) {
        if (!interaction?.guild?.id) {
            return super.error(interaction, language.get("BASE_COMMAND_UNAVAILABLE"));
        }

        const guildId = interaction.guild.id;
        const guildConf = await getGuildSettings({ guildId });
        if (!guildConf) {
            return super.error(
                interaction,
                "I cannot find a config for your guild. Please report this to the folks over at this bot's server, check `/info` for the invite code",
            );
        }

        const subCommand = interaction.options.getSubcommand();
        if (interaction.options.getSubcommandGroup() === "twlist") {
            return this.manageTWList(interaction, language, guildId, subCommand);
        }
        return this.updateSettings(interaction, language, guildId, guildConf, subCommand);
    }

    private async manageTWList(interaction: ChatInputCommandInteraction, language: Language, guildId: string, subCommand: string) {
        const guildTWList = await getGuildTWList({ guildId });

        // View the available list
        if (subCommand === "view") {
            const outArr = formatTWList(guildTWList);
            if (!outArr.length) return super.error(interaction, language.get("COMMAND_SETCONF_TW_NO_UNITS"));
            return super.success(interaction, outArr.join("\n"), { title: "Your current list:" });
        }

        // Otherwise we're gonna be managing the lists
        const addUnitDefId = interaction.options.getString("add_unit");
        const removeUnitDefId = interaction.options.getString("remove_unit");

        if (addUnitDefId) {
            return subCommand === "blacklist"
                ? this.addToBlacklist(interaction, language, guildId, guildTWList, addUnitDefId)
                : this.addToTWList(interaction, language, guildId, guildTWList, addUnitDefId);
        }
        if (removeUnitDefId) {
            return subCommand === "blacklist"
                ? this.removeFromBlacklist(interaction, language, guildId, guildTWList, removeUnitDefId)
                : this.removeFromTWList(interaction, language, guildId, guildTWList, removeUnitDefId);
        }
        return super.error(interaction, language.get("COMMAND_SETCONF_TW_NO_UNIT_SPECIFIED"));
    }

    private async addToTWList(
        interaction: ChatInputCommandInteraction,
        language: Language,
        guildId: string,
        guildTWList: GuildConfigTWList,
        addUnitDefId: string,
    ) {
        if (listedCategories(guildTWList).some((key) => guildTWList[key]?.includes(addUnitDefId))) {
            return super.error(interaction, language.get("COMMAND_SETCONF_UNIT_IN_LIST", addUnitDefId));
        }
        const placement = twListPlacement(addUnitDefId);
        if (placement) {
            guildTWList[placement.category] ??= [];
            guildTWList[placement.category]?.push(placement.defId);
        }
        return this.saveTWList(
            interaction,
            guildId,
            guildTWList,
            language.get("COMMAND_SETCONF_UNIT_ADDED", addUnitDefId),
            `Broke while trying to add ${addUnitDefId}.`,
        );
    }

    private async addToBlacklist(
        interaction: ChatInputCommandInteraction,
        language: Language,
        guildId: string,
        guildTWList: GuildConfigTWList,
        addUnitDefId: string,
    ) {
        if (!guildTWList.Blacklist) guildTWList.Blacklist = [];
        if (guildTWList.Blacklist?.includes(addUnitDefId)) {
            return super.error(interaction, language.get("COMMAND_SETCONF_UNIT_IN_BLACKLIST", addUnitDefId));
        }
        guildTWList.Blacklist.push(addUnitDefId);
        return this.saveTWList(
            interaction,
            guildId,
            guildTWList,
            language.get("COMMAND_SETCONF_UNIT_ADDED_BLACKLIST", addUnitDefId),
            `Broke while trying to add ${addUnitDefId} to the blacklist.`,
        );
    }

    private async removeFromTWList(
        interaction: ChatInputCommandInteraction,
        language: Language,
        guildId: string,
        guildTWList: GuildConfigTWList,
        removeUnitDefId: string,
    ) {
        for (const key of listedCategories(guildTWList)) {
            if (guildTWList[key]?.includes(removeUnitDefId)) {
                guildTWList[key] = guildTWList[key]?.filter((u: string) => u !== removeUnitDefId);
            }
        }
        return this.saveTWList(
            interaction,
            guildId,
            guildTWList,
            language.get("COMMAND_SETCONF_UNIT_REMOVED", removeUnitDefId),
            `Broke while trying to remove ${removeUnitDefId}.`,
        );
    }

    private async removeFromBlacklist(
        interaction: ChatInputCommandInteraction,
        language: Language,
        guildId: string,
        guildTWList: GuildConfigTWList,
        removeUnitDefId: string,
    ) {
        const blacklist = guildTWList.Blacklist ?? [];
        if (!blacklist.includes(removeUnitDefId)) {
            return super.error(interaction, language.get("COMMAND_SETCONF_NOT_IN_BLACKLIST", removeUnitDefId));
        }
        guildTWList.Blacklist = blacklist.filter((u) => u !== removeUnitDefId);
        return this.saveTWList(
            interaction,
            guildId,
            guildTWList,
            language.get("COMMAND_SETCONF_UNIT_REMOVED_BLACKLIST", removeUnitDefId),
            `Broke while trying to remove ${removeUnitDefId} from the blacklist.`,
        );
    }

    private async saveTWList(
        interaction: ChatInputCommandInteraction,
        guildId: string,
        guildTWList: GuildConfigTWList,
        successMsg: string,
        failMsg: string,
    ) {
        try {
            await setGuildTWList({ guildId, twListOut: guildTWList });
            return super.success(interaction, successMsg);
        } catch (err) {
            return super.error(interaction, `${failMsg}\n${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async updateSettings(
        interaction: ChatInputCommandInteraction,
        language: Language,
        guildId: string,
        guildConf: GuildConfigSettings,
        subCommand: string,
    ) {
        const settingsIn: Record<string, unknown> = {};
        const errors: string[] = [];
        const changeLog: string[] = [];
        for (const [key, defConf] of Object.entries(setconfOptions)) {
            const input = readSettingInput(interaction, language, key, defConf?.type);
            if (!input) continue;
            if ("error" in input) {
                errors.push(input.error);
                continue;
            }

            const change = changeSetting(subCommand, key, guildConf[key as keyof typeof guildConf], input);
            if (!change) continue;
            changeLog.push(change.log);

            // If it got here, then the setting should be valid and changed
            if (change.value !== guildConf[key as keyof typeof guildConf]) {
                settingsIn[key] = change.value;
            }
        }

        // If there are any errors, tell em and don't actually change anything
        if (errors.length) {
            return super.error(interaction, codeBlock(errors.map((e) => `* ${e}`).join("\n")));
        }

        if (Object.keys(settingsIn)?.length) {
            // Go through and make all the changes to the guildConf
            for (const key of Object.keys(settingsIn)) {
                (guildConf as unknown as Record<string, unknown>)[key] = settingsIn[key];
            }

            // Actually change stuff in the db
            await setGuildSettings({ guildId, settings: guildConf });
            return super.success(interaction, codeBlock(changeLog.map((c) => `* ${c}`).join("\n")));
        }
        return super.error(interaction, language.get("COMMAND_SETCONF_NOTHING_UPDATED"));
    }

    async autocomplete(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
        if (interaction.options.getSubcommandGroup() !== "twlist") return;

        const searchKey = focusedOption.value?.trim().toLowerCase() ?? "";
        const guildId = interaction?.guild?.id ?? "";
        if (focusedOption.name === "add_unit") {
            const aliases = await getGuildAliases({ guildId });
            const unitList = [
                ...aliases.map((alias) => ({ name: `${alias.name} (${alias.alias})`, defId: alias.defId })),
                ...characterNameList,
                ...shipNameList,
            ];
            const outArr = unitList
                .filter((unit) => unit.name.toLowerCase().includes(searchKey))
                .map((key) => ({ name: key.name, value: key.defId }))
                .slice(0, MAX_CHOICES);
            await interaction.respond(outArr);
            return;
        }
        if (focusedOption.name !== "remove_unit") return;

        const subCommand = interaction.options.getSubcommand();
        const guildTWList = await getGuildTWList({ guildId });
        if (subCommand === "blacklist") {
            await interaction.respond(unitChoices(guildTWList.Blacklist ?? [], searchKey));
        } else if (subCommand === "manage_list") {
            // [...guildTWList.GLs, ...guildTWList.characters, ...guildTWList.ships, ...guildTWList.capitalShips];
            const defIdList = listedCategories(guildTWList).flatMap((key) => guildTWList[key] ?? []);
            await interaction.respond(unitChoices(defIdList, searchKey));
        }
    }
}

const MAX_CHOICES = 24;

type SettingValue = { value: string | number | boolean; name: string | null };

function toOptionName(key: string) {
    return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function findNamedUnit(defId: string) {
    return characterNameList.find((char) => char.defId === defId) || shipNameList.find((ship) => ship.defId === defId);
}

function unitChoices(defIds: string[], searchKey: string) {
    return defIds
        .flatMap((defId) => {
            const thisUnit = findNamedUnit(defId);
            if (!thisUnit?.name.toLowerCase().includes(searchKey)) return [];
            return [{ name: thisUnit.name, value: thisUnit.defId }];
        })
        .slice(0, MAX_CHOICES);
}

function listedCategories(guildTWList: GuildConfigTWList) {
    return (Object.keys(guildTWList) as (keyof GuildConfigTWList)[]).filter((key) => key !== "Blacklist");
}

function formatTWList(guildTWList: GuildConfigTWList) {
    const outArr: string[] = [];
    for (const key of Object.keys(guildTWList)) {
        const list = guildTWList[key as keyof typeof guildTWList];
        if (!list?.length) continue;
        outArr.push(`* **${key}**: \n${list.map((defId: string) => `  - ${findNamedUnit(defId)?.name || "N/A"}`).join("\n")}`);
    }
    return outArr;
}

function twListPlacement(unitName: string): { category: keyof GuildConfigTWList; defId: string } | null {
    const thisChar = characters.find((u) => u.uniqueName === unitName || u.name === unitName);
    if (thisChar) return { category: characterCategory(thisChar), defId: thisChar.uniqueName };

    const thisShip = ships.find((u) => u.uniqueName === unitName || u.name === unitName);
    if (!thisShip) return null;
    return { category: thisShip.factions.includes("Capital Ship") ? "Capital Ships" : "Ships", defId: thisShip.uniqueName };
}

function characterCategory(thisChar: BotUnit): keyof GuildConfigTWList {
    if (thisChar.factions.includes("Galactic Legend")) return "Galactic Legends";
    if (thisChar.side === "dark") return "Dark Side";
    if (thisChar.side === "neutral") return "Neutral";
    return "Light Side";
}

function readSettingInput(
    interaction: ChatInputCommandInteraction,
    language: Language,
    key: string,
    keyType: ApplicationCommandOptionType,
): SettingValue | { error: string } | null {
    const input = readOptionValue(interaction, toOptionName(key), keyType);
    if (!input || "error" in input) return input;
    const error = settingError(language, key, input.value);
    return error ? { error } : input;
}

function settingError(language: Language, key: string, value: SettingValue["value"]) {
    if (key === "timezone" && !isValidZone(String(value))) {
        // If it's not a valid timezone, let em know
        return language.get("BASE_INVALID_TIMEZONE");
    }
    if (key === "eventCountdown" && Number(value) < 0) {
        // Make sure the entered number is positive
        return `${value} is not a valid entry, it __must__ be above 0`;
    }
    return null;
}

function readOptionValue(
    interaction: ChatInputCommandInteraction,
    optionKey: string,
    keyType: ApplicationCommandOptionType,
): SettingValue | { error: string } | null {
    switch (keyType) {
        case ApplicationCommandOptionType.String: {
            const value = interaction.options.getString(optionKey);
            return value ? { value, name: null } : null;
        }
        case ApplicationCommandOptionType.Integer: {
            const value = interaction.options.getInteger(optionKey);
            return value === null ? null : { value, name: null };
        }
        case ApplicationCommandOptionType.Boolean: {
            const value = interaction.options.getBoolean(optionKey);
            return value === null ? null : { value, name: null };
        }
        case ApplicationCommandOptionType.Channel: {
            const channel = interaction.options.getChannel(optionKey);
            return channel ? { value: channel.id, name: `#${channel.name}` } : null;
        }
        case ApplicationCommandOptionType.Role: {
            const role = interaction.options.getRole(optionKey);
            return role?.id ? { value: role.id, name: role.name } : null;
        }
        default:
            return { error: `[Setconf] Invalid keyType: ${keyType}` };
    }
}

function changeSetting(action: string, key: string, current: unknown, { value, name }: SettingValue) {
    if (action === "set") {
        // Just send back the setting
        return { value, log: `Set ${key} to ${name ? name : value}` };
    }
    if (action === "add") {
        // Stick it into the old one
        return { value: [...new Set([...(current as unknown[]), value])], log: `Added ${value} to ${key}` };
    }
    if (action === "remove") {
        // Take out a setting from an array
        const newArr = (current as unknown[]).filter((s) => s !== value && s !== name);
        return { value: [...new Set(newArr)], log: `Removed ${value} from ${key}` };
    }
    return null;
}
