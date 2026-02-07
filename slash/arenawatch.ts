import {
    ApplicationCommandOptionType,
    ChannelType,
    type ChatInputCommandInteraction,
    type Embed,
    type GuildChannel,
    InteractionContextType,
} from "discord.js";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import { isAllyCode, isUserMention, msgArray } from "../modules/functions.ts";
import logger from "../modules/Logger.ts";
import patreonFuncs from "../modules/patreonFuncs.ts";
import swgohAPI from "../modules/swapi.ts";
import userReg from "../modules/users.ts";
import type { SWAPIPlayer } from "../types/swapi_types.ts";
import type { CommandContext, UserConfig } from "../types/types.ts";

interface InteractionOptions {
    subCommand: string;
    subCommandGroup: string;

    allycode: string;
    allycodes: string;
    arena: string;
    channel: GuildChannel;
    enabled: boolean;
    mark: string;
    mins: number;
    new_allycode: string;
    old_allycode: string;
    remove_mark: boolean;
    toggle: boolean;
    view_by: string;

    channelId: string;
    codeCap: number;
}
interface AwChangeRes {
    outLog: string;
    error: string;
    errorKey: string[];
    embed: Embed[];
}

export default class ArenaWatch extends Command {
    static readonly metadata = {
        name: "arenawatch",
        description: "Configurations for ArenaWatch",
        guildOnly: false,
        contexts: [InteractionContextType.Guild, InteractionContextType.BotDM],
        options: [
            {
                name: "allycode",
                type: ApplicationCommandOptionType.SubcommandGroup,
                description: "Any ally codes you want to put in (9 digit numbers, don't need the dashes)",
                options: [
                    {
                        name: "add",
                        description: "Add ally codes in",
                        type: ApplicationCommandOptionType.Subcommand,
                        options: [
                            {
                                name: "allycodes",
                                description: "AllyCodes or allycode:mention, comma seperated",
                                type: ApplicationCommandOptionType.String,
                                required: true,
                            },
                            {
                                name: "mark",
                                type: ApplicationCommandOptionType.String,
                                description: "The emote or symbol to mark them with. Leaving this empty will remove it if available",
                            },
                        ],
                    },
                    {
                        name: "remove",
                        description: "Remove ally codes",
                        type: ApplicationCommandOptionType.Subcommand,
                        options: [
                            {
                                name: "allycodes",
                                description: "AllyCodes, comma seperated",
                                type: ApplicationCommandOptionType.String,
                                required: true,
                            },
                        ],
                    },
                    {
                        name: "edit",
                        type: ApplicationCommandOptionType.Subcommand,
                        description: "Use to change an allycode or mention (Ex: '123123123 123123123:mention')",
                        options: [
                            {
                                name: "old_allycode",
                                type: ApplicationCommandOptionType.String,
                                description: "Ally code of the person you want to modify",
                                required: true,
                            },
                            {
                                name: "new_allycode",
                                type: ApplicationCommandOptionType.String,
                                description: "Different ally code, or allycode:mention to change to (Ex: 123123123:@mention)",
                                required: true,
                            },
                        ],
                    },
                ],
            },
            {
                name: "arena",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Choose between the arena types",
                options: [
                    {
                        name: "enabled",
                        type: ApplicationCommandOptionType.Boolean,
                        description: "Set whether it's enabled or not",
                        required: true,
                    },
                    {
                        name: "arena",
                        type: ApplicationCommandOptionType.String,
                        description: "Choose which arena to toggle",
                        required: true,
                        choices: [
                            {
                                name: "Char",
                                value: "char",
                            },
                            {
                                name: "Fleet",
                                value: "fleet",
                            },
                            {
                                name: "Both",
                                value: "both",
                            },
                            {
                                name: "None",
                                value: "none",
                            },
                        ],
                    },
                ],
            },
            {
                name: "channel",
                type: ApplicationCommandOptionType.Subcommand,
                description: "The channel to put the logs in",
                options: [
                    {
                        name: "target_channel",
                        type: ApplicationCommandOptionType.Channel,
                        required: true,
                        description: "The channel to put the logs in",
                    },
                    {
                        name: "arena",
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        description: "The arena to watch",
                        choices: [
                            {
                                name: "Char",
                                value: "char",
                            },
                            {
                                name: "Fleet",
                                value: "fleet",
                            },
                        ],
                    },
                ],
            },
            {
                name: "enabled",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Enable/ Disable arenawatch",
                options: [
                    {
                        name: "toggle",
                        description: "Enable/ Disable arenawatch",
                        type: ApplicationCommandOptionType.Boolean,
                        required: true,
                    },
                ],
            },
            {
                name: "report",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Choose whether you want it to report on climbs, drops, or both",
                options: [
                    {
                        name: "arena",
                        type: ApplicationCommandOptionType.String,
                        description: "Choose whether you want it to report on climbs, drops, or both",
                        required: true,
                        choices: [
                            { name: "climb", value: "climb" },
                            { name: "drop", value: "drop" },
                            { name: "both", value: "both" },
                        ],
                    },
                ],
            },
            {
                name: "showvs",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Enable or disable showing when one person hits another",
                options: [
                    {
                        name: "enable",
                        description: "True/ False",
                        type: ApplicationCommandOptionType.Boolean,
                        required: true,
                    },
                ],
            },
            {
                name: "warn",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Set when to warn who, and about which arena",
                options: [
                    {
                        name: "allycode",
                        type: ApplicationCommandOptionType.String,
                        description: "The user's ally code",
                        required: true,
                    },
                    {
                        name: "mins",
                        type: ApplicationCommandOptionType.Integer,
                        description: "(0-1439) Minutes before payout to warn (0 to disable)",
                        required: true,
                        minValue: 0,
                        maxValue: 1439,
                    },
                    {
                        name: "arena",
                        type: ApplicationCommandOptionType.String,
                        description: "Set which arena it will watch.",
                        required: true,
                        choices: [
                            {
                                name: "Char",
                                value: "char",
                            },
                            {
                                name: "Fleet",
                                value: "fleet",
                            },
                            {
                                name: "None",
                                value: "none",
                            },
                            {
                                name: "Both",
                                value: "both",
                            },
                        ],
                    },
                ],
            },
            {
                name: "payout",
                type: ApplicationCommandOptionType.SubcommandGroup,
                description: "Set to spit out the payout result of a user",
                options: [
                    {
                        name: "enable",
                        type: ApplicationCommandOptionType.Subcommand,
                        description: "Choose between the arena types",
                        options: [
                            {
                                name: "enabled",
                                type: ApplicationCommandOptionType.Boolean,
                                description: "Set whether it's enabled or not",
                                required: true,
                            },
                            {
                                name: "arena",
                                type: ApplicationCommandOptionType.String,
                                description: "Choose which arena to toggle",
                                required: true,
                                choices: [
                                    {
                                        name: "Char",
                                        value: "char",
                                    },
                                    {
                                        name: "Fleet",
                                        value: "fleet",
                                    },
                                    {
                                        name: "Both",
                                        value: "both",
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        name: "channel",
                        type: ApplicationCommandOptionType.Subcommand,
                        description: "Set an arena's logs to a specified channel",
                        options: [
                            {
                                name: "target_channel",
                                type: ApplicationCommandOptionType.Channel,
                                description: "The channel to send to",
                                required: true,
                            },
                            {
                                name: "arena",
                                type: ApplicationCommandOptionType.String,
                                description: "Set which arena it will log to this channel",
                                required: true,
                                choices: [
                                    {
                                        name: "Char",
                                        value: "char",
                                    },
                                    {
                                        name: "Fleet",
                                        value: "fleet",
                                    },
                                    {
                                        name: "Both",
                                        value: "both",
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        name: "mark",
                        type: ApplicationCommandOptionType.Subcommand,
                        description: "Set a mark for a player",
                        options: [
                            {
                                name: "allycode",
                                type: ApplicationCommandOptionType.String,
                                description: "The ally code of the player to mark",
                                required: true,
                            },
                            {
                                name: "mark",
                                type: ApplicationCommandOptionType.String,
                                required: false,
                                description: "The emote or symbol to mark them with. Leaving this empty will remove it if available",
                            },
                            {
                                name: "remove_mark",
                                type: ApplicationCommandOptionType.Boolean,
                                required: false,
                                description: "Choose this to delete the mark on a selected user",
                            },
                        ],
                    },
                ],
            },
            {
                name: "result",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Set to spit out the payout result of a user",
                options: [
                    {
                        name: "allycode",
                        type: ApplicationCommandOptionType.String,
                        description: "The user's ally code",
                        required: true,
                    },
                    {
                        name: "arena",
                        type: ApplicationCommandOptionType.String,
                        description: "Set which arena it will give the results of.",
                        required: true,
                        choices: [
                            {
                                name: "Char",
                                value: "char",
                            },
                            {
                                name: "Fleet",
                                value: "fleet",
                            },
                            {
                                name: "None",
                                value: "none",
                            },
                            {
                                name: "Both",
                                value: "both",
                            },
                        ],
                    },
                ],
            },
            {
                name: "use_marks_in_log",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Toggle showing players' marks in the arena log",
                options: [
                    {
                        name: "enable",
                        type: ApplicationCommandOptionType.Boolean,
                        required: true,
                        description: "Show marks in arena log?",
                    },
                ],
            },
            {
                name: "view",
                type: ApplicationCommandOptionType.Subcommand,
                description: "View your arenaWatch settings",
                options: [
                    {
                        name: "allycode",
                        type: ApplicationCommandOptionType.String,
                        description: "An allycode to check the specific settings for",
                    },
                    {
                        name: "view_by",
                        type: ApplicationCommandOptionType.String,
                        description: "View the list sorted by char or fleet ranks",
                        choices: [
                            {
                                name: "Fleet Rank",
                                value: "fleet_rank",
                            },
                            {
                                name: "Char Rank",
                                value: "char_rank",
                            },
                        ],
                    },
                ],
            },
        ],
    };

    constructor() {
        super(ArenaWatch.metadata);
    }

    async run({ interaction, language, permLevel }: CommandContext) {
        const subCommand = interaction.options.getSubcommand();
        const subCommandGroup = interaction.options.getSubcommandGroup();
        const target = subCommandGroup || subCommand;

        // Need to make sure that the user has the correct permissions to set this up
        if (permLevel < constants.permMap.GUILD_ADMIN) {
            return super.error(interaction, language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
        }

        const user: UserConfig = await userReg.getUser(interaction.user.id);
        if (!user) return super.error(interaction, "Sorry, but something went wrong and I couldn't find your data. Please try again.");

        const pat = await patreonFuncs.getPatronUser(interaction.user.id);
        if (!pat || pat.amount_cents < 100) {
            return super.error(interaction, language.get("COMMAND_ARENAALERT_PATREON_ONLY"));
        }

        const codeCap = pat?.awAccounts || 1;

        // A bunch of checking to make sure everything exists properly
        const aw = fillAWSkeleton(user?.arenaWatch);

        const channelIn = interaction.options.getChannel("target_channel") as GuildChannel;
        const interactionOptions: InteractionOptions = {
            // What we need to do
            subCommand: interaction.options.getSubcommand(),
            subCommandGroup: interaction.options.getSubcommandGroup(),

            // The settings to change
            allycode: interaction.options.getString("allycode"), // When they can only reference one at a time
            allycodes: interaction.options.getString("allycodes"), // When they're able to enter multiple ally codes
            arena: interaction.options.getString("arena"),
            channel: channelIn,
            enabled: interaction.options.getBoolean("enabled"),
            mark: interaction.options.getString("mark"),
            mins: interaction.options.getInteger("mins"),
            new_allycode: interaction.options.getString("new_allycode"),
            old_allycode: interaction.options.getString("old_allycode"),
            remove_mark: interaction.options.getBoolean("remove_mark"),
            toggle: interaction.options.getBoolean("toggle"),
            view_by: interaction.options.getString("view_by"),

            // Processed bits
            channelId: getChannelIdIfValid(interaction, channelIn),
            codeCap,
        };

        await interaction.deferReply();

        const { result, aw: awRes } = await processAWChanges({ target, interactionOptions, aw, unitStats: swgohAPI.unitStats });

        if (result.error) {
            await super.error(interaction, result.error);
            return;
        }
        if (result.errorKey) {
            const [key, ...args] = result.errorKey;
            await super.error(interaction, language.get(key, ...args));
            return;
        }

        // Update the user's data since if it gets here, it would be changed
        user.arenaWatch = awRes;
        await userReg.updateUser(interaction.user.id, user);

        if (result.embed) {
            await interaction.editReply({
                content: null,
                embeds: [result.embed] as never,
            });
            return;
        }

        return super.error(interaction, result.outLog, { title: " ", color: constants.colors.blue });
    }
}

export async function processAWChanges({
    target,
    interactionOptions,
    aw,
    unitStats,
}: {
    target: string;
    interactionOptions: InteractionOptions;
    aw: UserConfig["arenaWatch"];
    // biome-ignore lint/complexity/noBannedTypes: "swgohAPI.unitStats"
    unitStats: Function;
}): Promise<{ result: AwChangeRes; aw: UserConfig["arenaWatch"] }> {
    const result = {
        outLog: "", // Normal progress, just results of changing values
        embed: null, // Premade embed for the view
        error: null, // Send back an error (to be lang'd eventually)
        errorKey: null, // Send back the lang key if available
    };

    switch (target) {
        // ArenaWatch -> activate/ deactivate
        case "enabled": {
            const isEnabled = interactionOptions.toggle;
            aw.enabled = isEnabled;
            result.outLog = `ArenaWatch is now ${isEnabled ? "enabled" : "disabled"}.`;
            break;
        }
        case "channel": {
            // This needs to make sure the person has an adminrole or something so they cannot just spam a chat with it
            const targetArena = interactionOptions.arena;
            if (!interactionOptions.channelId) {
                result.error = "Invalid channel, please make sure you're choosing a text channel in this server.";
                break;
            }

            // They got throught all that, go ahead and set it
            aw.arena.char.channel = ["both", "char"].includes(targetArena) ? interactionOptions.channelId : null;
            aw.arena.fleet.channel = ["both", "fleet"].includes(targetArena) ? interactionOptions.channelId : null;
            result.outLog = `ArenaWatch channel for ${targetArena === "both" ? "both arenas" : targetArena} has been set to <#${interactionOptions.channelId}>.`;
            break;
        }
        case "payout": {
            // ;aw payout enable char | fleet | both    (Toggles per arena)
            // ;aw payout channel #channelName char     (Sets it to a channel)
            // ;aw payout mark <allycode>   (Sets it to mark a player with an emote)
            const targetArena = interactionOptions.arena;

            // Get the which part of the payout we're working with
            const setting = interactionOptions.subCommand;
            if (setting === "enable") {
                // Grab which arena to set it to
                const enabled = interactionOptions.enabled;

                // If it's one of the correct options
                aw.payout.char.enabled = ["char", "both"].includes(targetArena) ? enabled : false;
                aw.payout.fleet.enabled = ["fleet", "both"].includes(targetArena) ? enabled : false;
                result.outLog = `ArenaWatch payout for ${targetArena === "both" ? "both arenas" : targetArena} has been ${enabled ? "enabled" : "disabled"}.`;
            } else if (setting === "channel") {
                // Set the channel for one of the options (Char/ fleet)
                if (!interactionOptions.channelId) {
                    result.error = "Invalid channel, please make sure you're choosing a text channel in this server.";
                    break;
                }

                // They got throught all that, go ahead and set it
                aw.payout.char.channel = ["char", "both"].includes(targetArena) ? interactionOptions.channelId : null;
                aw.payout.fleet.channel = ["fleet", "both"].includes(targetArena) ? interactionOptions.channelId : null;
                result.outLog = `ArenaWatch payout channel for ${targetArena === "both" ? "both arenas" : targetArena} has been set to <#${interactionOptions.channelId}>.`;
                break;
            } else if (setting === "mark") {
                // Setting the mark/ emote/ symbol/ whatver to help show people as friendly/ enemy
                // ;aw payout mark 123123123 :smile:
                const ac = interactionOptions.allycode;
                const mark = interactionOptions.mark;
                const remove_mark = interactionOptions.remove_mark;

                if (!mark && !remove_mark) {
                    result.error = "You MUST choose either a mark, or to remove a mark";
                    break;
                }
                if (mark && remove_mark) {
                    result.error = "You MUST choose only one of: mark, remove_mark";
                    break;
                }

                const player = aw.allycodes.find((p) => p.allyCode.toString() === ac.toString());
                if (!player) {
                    result.error = "Sorry, but you can only apply a mark to an already present player/ allycode";
                    break;
                }
                if (remove_mark && !player?.mark?.length) {
                    result.error = "There's no mark to remove.";
                    break;
                }

                // If they're trying to use a custom emote, make sure it's available for the bot to use
                const emojiRegex = /(:[^:\s]+:|<:[^:\s]+:[0-9]+>|<a:[^:\s]+:[0-9]+>)/g;
                let cmdOut = null;
                if (emojiRegex.test(mark)) {
                    cmdOut =
                        "If you are using an external emote from outside this server, it will not work if this bot does not also have access to the server that it's from";
                }
                const resArr = [];
                aw.allycodes = aw.allycodes.map((p) => {
                    if (p.allyCode.toString() === ac.toString()) {
                        p.mark = remove_mark ? null : mark;
                    }
                    resArr.push(`${p.allyCode}: '${p.mark ? `: ${p.mark}` : ""}'`);
                    return p;
                });
                result.outLog = `Updated the following marks: \n- ${resArr.join("\n- ")}${cmdOut ? `\n\n${cmdOut}` : ""}`;
            }
            break;
        }
        case "arena": {
            const enabled = interactionOptions.enabled;
            const arena = interactionOptions.arena;

            aw.arena.char.enabled = ["char", "both"].includes(arena) ? enabled : false;
            aw.arena.fleet.enabled = ["fleet", "both"].includes(arena) ? enabled : false;

            result.outLog = `ArenaWatch for ${arena === "both" ? "both arenas" : arena} has been ${enabled ? "enabled" : "disabled"}.`;
            break;
        }
        case "allycode": {
            // Add/ remove
            const action = interactionOptions.subCommand;
            const outLog = [];

            // Logic for add/ remove
            if (action === "add") {
                // List of ally codes to add or remove
                const codesIn = interactionOptions.allycodes
                    .split(",") // Split em at the commas if there are more than one
                    .map((a) => a?.trim()) // Trim off any spaces in case
                    .filter(Boolean);

                if (!codesIn.length) {
                    result.errorKey = ["COMMAND_ARENAWATCH_MISSING_AC", action];
                    break;
                }

                // The mark to put with the ally code (Optional)
                const mark = interactionOptions.mark || "";
                const emojiRegex = /(:[^:\s]+:|<:[^:\s]+:[0-9]+>|<a:[^:\s]+:[0-9]+>)/g;
                if (emojiRegex.test(mark)) {
                    outLog.push(
                        "If you are using an external emote from outside this server, it will not work if this bot does not also have access to the server that it's from",
                    );
                }

                const codes = [];
                for (const code of codesIn) {
                    let ac: number;
                    let mention: string;
                    try {
                        [ac, mention] = getAcMention(code);
                        if (!isAllyCode(ac)) {
                            outLog.push(`${ac} is not a valid allycode.`);
                            continue;
                        }
                    } catch (e) {
                        outLog.push(e);
                        continue;
                    }

                    codes.push({
                        code: ac,
                        mention: mention,
                    });
                }

                if (!codes.length) {
                    result.error = "There were no valid ally codes entered.";
                    break;
                }

                // There are more than one valid code, try adding them all
                const players = await unitStats(codes.map((c) => c.code));
                if (!players?.length) {
                    result.error =
                        "Sorry, but it looks like none of the ally code(s) you entered were found with rosters. If you're sure the code(s) were correct, please wait a bit and try again.";
                    break;
                }
                for (const c of codes) {
                    let player: SWAPIPlayer;
                    try {
                        player = checkPlayer(aw, players, c, interactionOptions.codeCap);
                    } catch (e) {
                        outLog.push(e);
                        continue;
                    }

                    aw.allycodes.push({
                        allyCode: c.code,
                        name: player.name,
                        mention: c.mention,
                        lastChar: player.arena.char?.rank || null,
                        lastShip: player.arena.ship?.rank || null,
                        poOffset: player.poUTCOffsetMinutes,
                        mark: mark || null,
                    });
                    outLog.push(`${c.code} added!`);
                }
                result.outLog = outLog.join("\n");
            } else if (action === "edit") {
                // Used to add or remove a mention
                const oldCode = interactionOptions.old_allycode;
                const newCode = interactionOptions.new_allycode;

                if (!isAllyCode(oldCode)) {
                    result.error = `${oldCode} is not a valid ally code.`;
                    break;
                }
                if (!isAllyCode(newCode)) {
                    result.error = `${newCode} is not a valid ally code.`;
                    break;
                }

                let ac: number;
                let mention: string;
                try {
                    [ac, mention] = getAcMention(newCode);
                } catch (e) {
                    outLog.push(e);
                }

                // Check if the specified code is available to edit
                // If not, just add it in fresh
                // If so, delte it then add it back
                const exists = aw.allycodes.find((p) => p.allyCode === Number.parseInt(oldCode, 10));
                if (!exists) {
                    result.error = `${oldCode} is not in the list.`;
                    break;
                }
                aw.allycodes = aw.allycodes.filter((p) => p.allyCode !== Number.parseInt(oldCode, 10));

                let player = null;
                try {
                    const players = await unitStats(ac);
                    if (!players?.length) logger.error(`[AW Edit] Missing players ${ac}`);
                    player = checkPlayer(aw, players, { code: ac }, interactionOptions.codeCap, true);
                    if (!player) logger.error(`[AW Edit] Missing player after check ${ac}`);
                } catch (e) {
                    result.error = `Error getting player info.\n${e}`;
                    break;
                }
                aw.allycodes.push({
                    allyCode: ac,
                    name: player.name,
                    mention: mention,
                    lastChar: player.arena.char ? player.arena.char.rank : null,
                    lastShip: player.arena.ship ? player.arena.ship.rank : null,
                    poOffset: player.poUTCOffsetMinutes,
                });
                outLog.push(`${ac} ${exists ? "updated" : "added"}!`);
                result.outLog = outLog.join("\n");
            } else if (["remove", "delete"].includes(action)) {
                // List of ally codes to add or remove
                const codesIn = interactionOptions.allycodes
                    .split(",") // Split em at the commas if there are more than one
                    .map((a) => a?.trim()) // Trim off any spaces in case
                    .filter((a) => isAllyCode(a));

                // Some checks before getting to the logic
                if (!codesIn.length) {
                    result.errorKey = ["COMMAND_ARENAWATCH_MISSING_AC", action];
                    break;
                }

                for (const code of codesIn) {
                    const thisCode = Number.parseInt(code.replace(/[^\d]/g, ""), 10);
                    const exists = aw.allycodes.find((ac) => ac.allyCode === thisCode);
                    if (!exists) {
                        result.error = "That ally code was not available to be removed";
                        break;
                    }
                    const codes = aw.allycodes.filter((ac) => ac.allyCode !== thisCode);

                    aw.allycodes = codes;
                    outLog.push(`${code} has been removed`);
                }
                result.outLog = outLog.join("\n");
            }
            break;
        }
        case "report": {
            const arena = interactionOptions.arena;
            if (aw.report === arena.toLowerCase()) {
                result.outLog = `Your report setting was already set to ${arena}`;
                break;
            }
            aw.report = arena.toLowerCase();
            result.outLog = `Your report setting has been set to ${arena}`;
            break;
        }
        case "showvs": {
            // Enable or disable showing when one person hits another
            const isEnabled = interactionOptions.enabled;
            if (isEnabled === aw.showvs) {
                result.outLog = `Your showvs setting was already set to ${isEnabled.toString()}`;
                break;
            }
            aw.showvs = isEnabled;
            result.outLog = `The log will ${aw.showvs ? "now" : "not"} show when someone hits someone else.`;
            break;
        }
        case "warn": {
            // ;aw warn 123123123 <# of min> <none|both|char|fleet>
            const code = interactionOptions.allycode;
            const mins = interactionOptions.mins;
            const arena = interactionOptions.arena;

            if (!isAllyCode(code)) {
                result.error = `Invalid ally code (${code})`;
                break;
            }

            const exists = aw.allycodes.find((p) => p.allyCode === Number.parseInt(code, 10));
            if (!exists) {
                result.error = "That ally code is not in your list.";
                break;
            }

            aw.allycodes = aw.allycodes.filter((p) => p.allyCode !== Number.parseInt(code, 10));

            if (typeof exists.allyCode === "string") exists.allyCode = Number.parseInt(exists.allyCode, 10);
            exists.warn = {
                min: mins && mins > 0 ? mins : null,
                arena: arena === "none" ? null : arena,
            };
            aw.allycodes.push(exists);

            result.outLog = `Your warn setting for ${code} has been updated to ${mins} minute${mins !== 1 ? "s" : ""} in ${arena === "none" ? "no" : arena} arena.`;
            break;
        }
        case "result": {
            // ;aw result 123123123 <none|char|fleet|both>
            const code = interactionOptions.allycode;
            const arena = interactionOptions.arena;

            if (!isAllyCode(code)) {
                result.error = `Invalid ally code (${code})`;
                break;
            }

            const exists = aw.allycodes.find((p) => p.allyCode === Number.parseInt(code, 10));
            if (!exists) {
                result.error = "That ally code is not in your list.";
                break;
            }

            // Take that user out of the list
            aw.allycodes = aw.allycodes.filter((p) => p.allyCode !== Number.parseInt(code, 10));

            // Update the user
            exists.result = arena === "none" ? null : arena;

            // Put the user back in
            aw.allycodes.push(exists);
            result.outLog = `Your result setting for ${code} has been updated to ${arena === "none" ? "no" : arena} arena.`;
            break;
        }
        case "use_marks_in_log": {
            const useMarksInLog = interactionOptions.enabled;
            if (aw.useMarksInLog === useMarksInLog) {
                result.error = `UseMarksInLog is already set to ${aw.useMarksInLog.toString()}`;
                break;
            }
            aw.useMarksInLog = useMarksInLog;
            result.outLog = `UseMarksInLog has been set to ${aw.useMarksInLog.toString()}`;
            break;
        }
        case "view": {
            // Show the current settings for this (Also maybe in ;uc, but a summarized version?)
            const allycode = interactionOptions.allycode;
            const view_by = interactionOptions.view_by;

            const { error, embedOut } = await formatForViewing(aw, allycode, view_by, interactionOptions.codeCap);
            if (error) {
                result.error = error;
                break;
            }
            if (embedOut) {
                result.embed = embedOut;
                break;
            }
            result.error = "Something broke, please try again in a bit, or report it.";
            break;
        }
        default:
            // This should never happen, but just in case
            result.errorKey = ["COMMAND_ARENAWATCH_INVALID_OPTION"];
            break;
    }
    return { result, aw };
}

const defPayout = {
    char: {
        enabled: false,
        channel: null,
        msgID: null,
    },
    fleet: {
        enabled: false,
        channel: null,
        msgID: null,
    },
};
const defAW = {
    enabled: false,
    allycodes: [],
    channel: null,
    arena: {
        fleet: {
            channel: null,
            enabled: false,
        },
        char: {
            channel: null,
            enabled: false,
        },
    },
    payout: defPayout,
    useMarksInLog: false,
    report: "both", // This can be climb, drop, or both
    showvs: true, // Show both sides of a battle between monitored players
};

export function fillAWSkeleton(awIn: UserConfig["arenaWatch"] | null): UserConfig["arenaWatch"] {
    const aw = awIn || defAW;
    const thisChan = aw.channel || null;

    if (!aw.payout) aw.payout = defPayout;
    aw.useMarksInLog ??= false;
    aw.report ??= "both";
    if (aw.showvs !== true && aw.showvs !== false) aw.showvs = true;
    if (thisChan && (!aw.arena.fleet || !aw.arena.char)) {
        const flEnabled = !!["fleet", "both"].includes(aw.report);
        const chEnabled = !!["char", "both"].includes(aw.report);
        aw.arena = {
            fleet: {
                channel: thisChan,
                enabled: flEnabled,
            },
            char: {
                channel: thisChan,
                enabled: chEnabled,
            },
        };
    }
    return aw;
}

function getChannelStr(aw: UserConfig["arenaWatch"], alertType: string, arenaType: string) {
    if (!["arena", "payout"].includes(alertType)) {
        logger.error("Invalid alertType");
        return null;
    }
    if (!["char", "fleet"].includes(arenaType)) {
        logger.error("Invalid arenaType");
        return null;
    }
    const thisAW = aw?.[alertType]?.[arenaType];
    return thisAW.channel ? `<#${thisAW.channel}>` : "N/A";
}

function getAcMention(code: string): [number, string] {
    let [ac, mention] = code.split(":");
    if (!isAllyCode(ac)) throw new Error(`Invalid code (${ac})!`);
    ac = ac.replace(/[^\d]/g, "");

    mention = isUserMention(mention?.trim() || "") ? mention.replace(/[^\d]/g, "") : null;
    return [Number.parseInt(ac, 10), mention];
}

function checkPlayer(
    aw: UserConfig["arenaWatch"],
    players: SWAPIPlayer[],
    code: { code: number; mention?: string },
    codeCap = 1,
    isEdit = false,
) {
    if (!players) throw new Error("Missing players in checkPlayer");
    const player = players.find((p) => p.allyCode === code.code);
    if (!player) {
        throw new Error(`Could not find ${code.code}, invalid code`);
    }
    if (aw.allycodes.find((usercode) => usercode.allyCode === code.code)) {
        throw new Error(
            `${code.code} was already in the list. If you're trying to change something, try using the \`/arenawatch allycode edit\` command`,
        );
    }
    if (!isEdit && aw.allycodes.length >= codeCap) {
        throw new Error(`Could not add ${code.code}, ally code cap reached!`);
    }
    return player;
}

// Takes in a channel from the interaction.options.getChannel, but always whines about it
function getChannelIdIfValid(interaction: ChatInputCommandInteraction, channel: GuildChannel): string | null {
    if (!channel) return null;
    if (!("guild" in channel)) return null;
    if (channel?.type !== ChannelType.GuildText) return null;
    if (channel?.guild?.id !== interaction?.guild?.id) return null;
    return channel.id;
}

async function formatForViewing(aw: UserConfig["arenaWatch"], allycode: string, view_by: string | null, codeCap: number) {
    const result = {
        error: null,
        embedOut: null,
    };
    if (!allycode) {
        // If there's any ally codes in the array, go ahead and format them
        const ac = aw.allycodes.length ? aw.allycodes : [];
        const acOut = ac
            // Sort by name
            .sort((a, b) => {
                if (!view_by) {
                    return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
                }
                if (view_by === "char_rank") {
                    return a.lastChar > b.lastChar ? 1 : -1;
                }
                if (view_by === "fleet_rank") {
                    return a.lastShip > b.lastShip ? 1 : -1;
                }
                return 0;
            })
            // Then format the output strings
            .map((a) => {
                if (view_by) {
                    return `\`${((view_by === "char_rank" ? a.lastChar : a.lastShip) || "N/A").toString().padStart(3)}\`  |  ${
                        a.mark ? `${a.mark} ` : ""
                    }**${a.mention ? `<@${a.mention}>` : a.name}**`;
                }
                const isWarn = a?.warn?.min && a.warn?.arena ? "W" : "";
                const isRes = a.result ? "R" : "";
                const tags = isWarn.length || isRes.length ? `\`[${isWarn}${isRes}]\`` : "";
                return `\`${a.allyCode}\` ${tags} ${a.mark ? `${a.mark} ` : ""}**${a.mention ? `<@${a.mention}>` : a.name}**`;
            });

        const fields = [];
        // Chunk the codes down so they'll fit within the 1024 character limit of a field value
        const acChunks = msgArray(acOut, "\n", 1000);
        for (const [ix, chunk] of acChunks.entries()) {
            fields.push({
                name: ix > 0 ? "-" : `Members (${aw.allycodes.length}/${codeCap}):`,
                value: chunk,
            });
        }

        const charPayoutChan = getChannelStr(aw, "payout", "char");
        const fleetPayoutChan = getChannelStr(aw, "payout", "fleet");
        fields.push({
            name: "**Payout Settings**",
            value: [
                `Char:     **${aw.payout.char.enabled && aw.payout.char.channel ? "ON " : "OFF"}**  -  ${charPayoutChan}`,
                `Ship:     **${aw.payout.fleet.enabled && aw.payout.fleet.channel ? "ON " : "OFF"}**  -  ${fleetPayoutChan}`,
            ].join("\n"),
        });

        const charChan = getChannelStr(aw, "arena", "char");
        const fleetChan = getChannelStr(aw, "arena", "fleet");
        result.embedOut = {
            title: "Arena Watch Settings",
            description: [
                `Enabled:  **${aw.enabled ? "ON" : "OFF"}**`,
                `Char:     **${aw.arena.char.enabled && aw.arena.char.channel ? "ON " : "OFF"}**  -  ${charChan}`,
                `Ship:     **${aw.arena.fleet.enabled && aw.arena.fleet.channel ? "ON " : "OFF"}**  -  ${fleetChan}`,
            ].join("\n"),
            fields: fields,
        };
        return result;
    }
    if (!isAllyCode(allycode)) {
        result.error = `${allycode} is not a valid ally code.`;
        return result;
    }
    if (!aw.allycodes.filter((a) => a.allyCode === Number.parseInt(allycode, 10)).length) {
        result.error = `${allycode} is not listed in your registered ally codes.`;
        return result;
    }

    const player = aw.allycodes.find((p) => p.allyCode === Number.parseInt(allycode, 10));
    result.embedOut = {
        title: `Arena Watch Settings (${allycode})`,
        description: [
            `Name: **${player.name}**`,
            `Mention: **${player.mention ? `<@${player.mention}>` : "N/A"}**`,
            `Payout Result: **${player.result ? player.result : "N/A"}**`,
            `Warn Mins: **${player.warn ? player.warn.min : "N/A"}**`,
            `Warn Arena: **${player.warn ? player.warn.arena : "N/A"}**`,
        ].join("\n"),
    };
    return result;
}
