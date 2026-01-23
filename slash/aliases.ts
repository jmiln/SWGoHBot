import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";
import Command from "../base/slashCommand.ts";
import config from "../config.js";
import cache from "../modules/cache.ts";
import { characters,ships } from "../data/constants/units.ts";
import type { BotInteraction, BotType, GuildAlias } from "../types/types.ts";

export default class Aliases extends Command {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "aliases",
            description: "Set custom aliases for your guild to use",
            guildOnly: false,
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
                        },
                    ],
                },
                {
                    name: "view",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "View your current aliases",
                },
            ],
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        // Make sure this is running in a server, since it doesn't do any good in DMs
        if (!interaction?.guild?.id) return super.error(interaction, "Sorry, but this command is only usable in servers");

        const action = interaction.options.getSubcommand();
        const searchUnit = interaction.options.getString("unit");
        const alias = interaction.options.getString("alias");
        const guildId = interaction.guild.id;

        // Load up all the guild's settings and such
        const res = await cache.get(config.mongodb.swgohbotdb, "guildConfigs", { guildId: guildId }, { aliases: 1 });
        const guildAliases = res[0]?.aliases || [];

        if (action === "add") {
            // Make sure both fields were filled. They're both marked required so it shouldn't hit this, but just in case.
            if (!searchUnit || !alias) return super.error(interaction, "Both fields MUST be filled in. Please try again.");

            return this.handleAddAlias(Bot, interaction, alias, searchUnit, guildAliases);
        }
        if (action === "remove") {
            return this.handleRemoveAlias(Bot, interaction, alias, guildAliases);
        }
        return interaction.reply({
            content: `>>> ${`- ${guildAliases.map((al: GuildAlias) => `${al.alias} - ${al.name}`).join("\n- ")}`}`,
        });
    }

    private async handleAddAlias(Bot: BotType, interaction: BotInteraction, alias: string, unitKey: string, guildAliases: GuildAlias[]) {
        const unit = characters.find((c) => c.uniqueName === unitKey) || ships.find((s) => s.uniqueName === unitKey);

        if (!unit) {
            return super.error(interaction, `I couldn't find a matching unit for '${unitKey}'`);
        }

        if (guildAliases.some((al) => al.alias === alias)) {
            return super.error(interaction, `This alias is already in use for ***${unit.name}***`);
        }

        guildAliases.push({ alias, defId: unit.uniqueName, name: unit.name });

        await cache
            .put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: interaction.guild.id }, { aliases: guildAliases } as any, false)
            .then(() => {
                super.success(interaction, `Your alias (${alias}) for ***${unit.name}*** has been successfully submitted`);
            })
            .catch((error: Error) => {
                super.error(interaction, `There was an issue when submitting that: \n${error.toString()}`);
            });
    }

    private async handleRemoveAlias(Bot: BotType, interaction: ChatInputCommandInteraction, alias: string, guildAliases: GuildAlias[]) {
        if (!guildAliases.some((al) => al.alias === alias)) {
            return super.error(interaction, "That isn't a current alias.");
        }

        const filteredAliases = guildAliases.filter((al) => al.alias !== alias).sort((a, b) => (a.alias > b.alias ? 1 : -1));
        await cache
            .put(config.mongodb.swgohbotdb, "guildConfigs", { guildId: interaction.guild.id }, { aliases: filteredAliases } as any, false)
            .then(() => {
                super.success(interaction, `Your alias (${alias}) has been successfully removed.`);
            })
            .catch((error: Error) => {
                super.error(interaction, `There was an issue when submitting that: \n${error.toString()}`);
            });
    }
}
