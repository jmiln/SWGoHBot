import SlashCommand from "../base/slashCommand";
import Discord, { TextChannel } from "discord.js";
import { AWPlayer, BotInteraction, BotType, CommandOptions, PlayerStatsAccount } from "../modules/types";
// const {inspect} = require("util");

class ArenaWatch extends SlashCommand {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "arenawatch",
            category: "Patreon",
            permissions: ["EMBED_LINKS"],
            guildOnly: false,
            options: [
                {
                    name: "allycode",
                    type: Bot.constants.optionType.SUB_COMMAND_GROUP,
                    description: "Any ally codes you want to put in (9 digit numbers, don't need the dashes)",
                    options: [
                        {
                            name: "add",
                            description: "Add ally codes in",
                            type: Bot.constants.optionType.SUB_COMMAND,
                            options: [
                                {
                                    name: "allycodes",
                                    description: "AllyCodes or allycode:mention, comma seperated",
                                    type: Bot.constants.optionType.STRING,
                                    required: true
                                },
                                {
                                    name: "mark",
                                    type: Bot.constants.optionType.STRING,
                                    description: "The emote or symbol to mark them with. Leaving this empty will remove it if available"
                                }
                            ]
                        },
                        {
                            name: "remove",
                            description: "Add ally codes in",
                            type: Bot.constants.optionType.SUB_COMMAND,
                            options: [
                                {
                                    name: "allycodes",
                                    description: "AllyCodes, comma seperated",
                                    type: Bot.constants.optionType.STRING,
                                    required: true
                                }
                            ]
                        },
                        {
                            name: "edit",
                            type: Bot.constants.optionType.SUB_COMMAND,
                            description: "Use to change an allycode or mention (Ex: '123123123 123123123:mention')",
                            options: [
                                {
                                    name: "old_allycode",
                                    type: Bot.constants.optionType.STRING,
                                    description: "Ally code of the person you want to modify",
                                    required: true
                                },
                                {
                                    name: "new_allycode",
                                    type: Bot.constants.optionType.STRING,
                                    description: "Different ally code, or allycode:mention to change to (Ex: 123123123:@mention)",
                                    required: true
                                }
                            ]
                        },
                    ]
                },
                {
                    name: "arena",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Choose between the arena types",
                    options: [
                        {
                            name: "enabled",
                            type: Bot.constants.optionType.BOOLEAN,
                            description: "Set whether it's enabled or not",
                            required: true,
                        },
                        {
                            name: "arena",
                            type: Bot.constants.optionType.STRING,
                            description: "Choose which arena to toggle",
                            required: true,
                            choices: [
                                {
                                    name: "Char",
                                    value: "char"
                                },
                                {
                                    name: "Fleet",
                                    value: "fleet"
                                },
                                {
                                    name: "Both",
                                    value: "both"
                                },
                                {
                                    name: "None",
                                    value: "none"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "channel",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "The channel to put the logs in",
                    options: [
                        {
                            name: "channel",
                            type: Bot.constants.optionType.CHANNEL,
                            required: true,
                            description: "The channel to put the logs in"
                        },
                        {
                            name: "arena",
                            type: Bot.constants.optionType.STRING,
                            required: true,
                            description: "The arena to watch",
                            choices: [
                                {
                                    name: "Char",
                                    value: "char"
                                },
                                {
                                    name: "Fleet",
                                    value: "fleet"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "enabled",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Enable/ Disable arenawatch",
                    options: [{
                        name: "toggle",
                        description: "Enable/ Disable arenawatch",
                        type: Bot.constants.optionType.BOOLEAN,
                        required: true
                    }]
                },
                {
                    name: "report",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Choose whether you want it to report on climbs, drops, or both",
                    options: [{
                        name: "arena",
                        type: Bot.constants.optionType.STRING,
                        description: "Choose whether you want it to report on climbs, drops, or both",
                        required: true,
                        choices: [
                            {name: "climb", value: "climb"},
                            {name: "drop", value: "drop"},
                            {name: "both", value: "both"}
                        ]
                    }]
                },
                {
                    name: "showvs",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Enable or disable showing when one person hits another",
                    options: [
                        {
                            name: "enable",
                            description: "True/ False",
                            type: Bot.constants.optionType.BOOLEAN,
                            required: true

                        }
                    ]
                },
                {
                    name: "warn",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Set when to warn who, and about which arena",
                    options: [
                        {
                            name: "allycode",
                            type: Bot.constants.optionType.INTEGER,
                            description: "The user's ally code",
                            required: true
                        },
                        {
                            name: "mins",
                            type: Bot.constants.optionType.INTEGER,
                            description: "(1-1439) The number of minutes before their payout to warn them",
                            required: true,
                            min_value: 0,
                            max_value: 1439,
                        },
                        {
                            name: "arena",
                            type: Bot.constants.optionType.STRING,
                            description: "Set which arena it will watch.",
                            required: true,
                            choices: [
                                {
                                    name: "Char",
                                    value: "char"
                                },
                                {
                                    name: "Fleet",
                                    value: "fleet"
                                },
                                {
                                    name: "None",
                                    value: "none"
                                },
                                {
                                    name: "Both",
                                    value: "both"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "payout",
                    type: Bot.constants.optionType.SUB_COMMAND_GROUP,
                    description: "Set to spit out the payout result of a user",
                    options: [
                        {
                            name: "enable",
                            type: Bot.constants.optionType.SUB_COMMAND,
                            description: "Choose between the arena types",
                            options: [
                                {
                                    name: "enabled",
                                    type: Bot.constants.optionType.BOOLEAN,
                                    description: "Set whether it's enabled or not",
                                    required: true,
                                },
                                {
                                    name: "arena",
                                    type: Bot.constants.optionType.STRING,
                                    description: "Choose which arena to toggle",
                                    required: true,
                                    choices: [
                                        {
                                            name: "Char",
                                            value: "char"
                                        },
                                        {
                                            name: "Fleet",
                                            value: "fleet"
                                        },
                                        {
                                            name: "Both",
                                            value: "both"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            name: "channel",
                            type: Bot.constants.optionType.SUB_COMMAND,
                            description: "Set an arena's logs to a specified channel",
                            options: [
                                {
                                    name: "target_channel",
                                    type: Bot.constants.optionType.CHANNEL,
                                    description: "The channel to send to",
                                    required: true
                                },
                                {

                                    name: "arena",
                                    type: Bot.constants.optionType.STRING,
                                    description: "Set which arena it will log to this channel",
                                    required: true,
                                    choices: [
                                        {
                                            name: "Char",
                                            value: "char"
                                        },
                                        {
                                            name: "Fleet",
                                            value: "fleet"
                                        },
                                        {
                                            name: "Both",
                                            value: "both"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            name: "mark",
                            type: Bot.constants.optionType.SUB_COMMAND,
                            description: "Set a mark for a player",
                            options: [
                                {
                                    name: "allycode",
                                    type: Bot.constants.optionType.INTEGER,
                                    description: "The ally code of the player to mark",
                                    required: true
                                },
                                {
                                    name: "mark",
                                    type: Bot.constants.optionType.STRING,
                                    required: true,
                                    description: "The emote or symbol to mark them with. Leaving this empty will remove it if available"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "result",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Set to spit out the payout result of a user",
                    options: [
                        {
                            name: "allycode",
                            type: Bot.constants.optionType.INTEGER,
                            description: "The user's ally code",
                            required: true
                        },
                        {
                            name: "arena",
                            type: Bot.constants.optionType.STRING,
                            description: "Set which arena it will give the results of.",
                            required: true,
                            choices: [
                                {
                                    name: "Char",
                                    value: "char"
                                },
                                {
                                    name: "Fleet",
                                    value: "fleet"
                                },
                                {
                                    name: "None",
                                    value: "none"
                                },
                                {
                                    name: "Both",
                                    value: "both"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "use_marks_in_log",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "Toggle showing players' marks in the arena log",
                    options: [
                        {
                            name: "enable",
                            type: Bot.constants.optionType.BOOLEAN,
                            required: true,
                            description: "Show marks in arena log?",
                        }
                    ]
                },
                {
                    name: "view",
                    type: Bot.constants.optionType.SUB_COMMAND,
                    description: "View your arenaWatch settings",
                    options: [
                        {
                            name: "allycode",
                            type: Bot.constants.optionType.INTEGER,
                            description: "An allycode to check the specific settings for"
                        }
                    ]
                }
            ]
        });
    }

    async run(Bot: BotType, interaction: BotInteraction, options?: CommandOptions) {
        const target = interaction.options.getSubcommandGroup(false) || interaction.options.getSubcommand();
        let cmdOut = null;

        const outLog = [];

        const userID = interaction.user.id;

        const user = await Bot.userReg.getUser(userID);
        if (!user) {
            return super.error(interaction, "Sorry, but something went wrong and I couldn't find your data. Please try again.");
        }
        let aw = user.arenaWatch;
        const defPayout = {
            char: {
                enabled: false,
                channel: null,
                msgID: null
            },
            fleet: {
                enabled: false,
                channel: null,
                msgID: null
            }
        };
        if (!aw) {
            aw = {
                enabled: false,
                useMarksInLog: false,
                report: "both",     // This can be climb, drop, or both
                showvs: true,       // Show both sides of a battle between monitored players
                arena: {
                    fleet: {
                        channel: null,
                        enabled: false
                    },
                    char: {
                        channel: null,
                        enabled: false
                    }
                },
                payout: defPayout,
                allycodes: []
            };
        }
        if (!aw.payout) aw.payout = defPayout;
        if (!aw.useMarksInLog) aw.useMarksInLog = false;
        if (!aw.report) aw.report = "both";
        if (!aw.showvs) aw.showvs = true;
        if (aw.channel && (!aw.arena.fleet || !aw.arena.char)) {
            const flEnabled = ["fleet", "both"].includes(aw.arena) ? true : false;
            const chEnabled = ["char", "both"].includes(aw.arena) ? true : false;
            aw.arena = {};
            aw.arena.fleet = {
                channel: aw.channel,
                enabled: flEnabled
            };
            aw.arena.char  = {
                channel: aw.channel,
                enabled: chEnabled
            };
        }

        // ArenaWatch -> activate/ deactivate
        const pat = await Bot.getPatronUser(interaction.user.id);
        if (!pat || pat.amount_cents < 100) {
            return super.error(interaction, interaction.language.get("COMMAND_ARENAALERT_PATREON_ONLY"));
        }

        let codeCap = 0;
        if (pat.amount_cents < 500  ) {
            codeCap = Bot.config.arenaWatchConfig.tier1;
        } else if (pat.amount_cents < 1000 ) {
            codeCap = Bot.config.arenaWatchConfig.tier2;
        } else if (pat.amount_cents >= 1000) {
            codeCap = Bot.config.arenaWatchConfig.tier3;
        }

        function getAcMention(code: string): [number, string] {
            let [ac, mention] = code.split(":");
            if (!Bot.isAllyCode(ac)) throw new Error(`Invalid code (${ac})!`);
            ac = ac.replace(/[^\d]/g, "");

            mention = Bot.isUserMention(mention || "") ? mention.replace(/[^\d]/g, "") : null;
            return [parseInt(ac, 10), mention];
        }

        function checkPlayer(players: PlayerStatsAccount[], code: {code: number}) {
            if (!players?.length) throw new Error("Missing players in checkPlayer");
            const player = players.find(p => p.allyCode === code.code);
            if (!player) {
                throw new Error(`Could not find ${code.code}, invalid code`);
            }
            if (aw.allycodes.find((user: AWPlayer) => user.allyCode === code.code)) {
                throw new Error(`${code.code} was already in the list. If you're trying to change something, try using the \`/aw allycode edit\` command`);
            }
            if (aw.allycodes.length >= codeCap) {
                throw new Error(`Could not add ${code.code}, ally code cap reached!`);
            }
            return player;
        }

        switch (target) {
            case "enabled": {
                const isEnabled = interaction.options.getBoolean("enabled");
                aw.enabled = isEnabled;
                break;
            }
            case "channel": {
                // This needs to make sure the person has an adminrole or something so they cannot just spam a chat with it
                const channel = interaction.options.getChannel("target_channel") as TextChannel;
                const targetArena = interaction.options.getString("arena");

                if (channel.guild.id !== interaction.guild.id) {
                    // They chose a channel in a different server
                    return super.error(interaction, "Invalid channel, please choose one in this server");
                }

                // If it gets this far, it should be a valid code
                // Need to make sure that the user has the correct permissions to set this up
                if (options.level < Bot.constants.permMap.GUILD_ADMIN) {
                    return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                }

                // They got throught all that, go ahead and set it
                switch (targetArena) {
                    case "both": {
                        // Set the channel for both the char and fleet arenas
                        aw.arena.char.channel  = channel;
                        aw.arena.fleet.channel = channel;
                        break;
                    }
                    case "char": {
                        // Set just the char arena channel
                        aw.arena.char.channel  = channel;
                        break;
                    }
                    case "fleet": {
                        // Set just the fleet arena channel
                        aw.arena.fleet.channel  = channel;
                        break;
                    }
                }
                break;
            }
            case "payout": {
                // ;aw payout enable char | fleet | both    (Toggles per arena)
                // ;aw payout channel #channelName char     (Sets it to a channel)
                // ;aw payout mark <allycode>   (Sets it to mark a player with an emote)

                // Get the which part of the payout we're working with
                const setting = interaction.options.getSubcommand();
                if (setting === "enable") {
                    // Grab which arena to set it to
                    const arena = interaction.options.getString("arena");
                    const enabled = interaction.options.getBoolean("enabled");

                    // If it's one of the correct options
                    if (arena === "char") {
                        aw.payout.char.enabled = enabled;
                    } else if (arena === "fleet") {
                        aw.payout.fleet.enabled = enabled;
                    } else {
                        aw.payout.char.enabled = enabled;
                        aw.payout.fleet.enabled = enabled;
                    }
                } else if (setting === "channel") {
                    // Set the channel for one of the options (Char/ fleet)
                    const channel = interaction.options.getChannel("channel");
                    const targetArena = interaction.options.getString("arena");

                    // Need to make sure that the user has the correct permissions to set this up
                    if (options.level < Bot.constants.permMap.GUILD_ADMIN) {
                        return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                    }

                    // They got throught all that, go ahead and set it
                    if (targetArena === "char") {
                        aw.payout.char.channel = channel;
                    } else if (targetArena === "fleet") {
                        aw.payout.fleet.channel = channel;
                    } else {
                        aw.payout.char.channel = channel;
                        aw.payout.fleet.channel = channel;
                    }
                } else if (setting === "mark") {
                    // Setting the mark/ emote/ symbol/ whatver to help show people as friendly/ enemy
                    // ;aw payout mark 123123123 :smile:

                    const ac = interaction.options.getInteger("allycode");
                    const mark = interaction.options.getString("mark");

                    const player = aw.allycodes.find((p: AWPlayer) => p.allyCode === ac);
                    if (!player) {
                        return super.error(interaction, "Sorry, but you can only apply a mark to an already present player/ allycode");
                    }
                    // If they're trying to use a custom emote, make sure it's available for the bot to use
                    const emojiRegex = /(:[^:\s]+:|<:[^:\s]+:[0-9]+>|<a:[^:\s]+:[0-9]+>)/g;
                    if (emojiRegex.test(mark)) {
                        cmdOut = "If you are using an external emote from outside this server, be aware that it will not work if this bot does not also have access to the server that it's from";
                    }
                    aw.allycodes = aw.allycodes.map((p: AWPlayer) => {
                        if (p.allyCode.toString() === ac.toString()) {
                            p.mark = mark;
                        }
                        return p;
                    });
                }
                break;
            }
            case "arena": {
                const enabled = interaction.options.getBoolean("enabled");
                const arena = interaction.options.getString("arena");

                if (arena === "both") {
                    aw.arena.char.enabled  = enabled;
                    aw.arena.fleet.enabled = enabled;
                } else if (arena === "char") {
                    aw.arena.char.enabled  = enabled;
                } else if (arena === "fleet") {
                    aw.arena.fleet.enabled = enabled;
                }
                break;
            }
            case "allycode": {
                // Add/ remove
                const action = interaction.options.getSubcommand();

                // Logic for add/ remove
                if (action === "add") {
                    // List of ally codes to add or remove
                    const codesIn = interaction.options.getString("allycodes")
                        .split(",") // Split em at the commas if there are more than one
                        .map((a: string) => a.trim());    // Trim off any spaces in case

                    // The mark to put with the ally code (Optional)
                    const mark = interaction.options.getString("mark");
                    const emojiRegex = /(:[^:\s]+:|<:[^:\s]+:[0-9]+>|<a:[^:\s]+:[0-9]+>)/g;
                    if (emojiRegex.test(mark)) {
                        outLog.push("If you are using an external emote from outside this server, be aware that it will not work if this bot does not also have access to the server that it's from");
                    }

                    // Bunch of checks before getting to the logic
                    if (!codesIn.length) {
                        return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_AC", action));
                    }
                    const codes = [];

                    codesIn.forEach((code: string) => {
                        let ac: number, mention: string;
                        try {
                            [ac, mention] = getAcMention(code);
                            if (!Bot.isAllyCode(ac)) {
                                outLog.push(`${ac} is not a valid allycode.`);
                                return;
                            }
                        } catch (e) {
                            outLog.push(e);
                            return;
                        }

                        codes.push({
                            code: ac,
                            mention: mention
                        });
                    });

                    if (!codes.length) {
                        // return interaction.reply("There were no valid ally codes entered.");
                        return super.error(interaction, "There were no valid ally codes entered.");
                    }

                    // There are more than one valid code, try adding them all
                    await interaction.deferReply();
                    const players = await Bot.swgohAPI.unitStats(codes.map(c => c.code));
                    if (!players?.length) {
                        return super.error(interaction, "Sorry, but it looks like none of the ally code(s) you entered were found with rosters. If you're sure the code(s) were correct, please wait a bit and try again.");
                    }
                    for (const c of codes) {
                        let player: PlayerStatsAccount | null;
                        try {
                            player = checkPlayer(players, c);
                        } catch (e) {
                            outLog.push(e);
                            continue;
                        }

                        aw.allycodes.push({
                            allyCode: c.code,
                            name:     player.name,
                            mention:  c.mention,
                            lastChar: player.arena.char ? player.arena.char.rank : null,
                            lastShip: player.arena.ship ? player.arena.ship.rank : null,
                            poOffset: player.poUTCOffsetMinutes,
                            mark:     mark ? mark : null
                        });
                        outLog.push(c.code + " added!");
                    }
                } else if (action === "edit") {
                    // Used to add or remove a mention
                    const oldCodeOpt = interaction.options.getString("old_allycode");
                    const newCodeOpt = interaction.options.getString("new_allycode");

                    if (!Bot.isAllyCode(oldCodeOpt)) {
                        return super.error(interaction, `${oldCodeOpt} is not a valid ally code.`);
                    }
                    // Clean it up, make sure it's correctly formatted
                    const oldCode = await Bot.getAllyCode(interaction, oldCodeOpt);
                    if (!oldCode) {
                        return super.error(interaction, "Sorry, but that was not a valid ally code");
                    }

                    let ac: number, mention: string;
                    try {
                        [ac, mention] = getAcMention(newCodeOpt);
                    } catch (e) {
                        outLog.push(e);
                    }

                    // Check if the specified code is available to edit
                    // If not, just add it in fresh
                    // If so, delte it then add it back
                    const exists = aw.allycodes.find((p: AWPlayer) => p.allyCode === oldCode);
                    if (exists) {
                        aw.allycodes = aw.allycodes.filter((p: AWPlayer) => p.allyCode !== oldCode);
                    }
                    let player = null;
                    try {
                        await interaction.deferReply();
                        const players = await Bot.swgohAPI.unitStats(ac);
                        player = checkPlayer(players, {code: ac});
                    } catch (e) {
                        return super.error(interaction, "Error getting player info.\n" + e);
                    }
                    aw.allycodes.push({
                        allyCode: ac,
                        name:     player.name,
                        mention:  mention,
                        lastChar: player.arena.char ? player.arena.char.rank : null,
                        lastShip: player.arena.ship ? player.arena.ship.rank : null,
                        poOffset: player.poUTCOffsetMinutes
                    });
                    outLog.push(ac + ` ${exists ? "updated" : "added"}!`);
                } else if (["remove", "delete"].includes(action)) {
                    // List of ally codes to add or remove
                    const codesIn = interaction.options.getString("allycodes")
                        .split(",") // Split em at the commas if there are more than one
                        .map((a: string) => a.trim())    // Trim off any spaces in case
                        .filter((a: string) => Bot.isAllyCode(a));

                    // Some checks before getting to the logic
                    if (!codesIn.length) return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_AC", action));

                    for (let code of codesIn) {
                        code = code.replace(/[^\d]/g, "");
                        if (aw.allycodes.find((ac: {[key: string]: number}) => ac.allyCode === parseInt(code, 10))) {
                            aw.allycodes = aw.allycodes.filter((ac: {[key: string]: number}) => ac.allyCode !== parseInt(code, 10));
                            outLog.push(code + " has been removed");
                        } else {
                            return super.error(interaction, "That ally code was not available to be removed");
                        }
                    }
                }
                break;
            }
            case "report": {
                const action = interaction.options.getString("arena");
                if (aw.report === action.toLowerCase()) {
                    return super.error(interaction, `Your report setting was already set to ${action}`);
                }
                aw.report = action.toLowerCase();
                outLog.push(`Your report setting has changed to \`${action.toLowerCase()}\``);
                break;
            }
            case "showvs": {
                // Enable or disable showing when one person hits another
                const isEnabled = interaction.options.getBoolean("enable");
                if (isEnabled === aw.showvs) {
                    return super.error(interaction, `Your showvs setting was already set to ${isEnabled.toString()}`);
                }
                aw.showvs = isEnabled;
                outLog.push(`The log will ${aw.showvs ? "now" : "not"} show when someone hits someone else.`);
                break;
            }
            case "warn": {
                // ;aw warn 123123123 <# of min> <none|both|char|fleet>
                const code  = interaction.options.getInteger("allycode");
                let mins  = interaction.options.getInteger("mins");
                const arena = interaction.options.getString("arena");

                if (!Bot.isAllyCode(code)) {
                    return super.error(interaction, `Invalid ally code (${code})`);
                }
                if (!mins || mins <= 0) {
                    return super.error(interaction, "Invalid minute count. Only values of 1 and above are valid.", {example: "aw warn 123123123 30 both"});
                }

                const exists = aw.allycodes.find((p: AWPlayer) => p.allyCode === code);
                if (!exists) return super.error(interaction, "That ally code is not in your list.");

                aw.allycodes = aw.allycodes.filter((p: AWPlayer) => p.allyCode !== code);

                if (typeof exists.allyCode === "string") exists.allyCode = parseInt(exists.allyCode, 10);
                exists.warn = {
                    min: mins && mins > 0 ? mins : null,
                    arena: arena === "none" ? null : arena
                };
                aw.allycodes.push(exists);
                break;
            }
            case "result": {
                // ;aw result 123123123 <none|char|fleet|both>
                const code  = interaction.options.getString("allycode");
                const arena = interaction.options.getString("arena");

                if (!Bot.isAllyCode(code)) {
                    return super.error(interaction, `Invalid ally code (${code})`);
                }

                const exists = aw.allycodes.find((p: AWPlayer) => p.allyCode === parseInt(code, 10));
                if (!exists) return super.error(interaction, "That ally code is not in your list.");

                aw.allycodes = aw.allycodes.filter((p: AWPlayer) => p.allyCode !== parseInt(code, 10));
                exists.result = arena === "none" ? null : arena;
                aw.allycodes.push(exists);
                break;
            }
            case "use_marks_in_log": {
                const useMarksInLog = interaction.options.getBoolean("enabled");
                if (aw.useMarksInLog === useMarksInLog) {
                    return super.error(interaction, `UseMarksInLog is already set to ${aw.useMarksInLog.toString()}`);
                }
                aw.useMarksInLog = useMarksInLog;
                break;
            }
            case "view": {
                // Show the current settings for this (Also maybe in ;uc, but a summarized version?)
                const allycode = interaction.options.getString("allycode")?.replace(/[^\d]/g, "");

                async function getChannelId(channelIdToGet: string): Promise<string> {
                    if (!channelIdToGet) return null;
                    let foundChannel = interaction.guild?.channels.cache.get(channelIdToGet)?.id;
                    if (!foundChannel) {
                        foundChannel = await interaction.client.shard.broadcastEval((client: Discord.Client, {channelIdToGet}) => {
                            return client.channels.cache.get(channelIdToGet);
                        }, {context: {channelIdToGet: channelIdToGet}})
                            .then((chan: Discord.Channel[]) => {
                                return chan?.[0]?.id;
                            });
                    }
                    return foundChannel ? `<#${foundChannel}>`: "N/A";
                }

                if (!allycode) {
                    const channels = {
                        charChan:        await getChannelId(aw.arena.char.channel),
                        fleetChan:       await getChannelId(aw.arena.fleet.channel),
                        charPayoutChan:  await getChannelId(aw.payout.char.channel),
                        fleetPayoutChan: await getChannelId(aw.payout.fleet.channel)
                    }

                    // If there's any ally codes in the array, go ahead and format them
                    let ac =  aw.allycodes.length ? aw.allycodes : [];
                    ac = ac.sort((a: AWPlayer, b: AWPlayer) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
                    ac = ac.map((a: AWPlayer) => {
                        const isWarn = a.warn && a.warn.min && a.warn.arena ? "W": "";
                        const isRes  = a.result ? "R" : "";
                        const tags   = isWarn.length || isRes.length ? `\`[${isWarn}${isRes}]\`` : "";
                        return `\`${a.allyCode}\` ${tags} ${a.mark ? a.mark + " " : ""}**${a.mention ? `<@${a.mention}>` : a.name}**`;
                    });

                    // Chunk the codes down so they'll fit within the 1024 character limit of a field value
                    const fields = [];
                    const acChunks = Bot.msgArray(ac, "\n", 1000);
                    for (const [ ix, chunk ] of acChunks.entries()) {
                        if (ix === 0) {
                            fields.push({
                                name: `AllyCodes: (${aw.allycodes.length}/${codeCap})`,
                                value: chunk
                            });
                        } else {
                            fields.push({
                                name: "-",
                                value: chunk
                            });
                        }
                    }
                    fields.push({
                        name: "**Payout Settings**",
                        value: [
                            `Char:     **${(aw.payout.char.enabled  && aw.payout.char.channel)  ? "ON " : "OFF"}**  -  ${channels.charPayoutChan}`,
                            `Ship:     **${(aw.payout.fleet.enabled && aw.payout.fleet.channel) ? "ON " : "OFF"}**  -  ${channels.fleetPayoutChan}`
                        ].join("\n")
                    });


                    return interaction.reply({embeds: [{
                        title: "Arena Watch Settings",
                        description: [
                            `Enabled:  **${aw.enabled ? "ON" : "OFF"}**`,
                            `Char:     **${(aw.arena.char.enabled  && aw.arena.char.channel)  ? "ON " : "OFF"}**  -  ${channels.charChan}`,
                            `Ship:     **${(aw.arena.fleet.enabled && aw.arena.fleet.channel) ? "ON " : "OFF"}**  -  ${channels.fleetChan}`,
                        ].join("\n"),
                        fields: fields
                    }]});
                } else {
                    if (!Bot.isAllyCode(allycode)) {
                        return super.error(interaction, `${allycode} is not a valid ally code.`);
                    } else if (!aw.allycodes.filter((a: AWPlayer) => a.allyCode === parseInt(allycode, 10)).length) {
                        return super.error(interaction, `${allycode} is not listed in your registered ally codes.`);
                    }

                    const player = aw.allycodes.find((p: AWPlayer) => p.allyCode === parseInt(allycode, 10));
                    return interaction.reply({embeds: [{
                        title: `Arena Watch Settings (${allycode})`,
                        description: [
                            `Name: **${player.name}**`,
                            `Mention: **${player.mention ? "<@" + player.mention + ">" : "N/A"}**`,
                            `Payout Result: **${player.result ? player.result : "N/A"}**`,
                            `Warn Mins: **${player.warn ? player.warn.min : "N/A"}**`,
                            `Warn Arena: **${player.warn ? player.warn.arena : "N/A"}**`
                        ].join("\n")
                    }]});
                }
            }
            default:
                return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_INVALID_OPTION"));
        }
        user.arenaWatch = aw;
        await Bot.userReg.updateUser(userID, user);
        return super.error(interaction, outLog.length ? outLog.join("\n") : interaction.language.get("COMMAND_ARENAALERT_UPDATED") + (cmdOut ? "\n\n#####################\n\n" + cmdOut : ""), {title: " ", color: "#0000FF"});
    }
}


module.exports = ArenaWatch;
