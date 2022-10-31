const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");
// const {inspect} = require("util");

class ArenaWatch extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "arenawatch",
            guildOnly: false,
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
                                    required: true
                                },
                                {
                                    name: "mark",
                                    type: ApplicationCommandOptionType.String,
                                    description: "The emote or symbol to mark them with. Leaving this empty will remove it if available"
                                }
                            ]
                        },
                        {
                            name: "remove",
                            description: "Add ally codes in",
                            type: ApplicationCommandOptionType.Subcommand,
                            options: [
                                {
                                    name: "allycodes",
                                    description: "AllyCodes, comma seperated",
                                    type: ApplicationCommandOptionType.String,
                                    required: true
                                }
                            ]
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
                                    required: true
                                },
                                {
                                    name: "new_allycode",
                                    type: ApplicationCommandOptionType.String,
                                    description: "Different ally code, or allycode:mention to change to (Ex: 123123123:@mention)",
                                    required: true
                                }
                            ]
                        },
                    ]
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
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "The channel to put the logs in",
                    options: [
                        {
                            name: "target_channel",
                            type: ApplicationCommandOptionType.Channel,
                            required: true,
                            description: "The channel to put the logs in"
                        },
                        {
                            name: "arena",
                            type: ApplicationCommandOptionType.String,
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
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Enable/ Disable arenawatch",
                    options: [{
                        name: "toggle",
                        description: "Enable/ Disable arenawatch",
                        type: ApplicationCommandOptionType.Boolean,
                        required: true
                    }]
                },
                {
                    name: "report",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Choose whether you want it to report on climbs, drops, or both",
                    options: [{
                        name: "arena",
                        type: ApplicationCommandOptionType.String,
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
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Enable or disable showing when one person hits another",
                    options: [
                        {
                            name: "enable",
                            description: "True/ False",
                            type: ApplicationCommandOptionType.Boolean,
                            required: true

                        }
                    ]
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
                            required: true
                        },
                        {
                            name: "mins",
                            type: ApplicationCommandOptionType.Integer,
                            description: "(1-1439) The number of minutes before their payout to warn them",
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
                            type: ApplicationCommandOptionType.Subcommand,
                            description: "Set an arena's logs to a specified channel",
                            options: [
                                {
                                    name: "target_channel",
                                    type: ApplicationCommandOptionType.Channel,
                                    description: "The channel to send to",
                                    required: true
                                },
                                {

                                    name: "arena",
                                    type: ApplicationCommandOptionType.String,
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
                            type: ApplicationCommandOptionType.Subcommand,
                            description: "Set a mark for a player",
                            options: [
                                {
                                    name: "allycode",
                                    type: ApplicationCommandOptionType.String,
                                    description: "The ally code of the player to mark",
                                    required: true
                                },
                                {
                                    name: "mark",
                                    type: ApplicationCommandOptionType.String,
                                    required: true,
                                    description: "The emote or symbol to mark them with. Leaving this empty will remove it if available"
                                }
                            ]
                        }
                    ]
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
                            required: true
                        },
                        {
                            name: "arena",
                            type: ApplicationCommandOptionType.String,
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
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "Toggle showing players' marks in the arena log",
                    options: [
                        {
                            name: "enable",
                            type: ApplicationCommandOptionType.Boolean,
                            required: true,
                            description: "Show marks in arena log?",
                        }
                    ]
                },
                {
                    name: "view",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "View your arenaWatch settings",
                    options: [
                        {
                            name: "allycode",
                            type: ApplicationCommandOptionType.String,
                            description: "An allycode to check the specific settings for"
                        }
                    ]
                }
            ]
        });
    }

    async run(Bot, interaction, options) {
        let target = interaction.options.getSubcommandGroup(false);
        if (!target) target = interaction.options.getSubcommand();

        let cmdOut = null;
        const outLog = [];

        const user = await Bot.userReg.getUser(interaction.user.id);
        if (!user) return super.error(interaction, "Sorry, but something went wrong and I couldn't find your data. Please try again.");

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
        if (aw.showvs !== true && aw.showvs !== false) aw.showvs = true;
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

        function getAcMention(code) {
            let [ac, mention] = code.split(":");
            if (!Bot.isAllyCode(ac)) throw new Error(`Invalid code (${ac})!`);
            ac = ac.replace(/[^\d]/g, "");

            mention = Bot.isUserMention(mention || "") ? mention.replace(/[^\d]/g, "") : null;
            return [parseInt(ac, 10), mention];
        }

        function checkPlayer(players, code) {
            if (!players) throw new Error("Missing players in checkPlayer");
            const player = players.find(p => parseInt(p.allyCode, 10) === parseInt(code.code, 10));
            if (!player) {
                throw new Error(`Could not find ${code.code}, invalid code`);
            }
            if (aw.allycodes.find(usercode => parseInt(usercode.allyCode, 10) === parseInt(code.code, 10))) {
                throw new Error(`${code.code} was already in the list. If you're trying to change something, try using the \`;aw allycode edit\` command`);
            }
            if (aw.allycodes.length >= codeCap) {
                throw new Error(`Could not add ${code.code}, ally code cap reached!`);
            }
            return player;
        }

        switch (target) {
            // ArenaWatch -> activate/ deactivate
            case "enabled": {
                const isEnabled = interaction.options.getBoolean("enabled");
                aw.enabled = isEnabled;
                break;
            }
            case "channel": {
                // This needs to make sure the person has an adminrole or something so they cannot just spam a chat with it
                const channel = interaction.options.getChannel("target_channel");
                const targetArena = interaction.options.getString("arena");

                if (!channel?.guild) {
                    // They choose an invalid channel/ one that doesn't exist?
                    return super.error(interaction, "Invalid channel, please make sure you're choosing a channel in this server, and are mentioning it.");
                }

                if (channel?.guild?.id !== interaction?.guild?.id) {
                    // They chose a channel in a different server
                    return super.error(interaction, "Invalid channel, please choose one in this server");
                }

                // If it gets this far, it should be a valid code
                // Need to make sure that the user has the correct permissions to set this up
                if (options.level < Bot.constants.GUILD_ADMIN) {
                    return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                }

                // They got throught all that, go ahead and set it
                switch (targetArena) {
                    case "both": {
                        // Set the channel for both the char and fleet arenas
                        aw.arena.char.channel  = channel.id;
                        aw.arena.fleet.channel = channel.id;
                        break;
                    }
                    case "char": {
                        // Set just the char arena channel
                        aw.arena.char.channel  = channel.id;
                        break;
                    }
                    case "fleet": {
                        // Set just the fleet arena channel
                        aw.arena.fleet.channel = channel.id;
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
                    const channel = interaction.options.getChannel("target_channel");
                    const targetArena = interaction.options.getString("arena");

                    // Need to make sure that the user has the correct permissions to set this up
                    if (options.level < Bot.constants.GUILD_ADMIN) {
                        return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                    }

                    // They got throught all that, go ahead and set it
                    if (targetArena === "char") {
                        aw.payout.char.channel = channel.id;
                    } else if (targetArena === "fleet") {
                        aw.payout.fleet.channel = channel.id;
                    } else {
                        aw.payout.char.channel = channel.id;
                        aw.payout.fleet.channel = channel.id;
                    }
                } else if (setting === "mark") {
                    // Setting the mark/ emote/ symbol/ whatver to help show people as friendly/ enemy
                    // ;aw payout mark 123123123 :smile:

                    const ac = interaction.options.getString("allycode");
                    const mark = interaction.options.getString("mark");

                    const player = aw.allycodes.find(p => p.allyCode.toString() === ac.toString());
                    if (!player) {
                        return super.error(interaction, "Sorry, but you can only apply a mark to an already present player/ allycode");
                    }
                    // If they're trying to use a custom emote, make sure it's available for the bot to use
                    const emojiRegex = /(:[^:\s]+:|<:[^:\s]+:[0-9]+>|<a:[^:\s]+:[0-9]+>)/g;
                    if (emojiRegex.test(mark)) {
                        cmdOut = "If you are using an external emote from outside this server, be aware that it will not work if this bot does not also have access to the server that it's from";
                    }
                    aw.allycodes = aw.allycodes.map(p => {
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
                        .map(a => a.trim());    // Trim off any spaces in case

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

                    codesIn.forEach(code => {
                        let ac, mention;
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
                            code: parseInt(ac, 10),
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
                        let player;
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
                    let oldCode = interaction.options.getString("old_allycode");
                    const newCode = interaction.options.getString("new_allycode");

                    if (!Bot.isAllyCode(oldCode)) {
                        return super.error(interaction, `${oldCode} is not a valid ally code.`);
                    }
                    // Clean it up, make sure it's correctly formatted
                    oldCode = Bot.getAllyCode(interaction, oldCode);
                    if (!oldCode) {
                        return super.error(interaction, "Sorry, but that was not a valid ally code");
                    }

                    let ac, mention;
                    try {
                        [ac, mention] = getAcMention(newCode);
                    } catch (e) {
                        outLog.push(e);
                    }

                    // Check if the specified code is available to edit
                    // If not, just add it in fresh
                    // If so, delte it then add it back
                    const exists = aw.allycodes.find(p => p.allyCode === oldCode);
                    if (exists) {
                        aw.allycodes = aw.allycodes.filter(p => parseInt(p.allyCode, 10) !== parseInt(oldCode, 10));
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
                        .map(a => a.trim())    // Trim off any spaces in case
                        .filter(a => Bot.isAllyCode(a));

                    // Some checks before getting to the logic
                    if (!codesIn.length) return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_AC", action));

                    for (let code of codesIn) {
                        code = code.replace(/[^\d]/g, "");
                        code = parseInt(code, 10);
                        if (aw.allycodes.find(ac => ac.allyCode === code)) {
                            aw.allycodes = aw.allycodes.filter(ac => ac.allyCode !== code);
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
                const code  = interaction.options.getString("allycode");
                let mins  = interaction.options.getInteger("mins");
                const arena = interaction.options.getString("arena");


                if (!Bot.isAllyCode(code)) {
                    return super.error(interaction, `Invalid ally code (${code})`);
                }

                mins = parseInt(mins, 10);
                if (!mins || mins <= 0) {
                    return super.error(interaction, "Invalid minute count. Only values of 1 and above are valid.", {example: "aw warn 123123123 30 both"});
                }

                const exists = aw.allycodes.find(p => parseInt(p.allyCode, 10) === parseInt(code, 10));
                if (!exists) return super.error(interaction, "That ally code is not in your list.");

                aw.allycodes = aw.allycodes.filter(p => parseInt(p.allyCode, 10) !== parseInt(code, 10));

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

                const exists = aw.allycodes.find(p => p.allyCode === code);
                if (!exists) return super.error(interaction, "That ally code is not in your list.");

                aw.allycodes = aw.allycodes.filter(p => p.allyCode !== code);
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

                if (!allycode) {
                    // If there's any ally codes in the array, go ahead and format them
                    let ac =  aw.allycodes.length ? aw.allycodes : [];
                    ac = ac
                        // Sort by name
                        .sort((a,b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)
                        // Then format the output strings
                        .map(a => {
                            const isWarn = a?.warn?.min && a.warn?.arena ? "W": "";
                            const isRes  = a.result ? "R" : "";
                            const tags   = isWarn.length || isRes.length ? `\`[${isWarn}${isRes}]\`` : "";
                            return `\`${a.allyCode}\` ${tags} ${a.mark ? a.mark + " " : ""}**${a.mention ? `<@${a.mention}>` : a.name}**`;
                        });

                    const fields = [];
                    // Chunk the codes down so they'll fit within the 1024 character limit of a field value
                    const acChunks = Bot.msgArray(ac, "\n", 1000);
                    for (const [ ix, chunk ] of acChunks.entries()) {
                        fields.push({
                            name: ix > 0 ? "-" : `AllyCodes: (${aw.allycodes.length}/${codeCap})`,
                            value: chunk
                        });
                    }

                    const charPayoutChan  = await getChannelStr("payout", "char");
                    const fleetPayoutChan = await getChannelStr("payout", "fleet");
                    fields.push({
                        name: "**Payout Settings**",
                        value: [
                            `Char:     **${(aw.payout.char.enabled  && aw.payout.char.channel)  ? "ON " : "OFF"}**  -  ${charPayoutChan}`,
                            `Ship:     **${(aw.payout.fleet.enabled && aw.payout.fleet.channel) ? "ON " : "OFF"}**  -  ${fleetPayoutChan}`
                        ].join("\n")
                    });

                    const charChan        = await getChannelStr("arena",  "char");
                    const fleetChan       = await getChannelStr("arena",  "fleet");
                    return interaction.reply({embeds: [{
                        title: "Arena Watch Settings",
                        description: [
                            `Enabled:  **${aw.enabled ? "ON" : "OFF"}**`,
                            `Char:     **${(aw.arena.char.enabled  && aw.arena.char.channel)  ? "ON " : "OFF"}**  -  ${charChan}`,
                            `Ship:     **${(aw.arena.fleet.enabled && aw.arena.fleet.channel) ? "ON " : "OFF"}**  -  ${fleetChan}`,
                        ].join("\n"),
                        fields: fields
                    }]});
                } else {
                    if (!Bot.isAllyCode(allycode)) {
                        return super.error(interaction, `${allycode} is not a valid ally code.`);
                    } else if (!aw.allycodes.filter(a => parseInt(a.allyCode, 10) === parseInt(allycode, 10)).length) {
                        return super.error(interaction, `${allycode} is not listed in your registered ally codes.`);
                    }

                    const player = aw.allycodes.find(p => parseInt(p.allyCode, 10) === parseInt(allycode, 10));
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
        if (target !== "view") {
            user.arenaWatch = aw;
            await Bot.userReg.updateUser(interaction.user.id, user);
        }
        return super.error(interaction, outLog.length ? outLog.join("\n") : interaction.language.get("COMMAND_ARENAALERT_UPDATED") + (cmdOut ? "\n\n#####################\n\n" + cmdOut : ""), {title: " ", color: Bot.constants.colors.blue});

        async function getChannelStr(alertType, arenaType) {
            if (!["char", "fleet"].includes(arenaType)) {
                console.error("Invalid arenaType");
                return null;
            }
            if (!["arena", "payout"].includes(alertType)) {
                console.error("Invalid alertType");
                return null;
            }
            let thisChan = interaction.guild ? interaction.guild.channels.cache.get(aw[alertType]?.[arenaType]?.channel) : null;
            if (!thisChan) {
                thisChan = await interaction.client.shard.broadcastEval((client, aw) => client.channels.cache.get(aw[alertType]?.[arenaType]?.channel), {context: aw})
                    .then((thisChan) => {
                        thisChan = thisChan.filter(a => !!a)[0];
                        return thisChan ? `<#${thisChan.id}>` : "N/A";
                    });
            }
            return thisChan || "N/A";
        }
    }
}


module.exports = ArenaWatch;
