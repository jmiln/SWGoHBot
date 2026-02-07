import { ApplicationCommandOptionType, InteractionContextType } from "discord.js";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import help from "../data/help.ts";
import { msgArray, toProperCase } from "../modules/functions.ts";
import type { CommandContext } from "../types/types.ts";

export default class Help extends Command {
    static readonly metadata = {
        name: "help",
        guildOnly: false,
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

        if (!search) {
            const fields = [];
            const div = "`======================================`";
            const helpKeys = Object.keys(help);
            for (const [ix, cat] of helpKeys.entries()) {
                if (category && category !== cat) continue;
                const thisCat = help[cat];

                const outArr = [`__${thisCat.description}__`];
                const catCmd = Object.keys(thisCat.commands);

                for (const cmd of catCmd) {
                    const cmdArr = formatCmdHelp(thisCat.commands[cmd].usage, cmd, thisCat.commands[cmd].desc, isDetailed);
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
            const commands = {};
            for (const cat of Object.keys(help)) {
                for (const cmd of Object.keys(help[cat].commands)) {
                    commands[cmd] = help[cat].commands[cmd];
                }
            }

            const thisCom = commands[search.toLowerCase()];
            if (!thisCom) return super.error(interaction, "I couldn't find a match for that command name.");

            const cmdArr = formatCmdHelp(thisCom.usage, search, thisCom.desc);

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
