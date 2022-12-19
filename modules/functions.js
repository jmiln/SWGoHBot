const { WebhookClient, ChannelType } = require("discord.js");
const { PermissionsBitField  } = require("discord.js");
const moment = require("moment-timezone");
require("moment-duration-format");
const {promisify, inspect} = require("util");     // eslint-disable-line no-unused-vars
const fs = require("fs");
const readdir = promisify(require("fs").readdir);
const DEBUG = false;

module.exports = (Bot, client) => {
    Bot.constants = {
        // The main invite for the support server
        invite: "https://discord.com/invite/FfwGvhr",

        // Zero width space
        zws: "\u200B",

        // Some normal color codes
        colors: {
            black:     0,
            blue:      255,
            lightblue: 22015,
            green:     65280,
            red:       16711680,
            brightred: 14685204,
            white:     16777215,
            yellow:    16776960,
        },
        // Permissions mapping
        permMap: {
            // Can do anything, access to the dev commands, etc
            BOT_OWNER: 10,

            // Can help out with the bot as needed, some extra stuff possibly
            HELPER: 8,

            // Owner of the server a command is being run in
            GUILD_OWNER: 7,

            // Has ADMIN or MANAGE_GUILD, or has one of the
            // configured roles from the guild's settings
            GUILD_ADMIN: 6,

            // Base users, anyone that's not included above
            BASE_USER: 0
        },
        OmicronMode: [
            "OmicronMode_DEFAULT",
            "ALLOMICRON",
            "PVEOMICRON",
            "PVPOMICRON",
            "GUILDRAIDOMICRON",
            "TERRITORYSTRIKEOMICRON",       // Huh?
            "TERRITORYCOVERTOMICRON",       // Huh?
            "TERRITORYBATTLEBOTHOMICRON",
            "TERRITORYWAROMICRON",
            "TERRITORYTOURNAMENTOMICRON",   // Huh?
            "WAROMICRON0",                  // Idk
            "CONQUESTOMICRON1",
            "GALACTICCHALLENGEOMICRON2",
            "PVEEVENTOMICRON3",
            "TERRITORYTOURNAMENT3OMICRON4", // Who knows
            "TERRITORYTOURNAMENT5OMICRON5"  // Who knows
        ]
    };

    // Get a color for embed edges
    Bot.getSideColor = (side) => {
        if (!side) return Error("[func/getSideColor] Missing side.");
        if (!["light", "dark"].includes(side.toLowerCase())) return Error("[func/getSideColor] Missing side.");
        return side === "light" ? Bot.constants.colors.lightblue : Bot.constants.colors.brightred;
    };


    /*  PERMISSION LEVEL FUNCTION
     *  This is a very basic permission system for commands which uses "levels"
     *  "spaces" are intentionally left blank so you can add them if you want.
     *  NEVER GIVE ANYONE BUT OWNER THE LEVEL 10! By default this can run any
     *  command including the VERY DANGEROUS `eval` and `exec` commands!
     */
    Bot.permLevel = async (interaction) => {
        // Depending on message or interaction, grab the ID of the user
        const permMap = Bot.constants.permMap;
        const authId = interaction.author ? interaction.author.id : interaction.user.id;

        // If bot owner, return max perm level
        if (authId === Bot.config.ownerid) {
            return permMap.BOT_OWNER;
        }

        // If DMs or webhook, return 0 perm level.
        if (!interaction.guild || !interaction.member) {
            return permMap.BASE_USER;
        }
        const guildConf = interaction.guildSettings;

        // Guild Owner gets an extra level, wooh!
        const gOwner = await interaction.guild.fetchOwner();
        if (interaction.channel?.type === ChannelType.GuildText && interaction.guild && gOwner) {
            // message.author for text message, message.user for interactions
            if (interaction.user?.id === gOwner.id) {
                return permMap.GUILD_OWNER;
            }
        }

        // Also giving them the permissions if they have the manage server role,
        // since they can change anything else in the server, so no reason not to
        if (interaction.member.permissions.has([PermissionsBitField.Flags.Administrator]) || interaction.member.permissions.has([PermissionsBitField.Flags.ManageGuild])) {
            return permMap.GUILD_ADMIN;
        }

        // The rest of the perms rely on roles. If those roles are not found
        // in the settings, or the user does not have it, their level will be 0
        try {
            const adminRoles = guildConf.adminRole;

            for (var ix = 0, len = adminRoles.length; ix < len; ix++) {
                const adminRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === adminRoles[ix].toLowerCase() || r.id === adminRoles[ix]);
                if (adminRole && interaction.member.roles.cache.has(adminRole.id)) {
                    return permMap.GUILD_ADMIN;
                }
            }
        } catch (e) {() => {};}
        return permMap.BASE_USER;
    };

    // Check if the bot's account is the main (real) bot
    Bot.isMain = () => {
        if (client.user.id === "315739499932024834") return true;
        return false;
    };

    // Default formatting for current US/Pacific time
    Bot.myTime = () => {
        return moment.tz("US/Pacific").format("M/D/YYYY h:mma");
    };

    // This finds any character that matches the search, and returns them in an array
    Bot.findChar = (searchName, charList, ship=false) => {
        if (!searchName?.length || typeof searchName !== "string") {
            return [];
        }
        searchName = searchName.toLowerCase();

        // Try for an actual exact match first
        let foundChar = charList.filter(char => char.name.toLowerCase() === searchName);
        if (foundChar?.length) {
            return foundChar;
        }

        // Clean out extra spaces and improper apostrophes
        searchName = searchName
            .replace(/’/g, "'")
            .trim();

        // Try finding an exact match for the name or aliases
        foundChar = charList.filter(char => char.name.toLowerCase() === searchName);
        if (!foundChar.length) {
            foundChar = charList.filter(char => char.aliases.some(alias => alias.toLowerCase() === searchName));
        }
        if (ship && !foundChar.length) {
            foundChar = charList.filter(ship => ship.crew?.some(crew => crew.toLowerCase() === searchName));
        }
        if (foundChar?.length) {
            return foundChar;
        }

        // Then see if the searchName is a part of one of the names or aliases
        foundChar = charList.filter(char => char.name.toLowerCase().split(" ").includes(searchName));
        if (!foundChar.length) {
            foundChar = charList.filter(char => char.aliases.some(alias => alias.toLowerCase().split(" ").includes(searchName)));
        }
        if (ship && !foundChar.length) {
            foundChar = charList.filter(ship => ship.crew?.some(crew => crew.toLowerCase().split(" ").includes(searchName)));
        }
        if (foundChar?.length) {
            return foundChar;
        }

        // Then try to split up the search by spaces, and see if any part of that finds any matches
        const splitName = searchName.split(" ");
        foundChar = charList.filter(char => splitName.some(name => char.name.toLowerCase().includes(name)));
        if (foundChar?.length) {
            return foundChar;
        }

        // If by here, it hasn't found any matching character or ship, return an empty array
        return [];
    };

    // Parse the webhook url, and get the id & token from the end
    function parseWebhook(url) {
        const webhookCredentials = url.split("/").slice(-2);
        return {
            id: webhookCredentials[0],
            token: webhookCredentials[1]
        };
    }

    // Send a message to a webhook url, takes the url & the embed to send
    Bot.sendWebhook = (hookUrl, embed) => {
        const h = parseWebhook(hookUrl);
        const hook = new WebhookClient({id: h.id, token: h.token});
        hook.send({embeds: [
            embed
        ]}).catch(() => {});
    };

    /* ANNOUNCEMENT MESSAGE
     * Sends a message to the set announcement channel
     */
    client.announceMsg = async (guild, announceMsg, channel="", guildConf={}) => {
        if (!guild?.id) return;

        // Use the guildConf announcement channel
        let announceChan = guildConf.announceChan || "";

        // But if there's a channel specified for this, use that instead
        if (channel && channel !== "") {
            announceChan = channel;
        }

        // Try and get the channel by ID first
        let chan = guild.channels.cache.get(announceChan.toString().replace(/[^0-9]/g, ""));

        // If  that didn't work, try and get it by name
        if (!chan) {
            chan = guild.channels.cache.find(c => c.name === announceChan);
        }

        // If that still didn't work, or if it doesn't have the base required perms, return
        if (!chan?.send || !chan?.permissionsFor(guild.members.me).has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])) {
            // TODO Should probably log this / tell users about the issue somehow?
            return;
            // return console.error(`[AnnounceMsg] I was not able to send a msg in guild ${guild.name} (${guild.id}) \nMsg: ${announceMsg}\nConf: ${inspect(guildConf)}`);
        } else {
            // If everything is ok, go ahead and try sending the message
            await chan.send(announceMsg).catch((err) => {
                // if (err.stack.toString().includes("user aborted a request")) return;
                console.error(`Broke sending announceMsg: ${err.stack} \nGuildID: ${guild.id} \nChannel: ${channel || guildConf?.announceChan}\nMsg: ${announceMsg}\n` );
            });
        }
    };

    client.unloadSlash = commandName => {
        if (client.slashcmds.has(commandName)) {
            const command = client.slashcmds.get(commandName);
            client.slashcmds.delete(command);
            delete require.cache[require.resolve(`../slash/${command.commandData.name}.js`)];
        }
        return;
    };
    client.loadSlash = commandName => {
        try {
            const cmd = new (require(`../slash/${commandName}`))(Bot);
            if (!cmd.commandData.enabled) {
                return commandName + " is not enabled";
            }
            client.slashcmds.set(cmd.commandData.name, cmd);
            return false;
        } catch (e) {
            return `Unable to load command ${commandName}: ${e}`;
        }
    };
    client.reloadSlash = async (commandName) => {
        let response = client.unloadSlash(commandName);
        if (response) {
            return new Error(`Error Unloading: ${response}`);
        } else {
            response = client.loadSlash(commandName);
            if (response) {
                return new Error(`Error Loading: ${response}`);
            }
        }
        return commandName;
    };

    // Reloads all slash commads (even if they were not loaded before)
    // Will not remove a command if it's been loaded,
    // but will load a new command if it's been added
    client.reloadAllSlashCommands = async () => {
        [...client.slashcmds.keys()].forEach(c => {
            client.unloadSlash(c);
        });
        const cmdFiles = await readdir("./slash/");
        const coms = [], errArr = [];
        cmdFiles.forEach(async (f) => {
            try {
                const cmd = f.split(".")[0];
                if (f.split(".").slice(-1)[0] !== "js") {
                    errArr.push(f);
                } else {
                    const res = client.loadSlash(cmd);
                    if (!res) {
                        coms.push(cmd);
                    } else {
                        errArr.push(f);
                    }
                }
            } catch (e) {
                Bot.logger.error("Error: " + e);
                errArr.push(f);
            }
        });
        return {
            succArr: coms,
            errArr: errArr
        };
    };

    // Reload the events files (message, guildCreate, etc)
    client.reloadAllEvents = async () => {
        const ev = [], errEv = [];

        const evtFiles = await readdir("./events/");
        evtFiles.forEach(file => {
            try {
                const eventName = file.split(".")[0];
                client.removeAllListeners(eventName);
                const event = require(`../events/${file}`);
                if (["error", "ready", "interactionCreate", "messageCreate", "guildMemberAdd", "guildMemberRemove"].includes(eventName)) {
                    client.on(eventName, event.bind(null, Bot, client));
                } else {
                    client.on(eventName, event.bind(null, Bot));
                }
                delete require.cache[require.resolve(`../events/${file}`)];
                ev.push(eventName);
            } catch (e) {
                Bot.logger.error("In Event reload: " + e);
                errEv.push(file);
            }
        });
        return {
            succArr: ev,
            errArr: errEv
        };
    };

    // Reload the functions (this) file
    client.reloadFunctions = async () => {
        try {
            delete require.cache[require.resolve("../modules/functions.js")];
            require("../modules/functions.js")(Bot, client);
            delete require.cache[require.resolve("../modules/patreonFuncs.js")];
            require("../modules/patreonFuncs.js")(Bot, client);
            delete require.cache[require.resolve("../modules/eventFuncs.js")];
            require("../modules/eventFuncs.js")(Bot, client);
            delete require.cache[require.resolve("../modules/Logger.js")];
            delete Bot.logger;
            const Logger = require("../modules/Logger.js");
            Bot.logger = new Logger(Bot, client);
        } catch (err) {
            return {err: err.stack};
        }
    };

    // Reload the swapi file
    client.reloadSwapi = async () => {
        let err = null;
        try {
            delete require.cache[require.resolve("../modules/swapi.js")];
            Bot.swgohAPI = require("../modules/swapi.js")(Bot);
        } catch (e) {
            err = e;
        }
        return err;
    };

    // Reload the users file
    client.reloadUserReg = async () => {
        let err = null;
        try {
            delete require.cache[require.resolve("../modules/users.js")];
            Bot.userReg = require("../modules/users.js")(Bot);
        } catch (e) {
            err = e;
        }
        return err;
    };

    // Reload the data files (ships, teams, characters)
    client.reloadDataFiles = async () => {
        try {
            Bot.abilityCosts = await JSON.parse(fs.readFileSync("data/abilityCosts.json", "utf-8"));
            Bot.acronyms     = await JSON.parse(fs.readFileSync("data/acronyms.json", "utf-8"));
            Bot.arenaJumps   = await JSON.parse(fs.readFileSync("data/arenaJumps.json", "utf-8"));
            Bot.characters   = await JSON.parse(fs.readFileSync("data/characters.json", "utf-8"));
            Bot.charLocs     = await JSON.parse(fs.readFileSync("data/charLocations.json", "utf-8"));
            Bot.missions     = await JSON.parse(fs.readFileSync("data/missions.json", "utf-8"));
            Bot.resources    = await JSON.parse(fs.readFileSync("data/resources.json", "utf-8"));
            Bot.ships        = await JSON.parse(fs.readFileSync("data/ships.json", "utf-8"));
            Bot.shipLocs     = await JSON.parse(fs.readFileSync("data/shipLocations.json", "utf-8"));
            Bot.squads       = await JSON.parse(fs.readFileSync("data/squads.json", "utf-8"));
            const gameData   = await JSON.parse(fs.readFileSync("data/gameData.json", "utf-8"));
            Bot.statCalculator.setGameData(gameData);
        } catch (err) {
            return {err: err.stack};
        }
    };

    // Reload all the language files
    client.reloadLanguages = async () => {
        let err = false;
        try {
            Object.keys(Bot.languages).forEach(lang => {
                delete Bot.languages[lang];
            });
            const langFiles = await readdir(`${process.cwd()}/languages/`);
            langFiles.forEach(file => {
                const langName = file.split(".")[0];
                const lang = require(`${process.cwd()}/languages/${file}`);
                Bot.languages[langName] = new lang(Bot);
                delete require.cache[require.resolve(`${process.cwd()}/languages/${file}`)];
            });
        } catch (e) {
            err = e;
        }
        return err;
    };

    /* SINGLE-LINE AWAITMESSAGE
     * A simple way to grab a single reply, from the user that initiated
     * the command. Useful to get "precisions" on certain things...
     * USAGE
     * const response = await Bot.awaitReply(msg, "Favourite Color?");
     * msg.reply(`Oh, I really love ${response} too!`);
     */
    Bot.awaitReply = async (msg, question, limit = 60000) => {
        const filter = m => m.author.id === msg.author.id;
        await msg.channel.send({content: question}).catch(() => {Bot.logger.error("Broke in awaitReply");});
        try {
            const collected = await msg.channel.awaitMessages(filter, {max: 1, time: limit, errors: ["time"]});
            return collected.first().content;
        } catch (e) {
            return false;
        }
    };

    // String Truncate function
    // Bot.truncate = (string, len, terminator="...") => {
    //     const termLength = terminator.length;
    //
    //     if (string.length > len) {
    //         return string.substring(0, len - termLength) + terminator;
    //     } else {
    //         return string;
    //     }
    // };

    /* MESSAGE CLEAN FUNCTION
     * "Clean" removes @everyone pings, as well as tokens, and makes code blocks
     * escaped so they're shown more easily. As a bonus it resolves promises
     * and stringifies objects!
     * This is mostly only used by the Eval and Exec commands.
     */
    // Bot.clean = async (client, text) => {
    //     if (text && text.constructor.name == "Promise")
    //         text = await text;
    //     if (typeof evaled !== "string")
    //         text = inspect(text, {
    //             depth: 0
    //         });
    //
    //     text = text
    //         .replace(/`/g, "`" + String.fromCharCode(8203))
    //         .replace(/@/g, "@" + String.fromCharCode(8203))
    //         .replace(client.token, "mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0");
    //
    //     return text;
    // };

    /* MISCELANEOUS NON-CRITICAL FUNCTIONS */

    // `await wait(1000);` to "pause" for 1 second.
    Bot.wait = promisify(setTimeout);

    /*  MESSAGE SPLITTER
     *  Input an array of strings, and it will put them together so that it
     *  doesn't exceed the given max length.
     */
    Bot.msgArray = (arr, join="\n", maxLen=1900) => {
        const messages = [];
        if (!Array.isArray(arr)) arr = arr.toString().split("\n");
        arr.forEach((elem) => {
            elem = Bot.expandSpaces(elem);
            if (typeof elem !== "string") Bot.logger.error("In msgArray, " + elem + " Is not a string!");
            // Check if something big somehow got in
            if (elem.length > maxLen) {
                throw new Error("[MsgArray] Element too big! " + elem);
            }
            if  (messages.length === 0) {
                messages.push(elem);
            } else {
                const lastMsgLen = messages[messages.length - 1].length;
                if ((lastMsgLen + elem.length) > maxLen) {
                    messages.push(elem);
                } else {
                    messages[messages.length - 1] = messages[messages.length - 1] + join + elem;
                }
            }
        });
        return messages;
    };

    /* CODE BLOCK MAKER
     * Makes a codeblock with the specified lang for highlighting.
     */
    Bot.codeBlock = (str, lang="") => {
        return `\`\`\`${lang}\n${str}\`\`\``;
    };

    // Return a duration string
    Bot.duration = (time, message=null) => {
        const lang = message ? message.language : Bot.languages[Bot.config.defaultSettings.language];
        return moment.duration(Math.abs(moment(time).diff(moment()))).format(`d [${lang.getTime("DAY", "PLURAL")}], h [${lang.getTime("HOUR", "SHORT_PLURAL")}], m [${lang.getTime("MINUTE", "SHORT_SING")}]`);
    };

    /* LAST UPDATED FOOTER
     * Simple one to make the "Last updated ____ " footers
     */
    Bot.updatedFooter = (updated, message=null, type="player", userCooldown) => {
        const baseCooldown = { player: 2, guild: 6 };
        const minCooldown = { player: 1, guild: 3 };

        const lang = message?.language || Bot.languages["eng_us"];

        if (!userCooldown) userCooldown = baseCooldown;
        const timeDiff = new Date().getTime() - new Date(updated).getTime();
        const betweenMS = Bot.convertMS(timeDiff);

        let betweenStr = "";
        if (betweenMS.hour >= minCooldown[type] && betweenMS.hour < userCooldown[type]) {
            // If the data is between the shorter time they'd get from patreon, and the
            // time they'd get without, stick the patreon link in the footer
            betweenStr = " | patreon.com/swgohbot";
        }
        return {
            text: lang.get("BASE_SWGOH_LAST_UPDATED", Bot.duration(updated, message)) + betweenStr
        };
    };

    // Get the current user count
    Bot.userCount = async () => {
        let users = 0;
        if (client.shard && client.shard.count > 0) {
            await client.shard.fetchClientValues("users.cache.size")
                .then(results => {
                    users =  results.reduce((prev, val) => prev + val, 0);
                })
                .catch(console.error);
            return users;
        } else {
            return client.users.cache.size;
        }
    };

    // Get the current guild count
    Bot.guildCount = async () => {
        let guilds = 0;
        if (client.shard) {
            await client.shard.fetchClientValues("guilds.cache.size")
                .then(results => {
                    guilds =  results.reduce((prev, val) => prev + val, 0);
                })
                .catch(console.error);
            return guilds;
        } else {
            return client.guilds.cache.size;
        }
    };

    /* isUserID
     * Check if a string of numbers is a valid user.
     */
    Bot.isUserID = (numStr) => {
        if (!numStr || !numStr.length) return false;
        const match = /(?:\\<@!?)?([0-9]{17,20})>?/gi.exec(numStr);
        return match ? true : false;
    };

    /* getUserID
     * Get a valid Discord id string from a given string.
     */
    Bot.getUserID = (numStr) => {
        if (!numStr || !numStr.length) return null;
        const match = /(?:\\<@!?)?([0-9]{17,20})>?/gi.exec(numStr);
        if (match) {
            return numStr.replace(/[^0-9]/g, "");
        }
        return null;
    };

    /* isAllyCode
     * Check if a string of numbers is a valid ally code.
     * Needs to be a string of 9 numbers
     */
    Bot.isAllyCode = (aCode) => {
        if (!aCode || !aCode.toString().length) return false;
        const match = aCode.toString().replace(/[^\d]*/g, "").match(/^\d{9}$/);
        return match ? true : false;
    };

    /* makeTable
     * Makes a table-like format given an array of objects
     *
     * headers: object of columnName: columnHeader
     *  (columnHeader is empty string if you want it not in a codeBlock)
     *  {
     *      columnKey: {
     *          value: "",
     *          startWith: "",
     *          endWith: "",
     *          align: "center"     (Also supports left & right)
     *      }
     *  }
     * rows: The data to fill in
     */
    Bot.makeTable = (headers, rows, options={
        boldHeader: true,
        useHeader:  true
    }) => {
        if (!headers || !rows?.length) throw new Error("Need both headers and rows");
        const max = {};
        Object.keys(headers).forEach(h => {
            // Get the max length needed, then add a bit for padding
            if (options.useHeader) {
                // console.log(h, rows);
                max[h] = Math.max(...[headers[h].value.length].concat(rows.map(v => v[h].toString().length))) + 2;
            } else {
                max[h] = Math.max(...rows.map(v => {
                    if (!v[h]) return 0;
                    return v[h].toString().length;
                })) + 2;
            }
        });

        let header = "";
        const out = [];

        if (options.useHeader) {
            Object.keys(headers).forEach(h => {
                const headerMax = max[h];
                const head = headers[h];
                if (head && head.value.length) {
                    const pad = headerMax - head.value.length;
                    const padBefore = Math.floor(pad/2);
                    const padAfter = pad-padBefore;
                    header += head.startWith ? head.startWith : "";
                    if (padBefore) header += " ".repeat(padBefore);
                    header += head.value;
                    if (padAfter) header  += " ".repeat(padAfter);
                    header += head.endWith ? head.endWith : "";
                } else {
                    header += head.startWith ? head.startWith : "";
                    header += " ".repeat(headerMax);
                    header += head.endWith ? head.endWith : "";
                }
            });
            if (options.boldHeader) {
                out.push(Bot.expandSpaces("**" + header + "**"));
            } else {
                out.push(Bot.expandSpaces(header));
            }
        }
        rows.forEach(r => {
            let row = "";
            Object.keys(headers).forEach((header, ix) => {
                const rowMax = max[header];
                const head = headers[header];
                let value = r[header];
                if (!value) value = 0;
                const pad = rowMax - value.toString().length;
                row += head.startWith ? head.startWith : "";
                if (!head.align || (head.align && head.align === "center")) {
                    const padBefore = Math.floor(pad/2);
                    const padAfter = pad-padBefore;
                    if (padBefore) row += " ".repeat(padBefore);
                    row += value;
                    if (padAfter) row  += " ".repeat(padAfter);
                } else if (head.align === "left" && ix === 0 && !head.startWith) {
                    row += value + " ".repeat(pad-1);
                } else if (head.align === "left") {
                    row += " " + value + " ".repeat(pad-1);
                } else if (head.align === "right") {
                    row += " ".repeat(pad-1) + value + " ";
                } else {
                    throw new Error("Invalid alignment");
                }
                row += head.endWith ? head.endWith : "";
            });
            out.push(Bot.expandSpaces(row.replace(/\s*$/, "")));
        });

        return out;
    };

    // Small function to search the factions
    Bot.findFaction = (fact) => {
        fact = fact.toLowerCase().replace(/\s+/g, "");
        let found = Bot.factions.find(f => f.toLowerCase().replace(/\s+/g, "") === fact);
        if (found) {
            return found.toLowerCase();
        }
        found = Bot.factions.find(f => f.toLowerCase().replace(/\s+/g, "") === fact.substring(0, fact.length-1));
        if (fact.endsWith("s") && found) {
            return found.toLowerCase();
        }
        found = Bot.factions.find(f => f.toLowerCase().replace(/\s+/g, "") === fact + "s");
        if (!fact.endsWith("s") && found) {
            return found.toLowerCase();
        }
        const close = Bot.factions.filter(f => f.toLowerCase().replace(/\s+/g, "").includes(fact.toLowerCase()));
        if (close.length) {
            return close.map(f => f.toLowerCase());
        }

        return false;
    };

    // Expand multiple spaces to have zero width spaces between them so
    // Discord doesn't collapse em
    Bot.expandSpaces = (str) => {
        let outStr = "";
        str.split(/([\s]{2,})/).forEach(e => {
            if (e.match(/[\s]{2,}/)) {
                outStr += e.split("").join("\u200B");
            } else {
                outStr += e;
            }
        });
        return outStr;
    };

    // Get the ally code of someone that's registered
    Bot.getAllyCode = async (message, user, useMessageId=true) => {
        const otherCodeRegex = /^-\d{1,2}$/;
        if (Array.isArray(user)) user = user.join(" ");
        if (user) {
            user = user.toString().trim();
        } else {
            user = "";
        }

        let userAcct = null;
        if (user === "me" || user.match(otherCodeRegex) || (!user && useMessageId)) {
            // Grab the sender's primary code
            if (message.author) {
                // Message.author for messages
                userAcct = await Bot.userReg.getUser(message.author.id);
            } else {
                // Message.user for interactions
                userAcct = await Bot.userReg.getUser(message.user.id);
            }
        } else if (Bot.isUserID(user)) {
            // Try to grab the primary code for the mentioned user
            userAcct = await Bot.userReg.getUser(user.replace(/[^\d]*/g, ""));
        }  else if (Bot.isAllyCode(user)) {
            // Otherwise, just scrap everything but numbers, and send it back
            return user.replace(/[^\d]*/g, "");
        }

        if (userAcct?.accounts?.length) {
            let account = null;
            if (user?.match(otherCodeRegex)) {
                // If it's a -1/ -2 code, try to grab the specified code
                const index = parseInt(user.replace("-", ""), 10) - 1;
                account = userAcct.accounts[index];
            } else {
                // If it's a missing allycode, a "me", or for a specified discord ID, just grab the primary if available
                account = userAcct.accounts.find(a => a.primary);
            }
            return account ? account.allyCode : null;
        } else {
            return null;
        }
    };

    // Convert from milliseconds
    Bot.convertMS = (milliseconds) => {
        var hour, totalMin, minute, seconds;
        seconds = Math.floor(milliseconds / 1000);
        totalMin = Math.floor(seconds / 60);
        seconds = seconds % 60;
        hour = Math.floor(totalMin / 60);
        minute = totalMin % 60;
        return {
            hour: hour,
            minute: minute,
            totalMin: totalMin,
            seconds: seconds
        };
    };

    // Return a divider of equals signs
    Bot.getDivider = (count, divChar="=") => {
        if (count <= 0) throw new Error("Invalid count value");
        if (typeof divChar !== "string") throw new Error("divChar must be a string!");
        return divChar.repeat(count);
    };

    // Clean mentions out of messages and replace them with the text version
    Bot.cleanMentions = (guild, input) => {
        return input
            .replace(/@(here|everyone)/g, `@${Bot.constants.zws}$1`)
            .replace(/<(@[!&]?|#)(\d{17,19})>/g, (match, type, id) => {
                switch (type) {
                    case "@":
                    case "@!": {
                        const  user = guild.members.cache.get(id);
                        return user ? `@${user.displayname}` : `<${type}${Bot.constants.zws}${id}>`;
                    }
                    case "@&": {
                        const  role = guild.roles.cache.get(id);
                        return role ? `@${role.name}` : match;
                    }
                    case "#": {
                        const  channel  = guild.channels.cache.get(id);
                        return channel ? `#${channel.name}` : `<${type}${Bot.constants.zws}${id}>`;
                    }
                    default: return `<${type}${Bot.constants.zws}${id}>`;
                }
            });
    };

    Bot.isChannelId = (mention) => {
        const channelRegex = /^\d{17,19}/;
        return mention.match(channelRegex);
    };
    Bot.isChannelMention = (mention) => {
        const channelRegex = /^<#\d{17,19}>/;
        return mention.match(channelRegex);
    };
    Bot.isRoleMention = (mention) => {
        const roleRegex = /^<@&\d{17,19}>/;
        return mention.match(roleRegex);
    };
    Bot.isUserMention = (mention) => {
        const userRegex = /^<@!?\d{17,19}>/;
        return mention.match(userRegex);
    };
    Bot.chunkArray = (inArray, chunkSize) => {
        var res = [];
        if (!Array.isArray(inArray)) inArray = [inArray];
        for (let ix = 0, len = inArray.length; ix < len; ix += chunkSize) {
            res.push(inArray.slice(ix, ix + chunkSize));
        }
        return res;
    };

    // Returns a gear string (9+4 or 13r5), etc
    Bot.getGearStr = (charIn, preStr="") => {
        // If the character is not unlocked
        if (!charIn?.gear) return "N/A";

        let charGearOut = preStr + charIn.gear.toString();
        if (charIn.equipped?.length) {
            charGearOut += `+${charIn.equipped.length}`;
        } else if (charIn?.relic?.currentTier > 2) {
            charGearOut += `r${charIn.relic.currentTier-2}`;
        }
        return charGearOut;
    };

    // Get the overall levels for a guild as a whole (Gear, rarity, relic, etc)
    Bot.summarizeCharLevels = (guildMembers, type) => {
        const max = {
            gear: 13,
            relic: 9,
            rarity: 7
        };
        if (!Object.keys(max).includes(type)) return new Error(`[summarizeLevels] Invalid type (${type})`);
        if (!Array.isArray(guildMembers)) guildMembers = [guildMembers];

        const levels = {};
        for (let ix = max[type]; ix >= 1; ix--) {
            let lvlCount = 0;
            for (const member of guildMembers) {
                if (type === "relic") {
                    lvlCount += member.roster.filter(c => c?.combatType === 1 && c.relic?.currentTier-2 === ix).length;
                } else {
                    lvlCount += member.roster.filter(c => c?.combatType === 1 && c[type] === ix).length;
                }
            }
            if (lvlCount > 0) {
                levels[ix] = lvlCount;
            }
        }
        const tieredLvl = Object.keys(levels).reduce((acc, curr) => acc + (levels[curr] * parseInt(curr, 10)), 0);
        const totalLvl = Object.keys(levels).reduce((acc, curr) => acc + levels[curr], 0);
        const avgLvls = (tieredLvl / totalLvl).toFixed(2);

        return [levels, avgLvls];
    };

    Bot.toProperCase = function(strIn) {
        return strIn.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    };

    // Trim down large numbers to be more easily readable
    Bot.shortenNum = function(number, trimTo=2) {
        const million = 1000000, thousand = 1000;

        if (number >= million) {
            number = (number / million);
            return trimFloat(number, trimTo) + "M";
        } else if (number >= thousand) {
            number = (number / thousand);
            return trimFloat(number, trimTo) + "K";
        }
    };

    // Helper for shortenNum,
    // Trims a fload down to either 0 or 1 (by default) decimal points
    function trimFloat(num, dec=1) {
        if (num % 1 === 0) {
            return num.toString();
        } else {
            return num.toFixed(dec);
        }
    }

    // Get the guildsettings from the mongo db
    Bot.getGuildSettings = async (guildId) => {
        if (!guildId) {
            return Bot.config.defaultSettings;
        }
        let guildSettings = await Bot.cache.get(Bot.config.mongodb.swgohbotdb, "guildSettings", {guildId: guildId});
        if (Array.isArray(guildSettings)) guildSettings = guildSettings[0];
        return {...Bot.config.defaultSettings, ...guildSettings};
    };
    // Set any guildSettings that do not match the defaultSettings in the bot's config
    Bot.setGuildSettings = async (guildId, settings) => {
        // Filter out any settings that are the same as the defaults
        const diffObj = {
            guildId: guildId
        };

        for (const key of Object.keys(Bot.config.defaultSettings)) {
            const configVal = Bot.config.defaultSettings[key];
            if (Array.isArray(configVal)) {
                if (!arrayEquals(configVal, settings[key])) {
                    diffObj[key] = settings[key];
                }
            } else if (Bot.config.defaultSettings[key] !== settings[key]) {
                diffObj[key] = settings[key];
            }
        }

        if (Object.keys(diffObj).length === 1) {
            // In this case, there's nothing different than the default, so go ahead and remove it
            return await Bot.deleteGuildSettings(guildId);
        }
        return await Bot.cache.replace(Bot.config.mongodb.swgohbotdb, "guildSettings", {guildId: guildId}, diffObj, false);
    };

    // Check if there are settings for the guild
    Bot.hasGuildSettings = async (guildId) => {
        const guildSettings = await Bot.cache.get(Bot.config.mongodb.swgohbotdb, "guildSettings", {guildId: guildId});
        if (guildSettings) {
            return true;
        } else {
            return false;
        }
    };
    // Remove any settings for the given guild
    Bot.deleteGuildSettings = async (guildId) => {
        const res = await Bot.cache.remove(Bot.config.mongodb.swgohbotdb, "guildSettings", {guildId: guildId});
        return res;
    };

    // Deploy commands
    Bot.deployCommands = async () => {
        const outLog = [];

        if (Bot.config.dev_server) {
            try {
                // Filter the slash commands to find guild only ones.
                const guildCmds = client.slashcmds.filter(c => c.guildOnly).map(c => c.commandData);

                // The currently deployed commands
                let currentGuildCommands = await client.shard.broadcastEval(async (client, {guildId}) => {
                    const targetGuild = await client.guilds.cache.get(guildId)?.commands.fetch();
                    if (targetGuild) {
                        return targetGuild;
                    }
                }, {context: {
                    guildId: Bot.config.dev_server
                }});
                if (currentGuildCommands?.length) currentGuildCommands = currentGuildCommands.filter(curr => !!curr)[0];
                const { newComs: newGuildComs, changedComs: changedGuildComs } = checkCmds(guildCmds, currentGuildCommands);

                // We'll use set but please keep in mind that `set` is overkill for a singular command.
                // Set the guild commands like this.

                // The new guild commands
                if (newGuildComs.length) {
                    for (const newGuildCom of newGuildComs) {
                        console.log(`Adding ${newGuildCom.name} to Guild commands`);
                        await client.guilds.cache.get(Bot.config.dev_server)?.commands.create(newGuildCom);
                    }
                    outLog.push({
                        name: "**Added Guild**",
                        value: newGuildComs?.length ? newGuildComs.map(newCom => ` * ${newCom.name}`).join("\n") : "N/A"
                    });
                }
                // The edited guild commands
                if (changedGuildComs.length) {
                    for (const diffGuildCom of changedGuildComs) {
                        console.log(`Updating ${diffGuildCom.com.name} in Guild commands`);
                        await client.guilds.cache.get(Bot.config.dev_server)?.commands.edit(diffGuildCom.id, diffGuildCom.com);
                    }
                    outLog.push({
                        name: "**Changed Guild**",
                        value: changedGuildComs?.length ? changedGuildComs.map(diffCom => ` * ${diffCom.com.name}`).join("\n") : "N/A"
                    });
                }


                if (Bot.config.enableGlobalCmds) {
                    // Then filter out global commands by inverting the filter
                    const globalCmds = client.slashcmds.filter(c => !c.guildOnly).map(c => c.commandData);
                    // Get the currently deployed global commands
                    const currentGlobalCommands = await client.application?.commands?.fetch();

                    const { newComs: newGlobalComs, changedComs: changedGlobalComs } = checkCmds(globalCmds, currentGlobalCommands);

                    // The new global commands
                    if (newGlobalComs.length) {
                        for (const newGlobalCom of newGlobalComs) {
                            console.log(`Adding ${newGlobalCom.name} to Global commands`);
                            await client.application?.commands.create(newGlobalCom);
                        }
                        outLog.push({
                            name: "**Added Global**",
                            value: newGlobalComs?.length ? newGlobalComs.map(newCom => ` * ${newCom.name}`).join("\n") : "N/A"
                        });
                    }

                    // The edited global commands
                    if (changedGlobalComs.length) {
                        for (const diffGlobalCom of changedGlobalComs) {
                            console.log(`Updating ${diffGlobalCom.com.name} in Global commands`);
                            await client.application?.commands.edit(diffGlobalCom.id, diffGlobalCom.com);
                        }
                        outLog.push({
                            name: "**Changed Global**",
                            value: changedGlobalComs?.length ? changedGlobalComs.map(diffCom => ` * ${diffCom.com.name}`).join("\n") : "N/A"
                        });
                    }
                }

                if (outLog?.length) {
                    console.log("Deployed Commands:");
                    console.log(outLog.map(log => `${log.name}:\n${log.value}`).join("\n\n"));
                }
                return;
            } catch (err) {
                Bot.logger.error(inspect(err, {depth: 5}));
            }
        }
    };

    // Check the abilities table in the swapi db, and sort out what each omicron is good for
    Bot.sortOmicrons = async () => {
        // Get all omicron abilities
        const abilityList = await Bot.cache.get(Bot.config.mongodb.swapidb, "abilities", {
            isOmicron: true,
            language: "eng_us"
        }, {
            skillId: 1, _id: 0, descKey: 1
        });

        const omicronTypes = {
            tw: [],
            ga3: [],
            ga: [],
            tb: [],
            raid: [],
            conquest: [],
            other: []
        };

        for (const ab of abilityList) {
            const key = ab.descKey.toLowerCase();
            if (key.includes("3v3 grand arenas")) {
                omicronTypes.ga3.push(ab.skillId);
            } else if (key.includes("grand arenas")) {
                omicronTypes.ga.push(ab.skillId);
            } else if (key.includes("territory war")) {
                omicronTypes.tw.push(ab.skillId);
            } else if (key.includes("territory battle")) {
                omicronTypes.tb.push(ab.skillId);
            } else if (key.includes("conquest")) {
                omicronTypes.conquest.push(ab.skillId);
            } else if (key.includes("raid")) {
                omicronTypes.raid.push(ab.skillId);
            } else {
                omicronTypes.other.push(ab.skillId);
            }
        }
        return omicronTypes;
    };
};



function checkCmds(newCmdList, oldCmdList) {
    const changedComs = [];
    const newComs = [];

    // Work through all the commands that are already deployed, and see which ones have changed
    newCmdList.forEach(cmd => {
        const thisCom = oldCmdList.find(c => c.name === cmd.name);
        let isDiff = false;

        // If there's no match, it definitely goes in
        if (!thisCom) {
            console.log("Need to add " + cmd.name);
            return newComs.push(cmd);
        } else {
            // Fill in various options info, just in case
            debugLog("\nChecking " + cmd.name);
            for (const ix in cmd.options) {
                if (!cmd.options[ix])                           cmd.options[ix]                          = {};
                if (!cmd.options[ix].required)                  cmd.options[ix].required                 = false;
                if (!cmd.options[ix].autocomplete)              cmd.options[ix].autocomplete             = undefined;
                if (!cmd.options[ix].choices)                   cmd.options[ix].choices                  = undefined;
                if (!cmd.options[ix].nameLocalizations)         cmd.options[ix].nameLocalizations        = undefined;
                if (!cmd.options[ix].nameLocalized)             cmd.options[ix].nameLocalized            = undefined;
                if (!cmd.options[ix].descriptionLocalizations)  cmd.options[ix].descriptionLocalizations = undefined;
                if (!cmd.options[ix].descriptionLocalized)      cmd.options[ix].descriptionLocalized     = undefined;
                if (!cmd.options[ix].channelTypes)              cmd.options[ix].channelTypes             = undefined;
                if (!cmd.options[ix].options?.length)           cmd.options[ix].options                  = undefined;

                if (!cmd.options[ix].minValue  && !isNaN(cmd.options[ix].minValue))  cmd.options[ix].minValue  = undefined;
                if (!cmd.options[ix].maxValue  && !isNaN(cmd.options[ix].maxValue))  cmd.options[ix].maxValue  = undefined;
                if (!cmd.options[ix].minLength && !isNaN(cmd.options[ix].minLength)) cmd.options[ix].minLength = undefined;
                if (!cmd.options[ix].maxLength && !isNaN(cmd.options[ix].maxLength)) cmd.options[ix].maxLength = undefined;

                debugLog("> checking " + cmd.options[ix]?.name);
                for (const op of Object.keys(cmd.options[ix])) {
                    debugLog("  * Checking: " + op);
                    if (op === "choices") {
                        if (cmd.options[ix]?.choices?.length && thisCom.options[ix]?.choices?.length) {
                            // Make sure they both have some number of choices
                            if (cmd.options[ix]?.choices?.length !== thisCom.options[ix]?.choices?.length) {
                                // One of em is different than the other, so definitely needs an update
                                debugLog("ChoiceLen is different");
                                isDiff = true;
                            } else {
                                // If they have the same option count, make sure that the choices are the same inside
                                cmd.options[ix].choices.forEach((c, jx) => {
                                    const thisChoice = thisCom.options[ix].choices[jx];
                                    if (c.name !== thisChoice.name || c.value !== thisChoice.value) {
                                        // They have a different choice here, needs updating
                                        debugLog("Diff choices");
                                        debugLog(c, thisChoice);
                                        isDiff = true;
                                        return;
                                    }
                                });
                            }
                        } else {
                            // One or both have no choices
                            if (cmd.options[ix]?.choices?.length && thisCom.options[ix]?.choices?.length) {
                                // At least one of em has an entry, so it needs updating
                                debugLog("choiceLen2 is diff");
                                isDiff = true;
                            } else {
                                // Neither of em have any, so nothing to do here
                                continue;
                            }
                        }
                        if (isDiff) {
                            debugLog(`   [NEW] - ${cmd.options[ix] ? inspect(cmd.options[ix]?.choices) : null}\n   [OLD] - ${thisCom.options[ix] ? inspect(thisCom.options[ix]?.choices) : null}`);
                            break;
                        }
                    } else {
                        const newOpt = cmd.options[ix];
                        const thisOpt = thisCom.options[ix];
                        if (!thisOpt) {
                            debugLog("Missing opt for: newOpt");
                            isDiff = true;
                            break;
                        }
                        if (!newOpt) {
                            debugLog("Missing opt for: newOpt");
                            isDiff = true;
                            break;
                        }
                        if ((newOpt.required !== thisOpt.required               && (newOpt.required || thisOpt.required)) ||
                            (newOpt.name !== thisOpt.name                       && (newOpt.name || thisOpt.name)) ||
                            (newOpt.autocomplete !== thisOpt.autocomplete       && (newOpt.autocomplete || thisOpt.autocomplete)) ||
                            (newOpt.description !== thisOpt.description         && (newOpt.description || thisOpt.description)) ||
                            (newOpt.minValue !== thisOpt.minValue               && (!isNaN(newOpt?.minValue) || !isNaN(thisOpt?.minValue))) ||
                            (newOpt.maxValue !== thisOpt.maxValue               && (!isNaN(newOpt?.maxValue) || !isNaN(thisOpt?.maxValue))) ||
                            (newOpt.minLength !== thisOpt.minLength             && (!isNaN(newOpt?.minLength) || !isNaN(thisOpt?.minLength))) ||
                            (newOpt.maxLength !== thisOpt.maxLength             && (!isNaN(newOpt?.maxLength) || !isNaN(thisOpt?.maxLength))) ||
                            (newOpt.choices?.length !== thisOpt.choices?.length && (newOpt.choices || thisOpt.choices)) ||
                            (newOpt.options?.length !== thisOpt.options?.length && (newOpt.options || thisOpt.options))
                        ) {
                            isDiff = true;
                            debugLog(`   [NEW] - ${newOpt ? inspect(newOpt) : null}\n   [OLD] - ${thisOpt ? inspect(thisOpt) : null}`);
                            break;
                        }

                        if (thisOpt?.type === "SUB_COMMAND") {
                            for (const optIx in thisOpt.options) {
                                const thisSubOpt = thisOpt.options[optIx];
                                const newSubOpt  = newOpt.options[optIx];

                                if ((newSubOpt.required !== thisSubOpt.required               && (newSubOpt.required || thisSubOpt.required)) ||
                                    (newSubOpt.name !== thisSubOpt.name                       && (newSubOpt.name || thisSubOpt.name)) ||
                                    (newSubOpt.autocomplete !== thisSubOpt.autocomplete       && (newSubOpt.autocomplete || thisSubOpt.autocomplete)) ||
                                    (newSubOpt.description !== thisSubOpt.description         && (newSubOpt.description || thisSubOpt.description)) ||
                                    (newSubOpt.minValue !== thisSubOpt.minValue               && (!isNaN(newSubOpt?.minValue) || !isNaN(thisSubOpt?.minValue))) ||
                                    (newSubOpt.maxValue !== thisSubOpt.maxValue               && (!isNaN(newSubOpt?.maxValue) || !isNaN(thisSubOpt?.maxValue))) ||
                                    (newSubOpt.minLength !== thisSubOpt.minLength             && (!isNaN(newSubOpt?.minLength) || !isNaN(thisSubOpt?.minLength))) ||
                                    (newSubOpt.maxLength !== thisSubOpt.maxLength             && (!isNaN(newSubOpt?.maxLength) || !isNaN(thisSubOpt?.maxLength))) ||
                                    (newSubOpt.choices?.length !== thisSubOpt.choices?.length && (newSubOpt.choices || thisSubOpt.choices)) ||
                                    (newSubOpt.options?.length !== thisSubOpt.options?.length && (newSubOpt.options || thisSubOpt.options))
                                ) {
                                    isDiff = true;
                                    debugLog(`   [NEW] - ${newSubOpt ? inspect(newSubOpt) : null}\n   [OLD] - ${thisSubOpt ? inspect(thisSubOpt) : null}`);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            if (cmd?.description !== thisCom?.description) {
                isDiff = true;
                debugLog("Diff Desc");
            }
            if (cmd?.defaultPermission !== thisCom?.defaultPermission) {
                isDiff = true;
                debugLog("Diff perms");
            }
        }

        // If something has changed, stick it in there
        if (isDiff) {
            console.log("Need to update " + thisCom.name);
            changedComs.push({id: thisCom.id, com: cmd});
        }
    });
    return {changedComs, newComs};
}

function debugLog(...str) {
    if (!DEBUG) return;
    if (str.length === 1 && typeof str[0] === "string") {
        console.log(str[0]);
    } else {
        console.log(inspect(...str, {depth: 5}));
    }
}

function arrayEquals(a, b) {
    if (!a?.length || !b?.length) return false;
    return Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((val, index) => val === b[index]);
}
