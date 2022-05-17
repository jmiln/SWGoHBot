import { Interaction } from "discord.js";
import SlashCommand from "../base/slashCommand";
import { BotInteraction, BotType, BotClient } from "../modules/types";

class ReloadData extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "reloaddata",
            category: "Dev",
            enabled: true,
            description: "Reload the various data files",
            guildOnly: true,
            permLevel: 10,
            options: [
                {
                    name: "target",
                    description: "What to reload",
                    type: Bot.constants.optionType.STRING,
                    required: true,
                    choices: [
                        {name: "Data", value: "Data"},
                        {name: "Debug", value: "DebugLogs"},
                        {name: "Events", value: "Events"},
                        {name: "Functions", value: "Functions"},
                        {name: "Languages", value: "Languages"},
                        {name: "Slash Commands", value: "SlashCommands"},
                        {name: "SWAPI", value: "SWAPI"},
                        {name: "SWLang", value: "SWLang"},
                        {name: "Users", value: "Users"},
                    ]
                }
            ]
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) { // eslint-disable-line no-unused-vars
        const channelId = interaction.channel.id;
        const action = interaction.options.getString("target").toLowerCase();

        switch (action) {
            case "slashcommands": // Reloads all the commands,
                interaction.client.shard.broadcastEval(async (client: BotClient) => {
                    return await client.reloadAllSlashCommands();
                })
                    .then((res: {succArr: string[], errArr: string[]}[]) => {
                        let errors = [];
                        res.forEach(r => {
                            if (r.errArr?.length) errors.push(...r.errArr);
                        });
                        errors = [...new Set(errors)];
                        const resOut = res.map((r) => `${r.succArr.length.toString().padStart(4)} | ${r.errArr.length}`);
                        return interaction.reply({content: Bot.codeBlock(`Succ | Err\n${resOut.join("\n")}${errors.length ? "\n\nErrors in files:\n" + errors.join("\n") : ""}`)});
                    })
                    .catch(err => console.log("[ReloadData slash com]\n" + err));
                break;
            case "debuglogs":
                Bot.config.debugLogs = !Bot.config.debugLogs;
                return super.success(interaction, `DebugLogs set to **${Bot.config.debugLogs}**`);
            case "events": // Reload the events
                await interaction.client.shard.broadcastEval(async (client: BotClient) => {return await client.reloadAllEvents();})
                .then((res: {succArr: string[], errArr: string[]}[]) => {
                    let errors = [];
                    res.forEach(r => {
                        if (r.errArr?.length) errors.push(...r.errArr);
                    });
                    errors = [...new Set(errors)];
                    const resOut = res.map((r: {errArr: string[], succArr: string[]}) => `${r.succArr.length.toString().padStart(4)} | ${r.errArr.length}`);
                    return interaction.reply({content: Bot.codeBlock(`Succ | Err\n${resOut.join("\n")}${errors.length ? "\n\nErrors in files:\n" + errors.join("\n") : ""}`)});
                })
                .catch(err => console.log("[ReloadData ev]\n" + err));
                break;
            case "functions": // Reload the functions file
                interaction.client.shard.broadcastEval((client: BotClient) => {return client.reloadFunctions();})
                    .then((res: {err: string}[]) => {
                        let errors = [];
                        res.forEach(r => {
                            if (r?.err) errors.push(r.err);
                        });
                        errors = [...new Set(errors)];
                        return interaction.reply({
                            content: errors.length ? "**ERROR**\n" + Bot.codeBlock(errors.join("\n")) : "> Functions reloaded!"
                        });
                    })
                    .catch(err => console.log("[ReloadData funct]\n" + err));
                break;
            case "swapi": // Reload the swapi file
                interaction.client.shard.broadcastEval((client: BotClient) => {return client.reloadSwapi();})
                    .then((res: {err: string}[]) => {
                        let errors = [];
                        res.forEach(r => {
                            if (r?.err) errors.push(r.err);
                        });
                        errors = [...new Set(errors)];
                        return interaction.reply({
                            content: errors.length ? "**ERROR**\n" + errors.join("\n") : "> Swapi reloaded!"
                        });
                    })
                    .catch(err => console.log("[ReloadData swapi]\n" + err));
                break;
            case "data": // Reload the character/ ship data files
                interaction.client.shard.broadcastEval((client: BotClient) => {return client.reloadDataFiles();})
                    .then((res: {err: string}[]) => {
                        let errors = [];
                        res.forEach(r => {
                            if (r?.err) errors.push(r.err);
                        });
                        errors = [...new Set(errors)];
                        return interaction.reply({
                            content: errors.length ? "**ERROR**\n" + Bot.codeBlock(errors.join("\n")) : "> Data reloaded!"
                        });
                    })
                    .catch(err => console.log("[ReloadData data]\n" + err));
                break;
            case "languages":
                interaction.client.shard.broadcastEval((client: BotClient) => {return client.reloadLanguages();})
                    .then((res: {err: string}[]) => {
                        let errors = [];
                        res.forEach((r) => {
                            if (r.err) errors.push(r.err);
                        });
                        errors = [...new Set(errors)];
                        return interaction.reply({
                            content: errors.length ? "**ERROR**\n" + errors.join("\n") : "> Languages reloaded!"
                        });
                    })
                    .catch(err => console.log("[ReloadData data]\n" + err));
                break;
            case "swlang": {
                // Do this first since it's just the basic skeleton
                const langList = Bot.swgohLangList;

                // Helper funct to log the updates
                const progressArr = [];
                const progressOut = (strIn: string) => {
                    progressArr.push(strIn);
                    if (interaction.replied) {
                        interaction.editReply({content: progressArr.join("\n")});
                    } else {
                        interaction.reply({content: progressArr.join("\n")});
                    }
                };

                await Bot.swgohAPI.character(null, true);
                progressOut("Starting update...");
                for (const lang of langList) {
                    await Bot.swgohAPI.units("", lang, true);
                    progressOut(`Updated units for ${lang}`);

                    await Bot.swgohAPI.abilities([], lang, true);
                    progressOut(`Updated abilities for ${lang}`);

                    await Bot.swgohAPI.gear([], lang, true);
                    progressOut(`Updated gear for ${lang}`);

                    if (lang.toLowerCase() === "eng_us") {
                        await Bot.swgohAPI.recipes([], lang, true);
                        progressOut(`Updated recipes for ${lang}`);
                    } else {
                        progressOut(`Skipping recipes for ${lang}`);
                    }

                    progressOut(`Updated all local data for ${lang}`);
                }
                interaction.editReply({content: "API Language update complete"});
                break;
            }
            case "users": // Reload the users file
                interaction.client.shard.broadcastEval((client: BotClient) => {return client.reloadUserReg();})
                    .then((res: {err: string}[]) => {
                        let errors = [];
                        res.forEach(r => {
                            if (r.err) errors.push(r.err);
                        });
                        errors = [...new Set(errors)];
                        return interaction.reply({
                            content: errors.length ? "**ERROR**\n" + errors.join("\n") : "> Users reloaded!"
                        });
                    })
                    .catch(err => console.log("[ReloadData users]\n" + err));
                break;
            default:
                return super.error(interaction, "You can only choose `api, commands, events, functions, languages, swlang, users, or data.`");
        }
    }
}

module.exports = ReloadData;
