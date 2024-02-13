const { WebhookClient, ChannelType, PermissionsBitField } = require("discord.js");
const {promisify, inspect} = require("util");     // eslint-disable-line no-unused-vars
const fs = require("fs");
const readdir = promisify(require("fs").readdir);

module.exports = (Bot, client) => {
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
        return Intl.DateTimeFormat("en", {day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "numeric", timeZone: "America/Los_Angeles"}).format(new Date());
    };

    // This finds any character that matches the search, and returns them in an array
    Bot.findChar = (searchName, charList, ship=false) => {
        if (!searchName?.length || typeof searchName !== "string") {
            return [];
        }
        searchName = searchName.toLowerCase();

        // Try for a defId/ uniqueName match first
        let foundChar = charList.filter(char => char.uniqueName === searchName.toUpperCase());
        if (foundChar?.length) return foundChar;

        // Try for an actual exact match
        foundChar = charList.filter(char => char.name.toLowerCase() === searchName);
        if (foundChar?.length) return foundChar;

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
        if (!chan?.send || !chan?.permissionsFor(client.user)?.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])) {
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
            Bot.abilityCosts = await JSON.parse(fs.readFileSync("data/abilityCosts.json",  "utf-8"));
            Bot.acronyms     = await JSON.parse(fs.readFileSync("data/acronyms.json",      "utf-8"));
            Bot.arenaJumps   = await JSON.parse(fs.readFileSync("data/arenaJumps.json",    "utf-8"));
            Bot.characters   = await JSON.parse(fs.readFileSync("data/characters.json",    "utf-8"));
            Bot.charLocs     = await JSON.parse(fs.readFileSync("data/charLocations.json", "utf-8"));
            Bot.journeyReqs  = await JSON.parse(fs.readFileSync("data/journeyReqs.json",   "utf-8"));
            Bot.missions     = await JSON.parse(fs.readFileSync("data/missions.json",      "utf-8"));
            Bot.resources    = await JSON.parse(fs.readFileSync("data/resources.json",     "utf-8"));
            Bot.raidNames    = await JSON.parse(fs.readFileSync("data/raidNames.json",     "utf-8"));
            Bot.ships        = await JSON.parse(fs.readFileSync("data/ships.json",         "utf-8"));
            Bot.shipLocs     = await JSON.parse(fs.readFileSync("data/shipLocations.json", "utf-8"));

            Bot.CharacterNames = Bot.characters.map(ch => {return {name: ch.name, defId: ch.uniqueName};});
            Bot.ShipNames = Bot.ships.map(sh => {return {name: sh.name, defId: sh.uniqueName};});

            delete require.cache[require.resolve("../data/help.js")];
            Bot.help         = require("../data/help.js");
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
    Bot.duration = (time, interaction=null) => {
        const lang = interaction ? interaction.language : Bot.languages[Bot.config.defaultSettings.language];

        if (!time) console.error("Missing time value in Bot.duration.\n" + inspect(interaction?.options));
        const timeDiff = Math.abs(new Date().getTime() - time);
        return Bot.formatDuration(timeDiff, lang);
    };

    // Given a duration number, format the string like it would have been done from moment-duration-format before
    Bot.formatDuration = (duration, lang) => {
        if (!lang) lang = Bot.languages[Bot.config.defaultSettings.language];

        // console.log("[Bot.FormatDuration] in: " + duration);
        const durationMS = Bot.convertMS(duration);
        // console.log("[Bot.FormatDuration] durationMS: " + inspect(durationMS));
        const outArr = [];

        if (durationMS.day) {
            outArr.push(`${durationMS.day} ${durationMS.day > 1 ? lang.getTime("DAY", "PLURAL") : lang.getTime("DAY", "SING")}`);
        }
        if (durationMS.hour || durationMS.day) {
            outArr.push(`${durationMS.hour || "0"} ${durationMS.hour > 1 ? lang.getTime("HOUR", "SHORT_PLURAL") : lang.getTime("HOUR", "SHORT_SING")}`);
        }
        outArr.push(`${durationMS.minute || "0"} ${lang.getTime("MINUTE", "SHORT_SING")}`);

        // console.log("[Bot.FormatDuration] out: " + outArr);

        return outArr.join(", ");
    };

    Bot.formatCurrentTime = (zone) => {
        if (!zone || !Bot.isValidZone(zone)) {
            // Format it with whatever zone the server is
            return Intl.DateTimeFormat("en", {year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric"}).format(new Date());
        }

        return Intl.DateTimeFormat("en", {year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric", timeZone: zone}).format(new Date());
    };

    // Check against the list of timezones to make sure the given one is valid
    Bot.isValidZone = (zone) => {
        // Check if the entered string is a valid timezone (According to Wikipedia's list), so go ahead and process
        return Bot.timezones.find(tz => tz.toLowerCase() === zone?.toLowerCase()) || false;
    };

    // Return the full name of whatever day of the week it is
    Bot.getCurrentWeekday = (zone) => {
        if (!zone || !Bot.isValidZone(zone)) {
            return Intl.DateTimeFormat("en", {weekday: "long"}).format(new Date());
        }
        return Intl.DateTimeFormat("en", {weekday: "long", timeZone: zone}).format(new Date());
    };

    // Get the offset for a given timezone, based on:
    // https://stackoverflow.com/a/64263359
    Bot.getTimezoneOffset = (zone) => {
        if (!Bot.isValidZone(zone)) {
            console.error("[Bot.getTimezoneOffset] Missing/ invalid zone");
            return;
        }
        const timeZoneName = Intl.DateTimeFormat("ia", {timeZoneName: "short", timeZone: zone})
            .formatToParts()
            .find((i) => i.type === "timeZoneName")?.value || [];
        const offset = timeZoneName.slice(3);
        if (!offset) return 0;

        const matchData = offset.match(/([+-])(\d+)(?::(\d+))?/);
        if (!matchData) throw `cannot parse timezone name: ${timeZoneName}`;

        const [, sign, hour, minute] = matchData;
        let result = parseInt(hour) * 60;
        if (sign === "-") result *= -1;
        if (minute) result + parseInt(minute);

        return result;
    };

    Bot.getSetTimeForTimezone = (mmddyyyy_HHmm, zone) => {
        const offset = Bot.getTimezoneOffset(zone);
        const [month, day, year, hour, min] = mmddyyyy_HHmm.split(/[/\s:]/);
        if (year.toString().length !== 4) return Error("[Bot.getSetTimeForTimezone] Year MUST be 4 numbers long");
        const utcAtTarget = Date.UTC(year, month-1, day, hour, min);
        return utcAtTarget - (offset * Bot.constants.minMS);
    };

    Bot.getUTCFromOffset = (offset) => {
        const date = new Date();
        return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - (offset * Bot.constants.minMS);
    };

    Bot.getStartOfDay = (zone) => {
        const day = new Date(new Date().toLocaleString("en-US", { timeZone: zone }));
        const localeHour = day.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: zone });

        day.setHours(day.getHours() - parseInt(localeHour, 10));
        day.setMinutes(0);
        day.setSeconds(0);
        day.setMilliseconds(0);
        return day;
    };
    Bot.getEndOfDay = (zone) => {
        const day = new Date(new Date().toLocaleString("en-US", { timeZone: zone }));
        const localeHour = day.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: zone });

        day.setHours(day.getHours() - parseInt(localeHour, 10) + 23);
        day.setMinutes(59);
        day.setSeconds(59);
        day.setMilliseconds(999);
        return day;
    };

    /*
     * LAST UPDATED FOOTER
     * Simple one to make the "Last updated ____ " footer strings and display them with Discord's timestamp format
     */
    Bot.updatedFooterStr = (updated, interaction=null) => {
        if (!updated) {
            console.error("[updatedFooterStr] Missing updated timestamp");
            return "";
        }

        const lang = interaction?.language || Bot.languages["eng_us"];

        return lang.get("BASE_SWGOH_LAST_UPDATED", `<t:${Math.floor(updated/1000)}:R>`);
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
                outStr += e.split("").join(Bot.constants.zws);
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

    const ROMAN_REGEX = /^(X|XX|XXX|XL|L|LX|LXX|LXXX|XC|C)?(I|II|III|IV|V|VI|VII|VIII|IX)$/i;
    Bot.toProperCase = function(strIn) {
        return strIn.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
            if (ROMAN_REGEX.test(txt)) return txt.toUpperCase();
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

    // Function to see if we have permission to see/ send messages in a given channel
    Bot.hasViewAndSend = async (channel, user) => {
        return (channel?.guild && channel.permissionsFor(user)?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) || false;
    };

    Bot.getBlankUnitImage = async (defId) => {
        return await Bot.getUnitImage(defId, {
            gear: -1,
            level: -1,
            rarity: -1,
            skills: null,
            relic: null
        });
    };

    let unitsList = [...Bot.characters, ...Bot.ships];
    Bot.getUnitImage = async (defId, {rarity, level, gear, skills, relic}) => {
        let thisChar;
        try {
            thisChar = unitsList.find(ch => ch.uniqueName === defId);

            // If it doesn't find it, try remaking the list (Lazy reload)
            if (!thisChar) unitsList = [...Bot.characters, ...Bot.ships];
            thisChar = unitsList.find(ch => ch.uniqueName === defId);
        } catch (err) {
            console.error("Issue getting character image:");
            console.error(err);
            return null;
        }
        if (!thisChar) {
            console.error("[getImage] Cannot find matching defId");
            return null;
        }
        const fetchBody = {
            defId: defId,
            charUrl: thisChar?.avatarURL,
            avatarName: thisChar?.avatarName,
            rarity: rarity,
            level: level,
            gear: gear,
            zetas: skills?.filter(s => s.isZeta && (s.tier >= s?.zetaTier || (s.isOmicron && s.tier >= s.tiers-1))).length || 0,
            relic: relic?.currentTier || 0,
            omicron: skills?.filter(s => s.isOmicron && s.tier === s.tiers).length || 0,
            side: thisChar.side
        };

        try {
            return await fetch(Bot.config.imageServIP_Port + "/char/", {
                method: "post",
                body: JSON.stringify(fetchBody),
                headers: { "Content-Type": "application/json" }
            })
                .then(async response => {
                    const resBuf = await response.arrayBuffer();
                    if (!resBuf) return null;
                    return Buffer.from(resBuf);
                });
        } catch (e) {
            Bot.logger.error("[Bot.getUnitImage] Something broke while requesting image.\n" + e);
            return null;
        }
    };
};




