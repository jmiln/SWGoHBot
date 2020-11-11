const Command = require("../base/Command");

class ArenaWatch extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "arenawatch",
            category: "Patreon",
            aliases: ["aw"],
            permissions: ["EMBED_LINKS"],
            flags: {},
            subArgs: {}
        });
    }

    async run(Bot, message, [target, ...args], options) { // eslint-disable-line no-unused-vars
        const onVar = ["true", "on", "enable"];
        const offVar = ["false", "off", "disable"];
        let cmdOut = null;

        const outLog = [];

        if (target) target = target.toLowerCase();

        let userID = message.author.id;

        if (options.subArgs.user && options.level < 9) {
            return super.error(message, message.language.get("COMMAND_USERCONF_CANNOT_VIEW_OTHER"));
        } else if (options.subArgs.user) {
            userID = options.subArgs.user.replace(/[^\d]*/g, "");
            if (!Bot.isUserID(userID)) {
                return super.error(message, "Invalid user ID");
            }
        }

        const user = await Bot.userReg.getUser(userID);
        if (!user) {
            return super.error(message, "Sorry, but something went wrong and I couldn't find your data. Please try again.");
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
        const pat = await Bot.getPatronUser(message.author.id);
        if (!pat || pat.amount_cents < 100) {
            return super.error(message, message.language.get("COMMAND_ARENAALERT_PATREON_ONLY"));
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
            case "enable":
            case "enabled": {
                if (!args.length) {
                    // They didn't say which way, so just toggle it
                    aw.enabled = !aw.enabled;
                } else {
                    const toggle = args[0];
                    if (onVar.indexOf(toggle) > -1) {
                        // Turn it on
                        aw.enabled = true;
                    } else if (offVar.indexOf(toggle) > -1) {
                        // Turn it off
                        aw.enabled = false;
                    } else {
                        // Complain, they didn't supply a proper toggle
                        return super.error(message, message.language.get("COMMAND_ARENAALERT_INVALID_BOOL"));
                    }
                }
                break;
            }
            case "ch":
            case "channel": {
                // This needs to make sure the person has an adminrole or something so they cannot just spam a chat with it
                let channel, targetArena = null;
                [channel, targetArena, ...args] = args;
                if (!channel) {
                    if (aw.arena.char.channel || aw.arena.fleet.channel) {
                        aw.arena.char.channel  = null;
                        aw.arena.fleet.channel = null;
                    } else {
                        return super.error(message, "Missing channel");
                    }
                }
                if (!channel || !Bot.isChannelMention(channel)) return super.error(message, "Invalid channel");

                channel = channel.replace (/[^\d]/g, "");
                if (!message.guild.channels.cache.get(channel)) return super.error(message, "I cannot find that channel here.");

                // If it gets this far, it should be a valid code
                // Need to make sure that the user has the correct permissions to set this up
                if (options.level < 3) {
                    return super.error(message, message.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                }

                // They got throught all that, go ahead and set it
                if (targetArena) {
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
                        case "ship":
                        case "fleet": {
                            // Set just the fleet arena channel
                            aw.arena.fleet.channel  = channel;
                            break;
                        }
                        default: {
                            return super.error(message, `\`${targetArena}\` is an invalid arena choice, try both, char, or fleet/ ship.`);
                        }
                    }
                } else {
                    aw.arena.char.channel  = channel;
                    aw.arena.fleet.channel = channel;
                }
                break;
            }
            case "payout": {
                // ;aw payout enable char | fleet | both    (Toggles)
                // ;aw payout channel #channelName char     (Sets it to a channel)
                // ;aw payout channel #channelName fleet    (Sets it to a channel)
                let setting = args[0] ? args.splice(0, 1) : null;
                setting = setting ? String(setting).toLowerCase() : null;
                if (!setting) {
                    // Break here, there needs to be a setting
                    return super.error(message, "Missing option, try one of the following options: `enable, channel`.");
                } else if (!["enable", "channel", "mark"].includes(setting)) {
                    // Break here, it needs to be one of those
                    return super.error(message, `Invalid option (${setting}), try one of the following options: \`enable, channel\`.`);
                }
                if (setting === "enable") {
                    // Toggle enable/ disable
                    const option = args[0] ? args[0].toLowerCase() : null;
                    if (!option) {
                        // If they don't put in an arena
                        return super.error(message, "Missing arena, choose one of the following: `char, fleet`");
                    } else if (!["char", "fleet", "ship"].includes(option)) {
                        // If they put in a wrong arena choice
                        return super.error(message, "Invalid arena, choose one of the following: `char, fleet`");
                    } else {
                        // If it's one of the correct options
                        if (option === "char") {
                            aw.payout.char.enabled = !aw.payout.char.enabled;
                        } else {
                            aw.payout.fleet.enabled = !aw.payout.fleet.enabled;
                        }
                    }
                } else if (setting === "channel") {
                    // Set the channel for one of the options (Char/ fleet)
                    let channel, targetArena = null;
                    [channel, targetArena, ...args] = args;
                    if (!channel || !Bot.isChannelMention(channel)) return super.error(message, "Invalid or missing channel");

                    channel = channel.replace (/[^\d]/g, "");
                    const guildChannel = await message.guild.channels.cache.get(channel);
                    if (!guildChannel) return super.error(message, `I cannot find that channel (${channel}) here.`);

                    // If it gets this far, it should be a valid code
                    // Need to make sure that the user has the correct permissions to set this up
                    if (options.level < 3) {
                        return super.error(message, message.language.get("COMMAND_ARENAWATCH_MISSING_PERM"));
                    }

                    // They got throught all that, go ahead and set it
                    if (targetArena) {
                        switch (targetArena) {
                            case "char": {
                                // Set just the char arena channel
                                aw.payout.char.channel  = channel;
                                break;
                            }
                            case "ship":
                            case "fleet": {
                                // Set just the fleet arena channel
                                aw.payout.fleet.channel  = channel;
                                break;
                            }
                            default: {
                                return super.error(message, `\`${targetArena}\` is an invalid arena choice, try char or fleet/ ship.`);
                            }
                        }
                    }
                } else if (setting === "mark") {
                    // Setting the mark/ emote/ symbol/ whatver to help show people as friendly/ enemy
                    // ;aw payout mark 123123123 :smile:

                    const [ac, mark] = args;
                    const player = aw.allycodes.find(p => p.allyCode.toString() === ac.toString());
                    if (!player) {
                        return super.error(message, "Sorry, but you can only apply a mark to an already present player/ allycode");
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
                } else {
                    // Definitely shouldn't get here, but just in case
                    return super.error(message, "Something broke, you should never get this message");
                }
                break;
            }
            case "arena": {
                const setting = args[0] ? args[0].toLowerCase() : null;
                if (!setting) {
                    return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_MISSING_ARENA"));
                } else if (!["char", "fleet", "both", "none"].includes(setting)) {
                    return super.error(message, message.language.get("COMMAND_USERCONF_ARENA_INVALID_ARENA"));
                }
                if (setting === "both") {
                    aw.arena.char.enabled  = true;
                    aw.arena.fleet.enabled = true;
                } else if (setting === "char") {
                    aw.arena.char.enabled  = true;
                    aw.arena.fleet.enabled = false;
                } else if (["fleet", "ship"].includes(setting)) {
                    aw.arena.char.enabled  = false;
                    aw.arena.fleet.enabled = true;
                } else {
                    aw.arena.char.enabled  = false;
                    aw.arena.fleet.enabled = false;
                }
                break;
            }
            case "ac":
            case "allycode":
            case "allycodes": {
                // Should have add and remove here
                let code;
                const [action] = args;
                [ , code, ...args] = args;

                // Bunch of checks before getting to the logic
                if (!action)                return super.error(message, message.language.get("COMMAND_ARENAWATCH_MISSING_ACTION"));
                if (!code)                  return super.error(message, message.language.get("COMMAND_ARENAWATCH_MISSING_AC", action));
                if (!code.includes(",")) {
                    // If they're trying to add more than one at a time, don't check yet
                    if (!Bot.isAllyCode(code))  return super.error(message, message.language.get("COMMAND_ARENAWATCH_INVALID_AC"));
                }

                // Logic for add/ remove
                if (action === "add") {
                    if (args.length) {
                        code = [code, ...args].join(",");
                    }
                    const codesIn = code.split(",");
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

                        console.log(code, ac, mention);
                        codes.push({
                            code: parseInt(ac, 10),
                            mention: mention
                        });
                    });

                    // There are more than one valid code, try adding them all
                    const players = await Bot.swgohAPI.unitStats(codes.map(c => c.code));
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
                            poOffset: player.poUTCOffsetMinutes
                        });
                        outLog.push(c.code + " added!");
                    }
                } else if (["edit", "change"].includes(action)) {
                    // Used to add or remove a mention
                    // ;aw ac edit 123123123 123123123:mention
                    // ;aw ac edit 123123123 123123123

                    if (!args[0]) {
                        return super.error(message,
                            "Missing second code. You need to enter the ally code for it to modify, then the ally code (& mention if you want) that you want it to show instead.",
                            {example: "aw ac edit 123123123 123123123:@mention"}
                        );

                    }

                    let ac, mention;
                    try {
                        [ac, mention] = getAcMention(args[0]);
                    } catch (e) {
                        outLog.push(e);
                    }

                    // Check if the specified code is available to edit
                    // If not, just add it in fresh
                    // If so, delte it then add it back
                    const exists = aw.allycodes.find(p => p.allyCode === ac);
                    if (!exists) {
                        let player;
                        try {
                            const players = await Bot.swgohAPI.unitStats(ac);
                            player = checkPlayer(players, user, {code: ac});
                        } catch (e) {
                            return super.error(message, "Error getting player info.\n" + e);
                        }
                        aw.allycodes.push({
                            allyCode: ac,
                            name:     player.name,
                            mention:  mention,
                            lastChar: player.arena.char ? player.arena.char.rank : null,
                            lastShip: player.arena.ship ? player.arena.ship.rank : null,
                            poOffset: player.poUTCOffsetMinutes
                        });
                    } else {
                        aw.allycodes = aw.allycodes.filter(p => p.allyCode !== ac);
                        exists.mention = mention;
                        aw.allycodes.push(exists);
                    }
                    outLog.push(ac + ` ${exists ? "updated" : "added"}!`);

                } else if (["remove", "delete"].includes(action)) {
                    // Remove an ally code to the list
                    code = code.replace(/[^\d]/g, "");
                    if (code.length != 9) {
                        return super.error(message, `Invalid code, there are ${code.length}/9 digits`);
                    }
                    code = parseInt(code, 10);
                    if (aw.allycodes.find(ac => ac.allyCode === code)) {
                        aw.allycodes = aw.allycodes.filter(ac => ac.allyCode !== code);
                        outLog.push(code + " has been removed");
                    } else {
                        return super.error(message, "That ally code was not available to be removed");
                    }
                } else {
                    // Invalid action?
                    return super.error(message, message.language.get("COMMAND_ARENAWATCH_INVALID_ACTION"));
                }
                break;
            }
            case "warn": {
                // ;aw warn 123123123 <# of min> <none|both|char|fleet>
                const code = args[0] ? parseInt(args[0].replace(/[^\d]/g, ""), 10) : null;
                if (!Bot.isAllyCode(code)) return super.error(message, `Invalid ally code (${code})`);

                let [, mins, arena] = args;
                const arenas = ["none", "both", "char", "fleet"];
                if (!arena && mins === "none") {
                    arena = "none";
                    mins = null;
                } else {
                    mins = parseInt(mins, 10);
                    arena = arena ? arena.toString().toLowerCase() : null;
                    if (!mins || mins <= 0) {
                        return super.error(message, "Invalid minute count. Only values of 1 and above are valid.", {example: "aw warn 123123123 30 both"});
                    }
                }

                if (!arena || !arenas.includes(arena)) {
                    return super.error(message, `Invalid arena. Valid options are: \`${arenas.join(", ")}\``, {example: "aw warn 123123123 30 both"});
                }

                const exists = aw.allycodes.find(p => parseInt(p.allyCode, 10) === code);
                if (!exists) return super.error(message, "That ally code is not in your list.");
                aw.allycodes = aw.allycodes.filter(p => parseInt(p.allyCode, 10) !== code);
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
                const code = args[0] ? parseInt(args[0].replace(/[^\d]/g, ""), 10) : null;
                if (!Bot.isAllyCode(code)) return super.error(message, `Invalid ally code (${code})`);

                let [, arena] = args;
                const arenas = ["none", "both", "char", "fleet"];
                arena = arena.toString().toLowerCase();

                if (!arena || !arenas.includes(arena)) {
                    return super.error(message, `Invalid arena. Valid options are: \`${arenas.join(", ")}\``, {example: "aw warn 123123123 30 both"});
                }
                const exists = aw.allycodes.find(p => p.allyCode === code);
                if (!exists) return super.error(message, "That ally code is not in your list.");
                aw.allycodes = aw.allycodes.filter(p => p.allyCode !== code);
                exists.result = arena === "none" ? null : arena;
                aw.allycodes.push(exists);
                break;
            }
            case "view": {
                // Show the current settings for this (Also maybe in ;uc, but a summarized version?)
                if (!args[0]) {
                    let charChan, fleetChan, charPayoutChan, fleetPayoutChan;
                    if (aw.arena.char.channel) {
                        charChan = message.guild ? message.guild.channels.cache.get(aw.arena.char.channel) : null;
                        if (!charChan) {
                            charChan = await message.client.shard.broadcastEval(`this.channels.cache.get('${aw.arena.char.channel}');`)
                                .then((thisChan) => {
                                    thisChan = thisChan.filter(a => !!a)[0];
                                    return thisChan ? `<#${thisChan.id}>` : "N/A";
                                });
                        }
                    }
                    if (aw.arena.fleet.channel) {
                        fleetChan = message.guild ? message.guild.channels.cache.get(aw.arena.fleet.channel) : null;
                        if (!fleetChan) {
                            fleetChan = await message.client.shard.broadcastEval(`this.channels.cache.get('${aw.arena.fleet.channel}');`)
                                .then((thisChan) => {
                                    thisChan = thisChan.filter(a => !!a)[0];
                                    return thisChan ? `<#${thisChan.id}>` : "N/A";
                                });
                        }
                    }
                    if (aw.payout.char.channel) {
                        charPayoutChan = message.guild ? message.guild.channels.cache.get(aw.payout.char.channel) : null;
                        if (!charPayoutChan) {
                            charPayoutChan = await message.client.shard.broadcastEval(`this.channels.cache.get('${aw.payout.char.channel}');`)
                                .then((thisChan) => {
                                    thisChan = thisChan.filter(a => !!a)[0];
                                    return thisChan ? `<#${thisChan.id}>` : "N/A";
                                });
                        }
                    }
                    if (aw.payout.fleet.channel) {
                        fleetPayoutChan = message.guild ? message.guild.channels.cache.get(aw.payout.fleet.channel) : null;
                        if (!fleetPayoutChan) {
                            fleetPayoutChan = await message.client.shard.broadcastEval(`this.channels.cache.get('${aw.payout.fleet.channel}');`)
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


                    return message.channel.send({embed: {
                        title: "Arena Watch Settings",
                        description: [
                            `Enabled:  **${aw.enabled ? "ON" : "OFF"}**`,
                            `Char:     **${(aw.arena.char.enabled  && aw.arena.char.channel)  ? "ON " : "OFF"}**  -  ${charChan}`,
                            `Ship:     **${(aw.arena.fleet.enabled && aw.arena.fleet.channel) ? "ON " : "OFF"}**  -  ${fleetChan}`,
                        ].join("\n"),
                        fields: [
                            {
                                name: `AllyCodes: (${aw.allycodes.length}/${codeCap})`,
                                value: `${ac.length ? ac.join("\n") : "**N/A**"}`
                            },
                            {
                                name: "**Payout Settings**",
                                value: [
                                    `Char:     **${(aw.payout.char.enabled  && aw.payout.char.channel)  ? "ON " : "OFF"}**  -  ${charPayoutChan}`,
                                    `Ship:     **${(aw.payout.fleet.enabled && aw.payout.fleet.channel) ? "ON " : "OFF"}**  -  ${fleetPayoutChan}`
                                ].join("\n")
                            }
                        ]
                    }});
                } else {
                    if (Bot.isAllyCode(args[0])) {
                        const ac = parseInt(args[0].replace(/[^\d]/g, ""), 10);
                        const player = aw.allycodes.find(p => parseInt(p.allyCode, 10) === parseInt(ac, 10));
                        if (!player) return super.error(message, "I cannot find that player in your list.");
                        return message.channel.send({embed: {
                            title: `Arena Watch Settings (${ac})`,
                            description: [
                                `Name: **${player.name}**`,
                                `Mention: **${player.mention ? "<@" + player.mention + ">" : "N/A"}**`,
                                `Payout Result: **${player.result ? player.result : "N/A"}**`,
                                `Warn Mins: **${player.warn ? player.warn.min : "N/A"}**`,
                                `Warn Arena: **${player.warn ? player.warn.arena : "N/A"}**`
                            ].join("\n")
                        }});
                    }
                }
                break;
            }
            default:
                return super.error(message, message.language.get("COMMAND_ARENAWATCH_INVALID_OPTION"));
        }
        if (target !== "view") {
            user.arenaWatch = aw;
            await Bot.userReg.updateUser(userID, user);
        }
        return super.error(message, outLog.length ? outLog.join("\n") : message.language.get("COMMAND_ARENAALERT_UPDATED") + (cmdOut ? "\n\n#####################\n\n" + cmdOut : ""), {title: " ", color: "#0000FF"});
    }
}


module.exports = ArenaWatch;
