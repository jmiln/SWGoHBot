import path from "node:path";
import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import { msgArray, readJSON, toProperCase } from "../modules/functions.ts";
import type { HelpJSON } from "../types/help_types.ts";
import type { CommandContext } from "../types/types.ts";

export default class Help extends Command {
    static readonly metadata = {
        name: "help",
        category: "General",
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        description: "Displays a list of the available commands.",
        options: [
            {
                name: "details",
                description: "Show details about each command's argument",
                type: ApplicationCommandOptionType.Boolean,
            },
            {
                name: "category",
                description: "Show a list of commands in a given category",
                type: ApplicationCommandOptionType.String,
                choices: ["Admin", "Gamedata", "General", "Patreon"].map((choice) => {
                    return {
                        name: choice,
                        value: choice,
                    };
                }),
            },
            {
                name: "command",
                description: "Show a specific command's details",
                autocomplete: true,
                type: ApplicationCommandOptionType.String,
            },
        ],
    };
    constructor() {
        super(Help.metadata);
    }

    async run({ interaction }: CommandContext) {
        const search = interaction.options.getString("command");
        const category = interaction.options.getString("category");
        const isDetailed = interaction.options.getBoolean("details");

        const color = Math.floor(Math.random() * 16777215);

        // Load help.json
        const helpJsonPath = path.resolve(import.meta.dirname, "../data/help.json");
        const help = await readJSON<HelpJSON>(helpJsonPath);
        const helpKeys = Object.keys(help).filter((key) => key !== "metadata");

        if (!search) {
            const fields = [];
            const div = "`======================================`";
            for (const [ix, cat] of helpKeys.entries()) {
                if (category && category !== cat) continue;
                const thisCat = help[cat];

                // Skip if not a category (metadata key)
                if (typeof thisCat === "object" && "commands" in thisCat) {
                    const outArr = [`__${thisCat.description}__`];

                    for (const cmd of thisCat.commands) {
                        const cmdArr = formatCmdHelp(cmd.usage, cmd.name, cmd.description, isDetailed);
                        outArr.push(cmdArr.join("\n"));
                    }

                    // Put a divider after this section / before the next
                    if (ix < helpKeys.length - 1) {
                        outArr.push(div);
                    }

                    // TODO Put the patreon logo at the start of the patreon section
                    const chunks = msgArray(outArr, "\n\n", 1000);
                    for (const [ix, chunk] of chunks.entries()) {
                        fields.push({
                            name: ix > 0 ? constants.zws : cat.toUpperCase(),
                            value: chunk,
                        });
                    }
                }
            }

            await interaction.reply({
                embeds: [
                    {
                        title: "Slash Commands List",
                        description: " - Options are either `<required>` or `[optional]`",
                        fields: fields.slice(0, 4),
                        color: color,
                    },
                ],
            });
            if (fields.length > 4) {
                return interaction.followUp({
                    embeds: [
                        {
                            fields: fields.slice(4),
                            color: color,
                        },
                    ],
                });
            }
        } else {
            // Searching for info on a certain command
            let foundCommand = null;
            for (const cat of helpKeys) {
                const thisCat = help[cat];
                if (typeof thisCat === "object" && "commands" in thisCat) {
                    foundCommand = thisCat.commands.find((cmd) => cmd.name.toLowerCase() === search.toLowerCase());
                    if (foundCommand) break;
                }
            }

            if (!foundCommand) return super.error(interaction, "I couldn't find a match for that command name.");

            const cmdArr = formatCmdHelp(foundCommand.usage, foundCommand.name, foundCommand.description);

            await interaction.reply({
                embeds: [
                    {
                        title: `Command description for ${toProperCase(search)}`,
                        description: ` - Options are either \`<required>\` or \`[optional]\`\n\n${cmdArr.join("\n")}`,
                        color: color,
                    },
                ],
            });
        }

        function formatCmdHelp(usage: string | string[], searchName: string, desc: string, isDetailed = true) {
            const cmdArr = [`**/${searchName.toLowerCase()}**\n${desc}`];
            if (!isDetailed || !Array.isArray(usage) || !usage?.length) return cmdArr;
            const usageLen = usage.length;

            for (const [ix, use] of usage.entries()) {
                const formattedUse = use.replace(/(\[[^\]]*\]|<[^>]*>)/g, "`$1`");
                if (!formattedUse.startsWith("*")) {
                    cmdArr.push(`** │** ${formattedUse}`);
                } else if (ix === usageLen - 1) {
                    cmdArr.push(`** └** ${formattedUse}`);
                } else {
                    cmdArr.push(`** ├** ${formattedUse}`);
                }
            }
            return cmdArr;
        }
    }
}
