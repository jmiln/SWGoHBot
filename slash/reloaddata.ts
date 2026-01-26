import { ApplicationCommandOptionType, codeBlock, MessageFlags } from "discord.js";
import Command from "../base/slashCommand.ts";
import config from "../config.js";
import logger from "../modules/Logger.ts";
import type { BotInteraction, BotType } from "../types/types.ts";

export default class ReloadData extends Command {
    static readonly metadata = {
        name: "reloaddata",
        enabled: true,
        guildOnly: true,
        permLevel: 10,
        options: [
            {
                name: "target",
                description: "What to reload",
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: "Data", value: "Data" },
                    { name: "Debug", value: "Debug" },
                    { name: "Deploy Commands", value: "Deploy" },
                    { name: "Events", value: "Events" },
                    { name: "Functions", value: "Functions" },
                    { name: "Languages", value: "Languages" },
                    { name: "Slash Commands", value: "SlashCommands" },
                    { name: "SWAPI", value: "SWAPI" },
                    { name: "SWLang", value: "SWLang" },
                    { name: "Users", value: "Users" },
                ],
            },
        ],
    };
    constructor(Bot: BotType) {
        super(Bot, ReloadData.metadata);
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        // eslint-disable-line no-unused-vars
        const channelId = interaction.channel.id;
        const action = interaction.options.getString("target").toLowerCase();

        switch (action) {
            case "com":
            case "slashcommands": // Reloads all the slash commands,
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    await interaction.client.shard
                        .broadcastEval(async (client) => await client.reloadAllSlashCommands())
                        .then((res) => this.thenResFiles(Bot, interaction, res))
                        .catch((err) => logger.error(`[ReloadData slash com]\n${err}`));
                } else {
                    interaction.client.reloadAllSlashCommands();
                }
                break;
            case "debug":
            case "debugLogs":
                config.debugLogs = !config.debugLogs;
                return super.success(interaction, `DebugLogs set to **${config.debugLogs}**`);
            case "deploy": {
                const outLog = await Bot.deployCommands(true);
                return interaction.reply({
                    content: "Deploying Commands...",
                    embeds: [
                        {
                            title: "Deployed Commands",
                            description: outLog?.length ? null : "Nothing deployed",
                        },
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }
            case "ev":
            case "events": // Reload the events
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    interaction.client.shard
                        .broadcastEval((client) => client.reloadAllEvents())
                        .then((res) => this.thenResFiles(Bot, interaction, res))
                        .catch((err) => logger.error(`[ReloadData ev]\n${err}`));
                } else {
                    interaction.client.reloadAllEvents(channelId);
                }
                break;
            case "func":
            case "funct":
            case "functs":
            case "function":
            case "functions": // Reload the functions file
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    interaction.client.shard
                        .broadcastEval((client) => client.reloadFunctions())
                        .then((res) => {
                            this.thenRes(Bot, interaction, res, "Functions");
                        })
                        .catch((err) => logger.error(`[ReloadData funct]\n${err}`));
                } else {
                    interaction.client.reloadFunctions();
                }
                break;
            case "api":
            case "swapi": // Reload the swapi file
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    interaction.client.shard
                        .broadcastEval((client) => client.reloadSwapi())
                        .then((res) => {
                            this.thenRes(Bot, interaction, res, "swApi");
                        })
                        .catch((err) => logger.error(`[ReloadData swapi]\n${err}`));
                } else {
                    interaction.client.reloadSwapi();
                }
                break;
            case "data": // Reload the character/ ship data files
                if (interaction.client.shard && interaction.client.shard.count > 0) {
                    interaction.client.shard
                        .broadcastEval((client) => client.reloadDataFiles())
                        .then((res) => {
                            this.thenRes(Bot, interaction, res, "Data");
                        })
                        .catch((err) => logger.error(`[ReloadData data]\n${err}`));
                } else {
                    interaction.client.reloadDataFiles();
                }
                break;
            case "lang":
            case "language":
            case "languages":
                // if (interaction.client.shard && interaction.client.shard.count > 0) {
                //     interaction.client.shard
                //         .broadcastEval(() => reloadLanguages())
                //         .then((res) => {
                //             this.thenRes(Bot, interaction, res, "Languages");
                //         })
                //         .catch((err) => logger.error(`[ReloadData data]\n${err}`));
                // } else {
                //     reloadLanguages();
                // }
                break;
            case "swlang": {
                // Do this first since it's just the basic skeleton
                return super.error(interaction, "This is no longer needed");
                // const langList = constants.swgohLangList;
                //
                // // Helper funct to log the updates
                // const progressArr = [];
                // const progressOut = (strIn) => {
                //     progressArr.push(strIn);
                //     if (interaction.replied) {
                //         interaction.editReply({content: progressArr.join("\n")});
                //     } else {
                //         interaction.reply({content: progressArr.join("\n")});
                //     }
                // };
                //
                // await swgohAPI.character(null, true);
                // progressOut("Starting update...");
                // for (const lang of langList) {
                //     await swgohAPI.units("", lang, true);
                //     progressOut(`Updated units for ${lang}`);
                //
                //     await swgohAPI.abilities([], lang, true);
                //     progressOut(`Updated abilities for ${lang}`);
                //
                //     await swgohAPI.gear([], lang, true);
                //     progressOut(`Updated gear for ${lang}`);
                //
                //     if (lang.toLowerCase() === "eng_us") {
                //         await swgohAPI.recipes([], lang, true);
                //         progressOut(`Updated recipes for ${lang}`);
                //     } else {
                //         progressOut(`Skipping recipes for ${lang}`);
                //     }
                //
                //     progressOut(`Updated all local data for ${lang}`);
                // }
                // interaction.editReply({content: "API Language update complete"});
                // break;
            }
            // case "users": // Reload the users file
            //     if (interaction.client.shard && interaction.client.shard.count > 0) {
            //         interaction.client.shard
            //             .broadcastEval((client) => client.reloadUserReg())
            //             .then((res) => {
            //                 this.thenRes(Bot, interaction, res, "Users");
            //             })
            //             .catch((err) => logger.error(`[ReloadData users]\n${err}`));
            //     } else {
            //         interaction.client.reloadUserReg();
            //     }
            //     break;
            default:
                return super.error(interaction, "You can only choose `swapi, events, functions, languages, swlang, users, or data.`");
        }
    }

    thenRes(_Bot: BotType, interaction: BotInteraction, res: { err?: string }[], reloadType: string) {
        const errors = [];
        for (const r of res) {
            if (r?.err) errors.push(r.err);
        }
        const uniqueErrors = [...new Set(errors)];
        return interaction.reply({
            content: uniqueErrors.length ? `**ERROR**\n${codeBlock(uniqueErrors.join("\n"))}` : `> ${reloadType} reloaded!`,
        });
    }

    thenResFiles(_Bot: BotType, interaction: BotInteraction, res: { succArr: string[]; errArr: string[] }[]) {
        let errors = [];
        for (const r of res) {
            if (r.errArr?.length) errors.push(...r.errArr);
        }
        errors = [...new Set(errors)];
        const resOut = res.map((r) => `${r.succArr.length.toString().padStart(4)} | ${r.errArr.length}`);
        return interaction.reply({
            content: codeBlock(`Succ | Err\n${resOut.join("\n")}${errors.length ? `\n\nErrors in files:\n${errors.join("\n")}` : ""}`),
        });
    }
}
