const Command = require("../base/slashCommand");
// const {inspect} = require("util");

class ArenaWatch extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "arenawatch",
            category: "Patreon",
            aliases: ["aw"],
            permissions: ["EMBED_LINKS"],
            flags: {},
            subArgs: {
                mark: {
                    aliases: []
                }
            },
            options: [
                {
                    name: "allycode",
                    type: "SUB_COMMAND_GROUP",
                    description: "Any ally codes you want to put in (9 digit numbers, don't need the dashes)",
                    options: [
                        {
                            name: "add",
                            description: "Add ally codes in",
                            type: "SUB_COMMAND",
                            options: [
                                {
                                    name: "allycodes",
                                    description: "AllyCodes or allycode:mention, comma seperated",
                                    type: "STRING",
                                    required: true
                                },
                                {
                                    name: "mark",
                                    type: "STRING",
                                    description: "The emote or symbol to mark them with. Leaving this empty will remove it if available"
                                }
                            ]
                        },
                        {
                            name: "remove",
                            description: "Add ally codes in",
                            type: "SUB_COMMAND",
                            options: [
                                {
                                    name: "allycodes",
                                    description: "AllyCodes, comma seperated",
                                    type: "STRING",
                                    required: true
                                }
                            ]
                        },
                        {
                            name: "edit",
                            type: "SUB_COMMAND",
                            description: "Use to change an allycode or mention (Ex: '123123123 123123123:mention')",
                            options: [
                                {
                                    name: "old_allycode",
                                    type: "STRING",
                                    description: "Ally code of the person you want to modify",
                                    required: true
                                },
                                {
                                    name: "new_allycode",
                                    type: "STRING",
                                    description: "Different ally code, or allycode:mention to change to (Ex: 123123123:@mention)",
                                    required: true
                                }
                            ]
                        },
                    ]
                },
                {
                    name: "arena",
                    type: "SUB_COMMAND",
                    description: "Choose between the arena types",
                    options: [
                        {
                            name: "enabled",
                            type: "BOOLEAN",
                            description: "Set whether it's enabled or not",
                            required: true,
                        },
                        {
                            name: "arena",
                            type: "STRING",
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
                    type: "SUB_COMMAND",
                    description: "The channel to put the logs in",
                    options: [
                        {
                            name: "channel",
                            type: "CHANNEL",
                            required: true,
                            description: "The channel to put the logs in"
                        },
                        {
                            name: "arena",
                            type: "STRING",
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
                    type: "SUB_COMMAND",
                    description: "Enable/ Disable arenawatch",
                    options: [{
                        name: "toggle",
                        description: "Enable/ Disable arenawatch",
                        type: "BOOLEAN",
                        required: true
                    }]
                },
                {
                    name: "report",
                    type: "SUB_COMMAND",
                    description: "Choose whether you want it to report on climbs, drops, or both",
                    options: [{
                        name: "arena",
                        type: "STRING",
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
                    type: "SUB_COMMAND",
                    description: "Enable or disable showing when one person hits another",
                    options: [
                        {
                            name: "enable",
                            description: "True/ False",
                            type: "BOOLEAN",
                            required: true

                        }
                    ]
                },
                {
                    name: "warn",
                    type: "SUB_COMMAND",
                    description: "Set when to warn who, and about which arena",
                    options: [
                        {
                            name: "allycode",
                            type: "STRING",
                            description: "The user's ally code",
                            required: true
                        },
                        {
                            name: "mins",
                            type: "INTEGER",
                            description: "(1-1439) The number of minutes before their payout to warn them",
                            required: true
                        },
                        {
                            name: "arena",
                            type: "STRING",
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
                    type: "SUB_COMMAND_GROUP",
                    description: "Set to spit out the payout result of a user",
                    options: [
                        {
                            name: "enable",
                            type: "SUB_COMMAND",
                            description: "Choose between the arena types",
                            options: [
                                {
                                    name: "enabled",
                                    type: "BOOLEAN",
                                    description: "Set whether it's enabled or not",
                                    required: true,
                                },
                                {
                                    name: "arena",
                                    type: "STRING",
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
                            type: "SUB_COMMAND",
                            description: "Set an arena's logs to a specified channel",
                            options: [
                                {
                                    name: "channel",
                                    type: "CHANNEL",
                                    description: "The channel to send to",
                                    required: true
                                },
                                {

                                    name: "arena",
                                    type: "STRING",
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
                            type: "SUB_COMMAND",
                            description: "Set a mark for a player",
                            options: [
                                {
                                    name: "allycode",
                                    type: "STRING",
                                    description: "The ally code of the player to mark",
                                    required: true
                                },
                                {
                                    name: "mark",
                                    type: "STRING",
                                    required: true,
                                    description: "The emote or symbol to mark them with. Leaving this empty will remove it if available"
                                }
                            ]
                        }
                    ]
                },
                {
                    name: "result",
                    type: "SUB_COMMAND",
                    description: "Set to spit out the payout result of a user",
                    options: [
                        {
                            name: "allycode",
                            type: "STRING",
                            description: "The user's ally code",
                            required: true
                        },
                        {
                            name: "arena",
                            type: "STRING",
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
                    name: "usemarksinlog",
                    type: "SUB_COMMAND",
                    description: "Toggle showing players' marks in the arena log",
                    options: [
                        {
                            name: "enable",
                            type: "BOOLEAN",
                            required: true,
                            description: "Show marks in arena log?",
                        }
                    ]
                },
                {
                    name: "view",
                    type: "SUB_COMMAND",
                    description: "View your arenaWatch settings",
                    options: [{
                        name: "allycode",
                        type: "STRING",
                        description: "An allycode to check the specific settings for"
                    }]
                }
            ]
        });
    }

    async run(Bot, interaction, options = {}) { // eslint-disable-line no-unused-vars
        // const channel = interaction.options.getChannel("channel");
        let target = interaction.options.getSubcommandGroup(false);
        if (!target) {
            target = interaction.options.getSubcommand();
        }
        let cmdOut = null;

        const outLog = [];

        const userID = interaction.user.id;

        // TODO Fiddle with the levels and such
        // if (options.subArgs.user && options.level < 9) {
        //     return super.error(interaction, interaction.language.get("COMMAND_USERCONF_CANNOT_VIEW_OTHER"));
        // } else if (options.subArgs.user) {
        //     userID = options.subArgs.user.replace(/[^\d]*/g, "");
        //     if (!Bot.isUserID(userID)) {
        //         return super.error(interaction, "Invalid user ID");
        //     }
        // }

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

        function getAcMention(code) {
            let [ac, mention] = code.split(":");
            if (!Bot.isAllyCode(ac)) throw new Error(`Invalid code (${ac})!`);
            ac = ac.replace(/[^\d]/g, "");

            mention = Bot.isUserMention(mention || "") ? mention.replace(/[^\d]/g, "") : null;
            return [parseInt(ac, 10), mention];
        }

        function checkPlayer(players, user, code) {
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
            case "enabled": {
                const isEnabled = interaction.options.getBoolean("enabled");
                aw.enabled = isEnabled;
                break;
            }
            case "channel": {
                // This needs to make sure the person has an adminrole or something so they cannot just spam a chat with it
                const channel = interaction.options.getChannel("channel");
                const targetArena = interaction.options.getString("arena");

                if (channel.guild.id !== interaction.guild.id) {
                    // They chose a channel in a different server
                    return super.error(interaction, "Invalid channel, please choose one in this server");
                }

                // If it gets this far, it should be a valid code
                // Need to make sure that the user has the correct permissions to set this up
                // TODO Make this work
                // if (options.level < 3) {
                //     return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                // }

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
                    // TODO Make this work
                    // if (options.level < 3) {
                    //     return super.error(interaction, interaction.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                    // }

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
                            player = checkPlayer(players, user, c);
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
                        player = checkPlayer(players, user, {code: ac});
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
            case "usemarksinlog": {
                const useMarksInLog = interaction.options.getBoolean("usemarksinlog");
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
                    let charChan, fleetChan, charPayoutChan, fleetPayoutChan;
                    if (aw.arena.char.channel) {
                        charChan = interaction.guild ? interaction.guild.channels.cache.get(aw.arena.char.channel) : null;
                        if (!charChan) {
                            charChan = await interaction.client.shard.broadcastEval((client, aw) => client.channels.cache.get(aw.arena.char.channel), {context: aw})
                                .then((thisChan) => {
                                    thisChan = thisChan.filter(a => !!a)[0];
                                    return thisChan ? `<#${thisChan.id}>` : "N/A";
                                });
                        }
                    }
                    if (aw.arena.fleet.channel) {
                        fleetChan = interaction.guild ? interaction.guild.channels.cache.get(aw.arena.fleet.channel) : null;
                        if (!fleetChan) {
                            fleetChan = await interaction.client.shard.broadcastEval((client, aw) => client.channels.cache.get(aw.arena.fleet.channel), {context: aw})
                                .then((thisChan) => {
                                    thisChan = thisChan.filter(a => !!a)[0];
                                    return thisChan ? `<#${thisChan.id}>` : "N/A";
                                });
                        }
                    }
                    if (aw.payout.char.channel) {
                        charPayoutChan = interaction.guild ? interaction.guild.channels.cache.get(aw.payout.char.channel) : null;
                        if (!charPayoutChan) {
                            charPayoutChan = await interaction.client.shard.broadcastEval((client, aw) => client.channels.cache.get(aw.payout.char.channel), {context: aw})
                                .then((thisChan) => {
                                    thisChan = thisChan.filter(a => !!a)[0];
                                    return thisChan ? `<#${thisChan.id}>` : "N/A";
                                });
                        }
                    }
                    if (aw.payout.fleet.channel) {
                        fleetPayoutChan = interaction.guild ? interaction.guild.channels.cache.get(aw.payout.fleet.channel) : null;
                        if (!fleetPayoutChan) {
                            fleetPayoutChan = await interaction.client.shard.broadcastEval((client, aw) => client.channels.cache.get(aw.payout.fleet.channel), {context: aw})
                                .then((thisChan) => {
                                    thisChan = thisChan.filter(a => !!a)[0];
                                    return thisChan ? `<#${thisChan.id}>` : "N/A";
                                });
                        }
                    }

                    // If there's any ally codes in the array, go ahead and format them
                    let ac =  aw.allycodes.length ? aw.allycodes : [];
                    ac = ac.sort((a,b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
                    // ac = ac.map(a => `\`${a.allyCode}\` **${a.mention ? `<@${a.mention}>` : a.name}**`);
                    ac = ac.map(a => {
                        const isWarn = a.warn && a.warn.min && a.warn.arena ? "W": "";
                        const isRes  = a.result ? "R" : "";
                        const tags   = isWarn.length || isRes.length ? `\`[${isWarn}${isRes}]\`` : "";
                        return `\`${a.allyCode}\` ${tags} ${a.mark ? a.mark + " " : ""}**${a.mention ? `<@${a.mention}>` : a.name}**`;
                    });

                    const fields = [];
                    if (ac.length > 25) {
                        fields.push({
                            name: `AllyCodes: (${aw.allycodes.length}/${codeCap})`,
                            value: ac.slice(0,25).join("\n")
                        });
                        fields.push({
                            name: "-",
                            value: ac.slice(25).join("\n")
                        });
                    } else {
                        fields.push({
                            name: `AllyCodes: (${aw.allycodes.length}/${codeCap})`,
                            value: `${ac.length ? ac.join("\n") : "**N/A**"}`
                        });
                    }
                    fields.push({
                        name: "**Payout Settings**",
                        value: [
                            `Char:     **${(aw.payout.char.enabled  && aw.payout.char.channel)  ? "ON " : "OFF"}**  -  ${charPayoutChan}`,
                            `Ship:     **${(aw.payout.fleet.enabled && aw.payout.fleet.channel) ? "ON " : "OFF"}**  -  ${fleetPayoutChan}`
                        ].join("\n")
                    });


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
            await Bot.userReg.updateUser(userID, user);
        }
        return super.error(interaction, outLog.length ? outLog.join("\n") : interaction.language.get("COMMAND_ARENAALERT_UPDATED") + (cmdOut ? "\n\n#####################\n\n" + cmdOut : ""), {title: " ", color: "#0000FF"});
    }
}


module.exports = ArenaWatch;