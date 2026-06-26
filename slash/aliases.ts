import {
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    InteractionContextType,
} from "discord.js";
import type Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import { env } from "../config/config.ts";
import { characters, ships } from "../data/constants/units.ts";
import cache from "../modules/cache.ts";
import type { CommandContext, GuildAlias } from "../types/types.ts";

export default class Aliases extends Command {
    static readonly metadata = {
        name: "aliases",
        description: "Set custom aliases for your guild to use",
        contexts: [InteractionContextType.Guild],
        permLevel: 3,
        options: [
            {
                name: "add",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Add a unit alias",
                options: [
                    {
                        name: "unit",
                        type: ApplicationCommandOptionType.String,
                        autocomplete: true,
                        description: "The unit that you want to add an alias for",
                        required: true,
                    },
                    {
                        name: "alias",
                        type: ApplicationCommandOptionType.String,
                        description: "The alias for the selected unit",
                        required: true,
                    },
                ],
            },
            {
                name: "remove",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Remove an alias",
                options: [
                    {
                        name: "alias",
                        type: ApplicationCommandOptionType.String,
                        description: "The alias to remove",
                        required: true,
                        autocomplete: true,
                    },
                ],
            },
            {
                name: "view",
                type: ApplicationCommandOptionType.Subcommand,
                description: "View your current aliases",
            },
        ],
        category: "Admin",
    };

    constructor() {
        super(Aliases.metadata);
    }

    async autocomplete(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
        const subCommand = interaction.options.getSubcommand();

        // Only handle autocomplete for the remove subcommand's alias option
        if (subCommand === "remove" && focusedOption.name === "alias") {
            if (!interaction?.guild?.id) {
                return await interaction.respond([]);
            }

            const searchKey = focusedOption.value?.trim().toLowerCase() || "";

            // Load guild aliases
            const res = await cache.getOne(env.MONGODB_SWGOHBOT_DB, "guildConfigs", { guildId: interaction.guild.id }, { aliases: 1 });
            const guildAliases: GuildAlias[] = res?.aliases || [];

            // Filter and format aliases
            const filtered = guildAliases
                .filter((al) => al.alias.toLowerCase().includes(searchKey) || al.name.toLowerCase().includes(searchKey))
                .map((al) => ({
                    name: `${al.alias} - ${al.name}`,
                    value: al.alias,
                }))
                .slice(0, 25);

            await interaction.respond(filtered);
        }
    }

    async run({ interaction, language }: CommandContext) {
        // Make sure this is running in a server, since it doesn't do any good in DMs
        if (!interaction.inCachedGuild()) return super.error(interaction, language.get("BASE_COMMAND_UNAVAILABLE"));

        const action = interaction.options.getSubcommand();
        const searchUnit = interaction.options.getString("unit");
        const alias = interaction.options.getString("alias");
        const guildId = interaction.guild.id;

        // Load up all the guild's settings and such
        const res = await cache.getOne(env.MONGODB_SWGOHBOT_DB, "guildConfigs", { guildId: guildId }, { aliases: 1 });
        const guildAliases = res?.aliases || [];

        if (action === "add") {
            // Make sure both fields were filled. They're both marked required so it shouldn't hit this, but just in case.
            if (!searchUnit || !alias) return super.error(interaction, language.get("COMMAND_ALIASES_FIELDS_REQUIRED"));

            return this.handleAddAlias(interaction, language, alias, searchUnit, guildAliases);
        }
        if (action === "remove") {
            return this.handleRemoveAlias(interaction, language, alias, guildAliases);
        }
        return interaction.reply({
            content: `>>> ${`- ${guildAliases.map((al: GuildAlias) => `${al.alias} - ${al.name}`).join("\n- ")}`}`,
        });
    }

    private async handleAddAlias(
        interaction: ChatInputCommandInteraction<"cached">,
        language: Language,
        alias: string,
        unitKey: string,
        guildAliases: GuildAlias[],
    ) {
        const unit = characters.find((c) => c.uniqueName === unitKey) || ships.find((s) => s.uniqueName === unitKey);

        if (!unit) {
            return super.error(interaction, language.get("COMMAND_ALIASES_UNIT_NOT_FOUND", unitKey));
        }

        if (guildAliases.some((al) => al.alias === alias)) {
            return super.error(interaction, language.get("COMMAND_ALIASES_IN_USE", unit.name));
        }

        guildAliases.push({ alias, defId: unit.uniqueName, name: unit.name });

        try {
            await cache.put(
                env.MONGODB_SWGOHBOT_DB,
                "guildConfigs",
                { guildId: interaction.guild.id },
                { aliases: guildAliases } as never,
                false,
            );
            return super.success(interaction, language.get("COMMAND_ALIASES_ADDED", alias, unit.name));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return super.error(interaction, language.get("COMMAND_ALIASES_SUBMIT_ERROR", errorMessage));
        }
    }

    private async handleRemoveAlias(
        interaction: ChatInputCommandInteraction<"cached">,
        language: Language,
        alias: string,
        guildAliases: GuildAlias[],
    ) {
        if (!guildAliases.some((al) => al.alias === alias)) {
            return super.error(interaction, language.get("COMMAND_ALIASES_NOT_FOUND"));
        }

        const filteredAliases = guildAliases.filter((al) => al.alias !== alias).sort((a, b) => (a.alias > b.alias ? 1 : -1));
        try {
            await cache.put(
                env.MONGODB_SWGOHBOT_DB,
                "guildConfigs",
                { guildId: interaction.guild.id },
                { aliases: filteredAliases } as never,
                false,
            );
            return super.success(interaction, language.get("COMMAND_ALIASES_REMOVED", alias));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return super.error(interaction, language.get("COMMAND_ALIASES_SUBMIT_ERROR", errorMessage));
        }
    }
}
