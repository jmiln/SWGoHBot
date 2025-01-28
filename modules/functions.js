const { WebhookClient, PermissionsBitField, time } = require("discord.js");
const { promisify, inspect } = require("node:util"); // eslint-disable-line no-unused-vars
const fs = require("node:fs");
const readdir = promisify(require("node:fs").readdir);

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
        const authId = interaction.author?.id || interaction.user.id;

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
        if (gOwner?.id && interaction.user?.id === gOwner.id) {
            return permMap.GUILD_OWNER;
        }

        // Also giving them the permissions if they have the manage server role,
        // since they can change anything else in the server, so no reason not to
        if (
            interaction.member.permissions.has([PermissionsBitField.Flags.Administrator]) ||
            interaction.member.permissions.has([PermissionsBitField.Flags.ManageGuild])
        ) {
            return permMap.GUILD_ADMIN;
        }

        // The rest of the perms rely on roles. If those roles are not found
        // in the settings, or the user does not have it, their level will be 0
        return guildConf?.adminRoles?.some((roleId) => {
            const adminRole = interaction.guild.roles.cache.find((r) => [r.name.toLowerCase(), r.id].includes(roleId.toLowerCase()));
            return adminRole && interaction.member.roles.cache.has(adminRole.id);
        })
            ? permMap.GUILD_ADMIN
            : permMap.BASE_USER;
    };

    // Check if the bot's account is the main (real) bot
    Bot.isMain = () => client.user.id === "315739499932024834";

    // Default formatting for current US/Pacific time
    Bot.myTime = () => {
        return Intl.DateTimeFormat("en", {
            day: "numeric",
            month: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            timeZone: "America/Los_Angeles",
        }).format(new Date());
    };

    // This finds any character that matches the search, and returns them in an array
    Bot.findChar = (searchName, charList, ship = false) => {
        if (!searchName?.length || typeof searchName !== "string") {
            return [];
        }
        let cleanSearchName = searchName.toLowerCase();

        // Try for a defId/ uniqueName match first
        let foundChar = charList.filter((char) => char.uniqueName === cleanSearchName.toUpperCase());
        if (foundChar?.length) return foundChar;

        // Try for an actual exact match
        foundChar = charList.filter((char) => char.name.toLowerCase() === cleanSearchName);
        if (foundChar?.length) return foundChar;

        // Clean out extra spaces and improper apostrophes
        cleanSearchName = cleanSearchName.replace(/’/g, "'").trim();

        // Try finding an exact match for the name or aliases
        foundChar = charList.filter((char) => char.name.toLowerCase() === cleanSearchName);
        if (!foundChar.length) {
            foundChar = charList.filter((char) => char.aliases.some((alias) => alias.toLowerCase() === cleanSearchName));
        }
        if (ship && !foundChar.length) {
            foundChar = charList.filter((ship) => ship.crew?.some((crew) => crew.toLowerCase() === cleanSearchName));
        }
        if (foundChar?.length) {
            return foundChar;
        }

        // Then see if the searchName is a part of one of the names or aliases
        foundChar = charList.filter((char) => char.name.toLowerCase().split(" ").includes(cleanSearchName));
        if (!foundChar.length) {
            foundChar = charList.filter((char) => char.aliases.some((alias) => alias.toLowerCase().split(" ").includes(cleanSearchName)));
        }
        if (ship && !foundChar.length) {
            foundChar = charList.filter((ship) => ship.crew?.some((crew) => crew.toLowerCase().split(" ").includes(cleanSearchName)));
        }
        if (foundChar?.length) {
            return foundChar;
        }

        // Then try to split up the search by spaces, and see if any part of that finds any matches
        const splitName = cleanSearchName.split(" ");
        foundChar = charList.filter((char) => splitName.some((name) => char.name.toLowerCase().includes(name)));
        if (foundChar?.length) {
            return foundChar;
        }

        // If by here, it hasn't found any matching character or ship, return an empty array
        return [];
    };

    // Parse the webhook url, and get the id & token from the end
    function parseWebhook(url) {
        const [id, token] = url.split("/").slice(-2);
        return { id, token };
    }

    // Send a message to a webhook url, takes the url & the embed to send
    Bot.sendWebhook = (hookUrl, embed) => {
        const { id, token } = parseWebhook(hookUrl);
        const hook = new WebhookClient({ id, token });
        hook.send({ embeds: [embed] }).catch(console.error);
    };

    /* ANNOUNCEMENT MESSAGE
     * Sends a message to the set announcement channel
     */
    client.announceMsg = async (guild, announceMsg, channel = "", guildConf = {}) => {
        if (!guild?.id) return;

        // Use the guildConf announcement channel
        const announceChan = channel || guildConf?.announceChan || "";

        // Try and get the channel by ID first
        let chan = guild.channels.cache.get(announceChan.toString().replace(/[^0-9]/g, ""));

        // If  that didn't work, try and get it by name
        if (!chan) {
            chan = guild.channels.cache.find((c) => c.name === announceChan);
        }

        // If that still didn't work, or if it doesn't have the base required perms, return
        if (
            !chan?.send ||
            !chan?.permissionsFor(client.user)?.has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel])
        )
            return;
        // TODO Should probably log this / tell users about the issue somehow?
        // return console.error(`[AnnounceMsg] I was not able to send a msg in guild ${guild.name} (${guild.id}) \nMsg: ${announceMsg}\nConf: ${inspect(guildConf)}`);

        // If everything is ok, go ahead and try sending the message
        await chan.send(announceMsg).catch((err) => {
            // if (err.stack.toString().includes("user aborted a request")) return;
            console.error(
                `Broke sending announceMsg: ${err.stack} \nGuildID: ${guild.id} \nChannel: ${announceChan}\nMsg: ${announceMsg}\n`,
            );
        });
    };

    // Reload the functions (this) file
    client.reloadFunctions = async () => {
        const modules = ["../modules/functions.js", "../modules/patreonFuncs.js", "../modules/eventFuncs.js"]; //, "../modules/Logger.js"];
        try {
            for (const mod of modules) {
                delete require.cache[require.resolve(mod)];
                require(mod)(Bot, client);
            }
            delete require.cache[require.resolve("../modules/Logger.js")];
            Bot.logger = new (require("../modules/Logger.js"))(Bot, client);
        } catch (err) {
            console.error(`Failed to reload functions: ${err.stack}`);
            return { err: err.stack };
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
            Bot.acronyms = await JSON.parse(fs.readFileSync("data/acronyms.json", "utf-8"));
            Bot.arenaJumps = await JSON.parse(fs.readFileSync("data/arenaJumps.json", "utf-8"));
            Bot.characters = await JSON.parse(fs.readFileSync("data/characters.json", "utf-8"));
            Bot.charLocs = await JSON.parse(fs.readFileSync("data/charLocations.json", "utf-8"));
            Bot.journeyReqs = await JSON.parse(fs.readFileSync("data/journeyReqs.json", "utf-8"));
            Bot.missions = await JSON.parse(fs.readFileSync("data/missions.json", "utf-8"));
            Bot.resources = await JSON.parse(fs.readFileSync("data/resources.json", "utf-8"));
            Bot.raidNames = await JSON.parse(fs.readFileSync("data/raidNames.json", "utf-8"));
            Bot.ships = await JSON.parse(fs.readFileSync("data/ships.json", "utf-8"));
            Bot.shipLocs = await JSON.parse(fs.readFileSync("data/shipLocations.json", "utf-8"));

            Bot.CharacterNames = Bot.characters.map((ch) => {
                let suffix = "";
                if (ch.factions.includes("Galactic Legend")) {
                    suffix = "(GL)";
                }
                return { name: `${ch.name} ${suffix}`, defId: ch.uniqueName, aliases: ch.aliases || [] };
            });
            Bot.ShipNames = Bot.ships.map((sh) => {
                return { name: sh.name, defId: sh.uniqueName };
            });

            delete require.cache[require.resolve("../data/help.js")];
            Bot.help = require("../data/help.js");
        } catch (err) {
            return { err: err.stack };
        }
    };

    // Reload all the language files
    client.reloadLanguages = async () => {
        let err = false;
        try {
            for (const lang of Object.keys(Bot.languages)) {
                delete Bot.languages[lang];
            }
            const langFiles = await readdir(`${process.cwd()}/languages/`);
            for (const file of langFiles) {
                const langName = file.split(".")[0];
                const lang = require(`${process.cwd()}/languages/${file}`);
                Bot.languages[langName] = new lang(Bot);
                delete require.cache[require.resolve(`${process.cwd()}/languages/${file}`)];
            }
        } catch (e) {
            err = e;
        }
        return err;
    };

    /* MISCELANEOUS NON-CRITICAL FUNCTIONS */

    // `await wait(1000);` to "pause" for 1 second.
    Bot.wait = promisify(setTimeout);

    /*  MESSAGE SPLITTER
     *  Input an array of strings, and it will put them together so that it
     *  doesn't exceed the given max length.
     */
    Bot.msgArray = (arr, join = "\n", maxLen = 1900) => {
        const messages = [];
        const outArr = Array.isArray(arr) ? arr : arr.toString().split("\n");
        let currentMsg = "";
        for (const elem of outArr) {
            if (typeof elem !== "string") return Bot.logger.error(`In msgArray, ${elem} Is not a string!`);
            const expandedElem = Bot.expandSpaces(elem);
            // Check if something big somehow got in
            if (expandedElem.length > maxLen) {
                throw new Error(`[MsgArray] Element too big! ${expandedElem}`);
            }

            if (currentMsg.length + expandedElem.length + join.length > maxLen) {
                messages.push(currentMsg);
                currentMsg = expandedElem;
            } else {
                currentMsg += (currentMsg.length > 0 ? join : "") + expandedElem;
            }
        }
        if (currentMsg?.length) messages.push(currentMsg);
        return messages;
    };

    // Return a duration string
    Bot.duration = (time, interaction = null) => {
        const lang = interaction ? interaction.language : Bot.languages[Bot.config.defaultSettings.language];

        if (!time) console.error(`Missing time value in Bot.duration.\n${inspect(interaction?.options)}`);
        const timeDiff = Math.abs(new Date().getTime() - time);
        return Bot.formatDuration(timeDiff, lang);
    };

    // Given a duration number, format the string like it would have been done from moment-duration-format before
    Bot.formatDuration = (duration, lang) => {
        const langOut = lang || Bot.languages[Bot.config.defaultSettings.language];

        const durationMS = Bot.convertMS(duration);
        const outArr = [];

        if (durationMS.day) {
            outArr.push(`${durationMS.day} ${durationMS.day > 1 ? langOut.getTime("DAY", "PLURAL") : langOut.getTime("DAY", "SING")}`);
        }
        if (durationMS.hour || durationMS.day) {
            outArr.push(
                `${durationMS.hour || "0"} ${
                    durationMS.hour > 1 ? langOut.getTime("HOUR", "SHORT_PLURAL") : langOut.getTime("HOUR", "SHORT_SING")
                }`,
            );
        }
        outArr.push(`${durationMS.minute || "0"} ${langOut.getTime("MINUTE", "SHORT_SING")}`);

        return outArr.join(", ");
    };

    Bot.formatCurrentTime = (zone) => {
        // Format it with whatever zone the server is
        const tz = !zone || !Bot.isValidZone(zone) ? "UTC" : zone;

        return Intl.DateTimeFormat("en", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            timeZone: tz,
        }).format(new Date());
    };

    // Check against the list of timezones to make sure the given one is valid
    Bot.isValidZone = (zone) => {
        // Check if the entered string is a valid timezone (According to Wikipedia's list), so go ahead and process
        try {
            Intl.DateTimeFormat(undefined, { timeZone: zone });
            return true;
        } catch (e) {
            return false;
        }
    };

    // Return the full name of whatever day of the week it is
    Bot.getCurrentWeekday = (zone) => {
        const tz = !zone || !Bot.isValidZone(zone) ? "UTC" : zone;
        return Intl.DateTimeFormat("en", { weekday: "long", timeZone: tz }).format(new Date());
    };

    // Get the offset for a given timezone, based on:
    // https://stackoverflow.com/a/64263359
    Bot.getTimezoneOffset = (zone) => {
        if (!Bot.isValidZone(zone)) {
            console.error("[Bot.getTimezoneOffset] Missing/ invalid zone");
            return;
        }
        const timeZoneName =
            Intl.DateTimeFormat("ia", { timeZoneName: "short", timeZone: zone })
                .formatToParts()
                .find((i) => i.type === "timeZoneName")?.value || "";
        const offset = timeZoneName.slice(3);
        if (!offset) return 0;

        const matchData = offset.match(/([+-])(\d+)(?::(\d+))?/);
        if (!matchData) throw `cannot parse timezone name: ${timeZoneName}`;

        const [, sign, hour, minute] = matchData;
        let result = Number.parseInt(hour, 10) * 60;
        if (sign === "-") result *= -1;
        if (minute) result + Number.parseInt(minute, 10);

        return result;
    };

    Bot.getSetTimeForTimezone = (mmddyyyy_HHmm, zone) => {
        const offset = Bot.getTimezoneOffset(zone);
        const [month, day, year, hour, min] = mmddyyyy_HHmm.split(/[/\s:]/);
        if (year.toString().length !== 4) return Error("[Bot.getSetTimeForTimezone] Year MUST be 4 numbers long");
        const utcAtTarget = Date.UTC(year, month - 1, day, hour, min);
        return utcAtTarget - offset * Bot.constants.minMS;
    };

    Bot.getUTCFromOffset = (offset) => {
        const date = new Date();
        return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - offset * Bot.constants.minMS;
    };

    Bot.getStartOfDay = (zone) => {
        const day = new Date(new Date().toLocaleString("en-US", { timeZone: zone }));
        const localeHour = day.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: zone });

        day.setHours(day.getHours() - Number.parseInt(localeHour, 10), 0, 0, 0);
        return day;
    };

    Bot.getEndOfDay = (zone) => {
        const day = new Date(new Date().toLocaleString("en-US", { timeZone: zone }));
        const localeHour = day.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: zone });

        day.setHours(day.getHours() - Number.parseInt(localeHour, 10) + 23, 59, 59, 999);
        return day;
    };

    /*
     * LAST UPDATED FOOTER
     * Simple one to make the "Last updated ____ " footer strings and display them with Discord's timestamp format
     */
    Bot.updatedFooterStr = (updated, interaction = null) => {
        if (!updated) {
            console.error("[updatedFooterStr] Missing updated timestamp");
            return "";
        }

        const lang = interaction?.language || Bot.languages.eng_us;

        return lang.get("BASE_SWGOH_LAST_UPDATED", time(Math.floor(updated / 1000)));
    };

    // Get the current user count
    Bot.userCount = async () => {
        if (client.shard?.count) {
            return await client.shard
                .fetchClientValues("users.cache.size")
                .then((results) => results.reduce((prev, val) => prev + val, 0))
                .catch(console.error);
        }
        return client.users.cache.size;
    };

    // Get the current guild count
    Bot.guildCount = async () => {
        if (client.shard?.count) {
            return await client.shard
                .fetchClientValues("guilds.cache.size")
                .then((results) => results.reduce((prev, val) => prev + val, 0))
                .catch(console.error);
        }
        return client.guilds.cache.size;
    };

    /* isUserID
     * Check if a string of numbers is a valid user.
     */
    Bot.isUserID = (numStr) => {
        if (!numStr || !numStr.length) return false;
        const match = /(?:\\<@!?)?([0-9]{17,20})>?/gi.exec(numStr);
        return !!match;
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
        const match = aCode
            .toString()
            .replace(/[^\d]*/g, "")
            .match(/^\d{9}$/);
        return !!match;
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
    Bot.makeTable = (
        headers,
        rows,
        options = {
            boldHeader: true,
            useHeader: true,
        },
    ) => {
        if (!headers || !rows?.length) throw new Error("Need both headers and rows");
        const max = {};
        for (const h in headers) {
            // Get the max length needed, then add a bit for padding
            if (options.useHeader) {
                // console.log(h, rows);
                max[h] = Math.max(...[headers[h].value.length].concat(rows.map((v) => v[h]?.toString().length || 0))) + 2;
            } else {
                max[h] =
                    Math.max(
                        ...rows.map((v) => {
                            if (!v[h]) return 0;
                            return v[h].toString().length;
                        }),
                    ) + 2;
            }
        }

        let header = "";
        const out = [];

        if (options.useHeader) {
            for (const h in headers) {
                const headerMax = max[h];
                const head = headers[h];
                if (head?.value.length) {
                    const pad = headerMax - head.value.length;
                    const padBefore = Math.floor(pad / 2);
                    const padAfter = pad - padBefore;
                    header += head.startWith ? head.startWith : "";
                    if (padBefore) header += " ".repeat(padBefore);
                    header += head.value;
                    if (padAfter) header += " ".repeat(padAfter);
                    header += head.endWith ? head.endWith : "";
                } else {
                    header += head.startWith ? head.startWith : "";
                    header += " ".repeat(headerMax);
                    header += head.endWith ? head.endWith : "";
                }
            }
            if (options.boldHeader) {
                out.push(Bot.expandSpaces(`**${header}**`));
            } else {
                out.push(Bot.expandSpaces(header));
            }
        }
        for (const r of rows) {
            let row = "";
            Object.keys(headers).forEach((header, ix) => {
                const rowMax = max[header];
                const head = headers[header];
                let value = r[header];
                if (!value) value = 0;
                const pad = rowMax - value.toString().length;
                row += head.startWith ? head.startWith : "";
                if (!head.align || (head.align && head.align === "center")) {
                    const padBefore = Math.floor(pad / 2);
                    const padAfter = pad - padBefore;
                    if (padBefore) row += " ".repeat(padBefore);
                    row += value;
                    if (padAfter) row += " ".repeat(padAfter);
                } else if (head.align === "left" && ix === 0 && !head.startWith) {
                    row += value + " ".repeat(pad - 1);
                } else if (head.align === "left") {
                    row += ` ${value}${" ".repeat(pad - 1)}`;
                } else if (head.align === "right") {
                    row += `${" ".repeat(pad - 1) + value} `;
                } else {
                    throw new Error("Invalid alignment");
                }
                row += head.endWith ? head.endWith : "";
            });
            out.push(Bot.expandSpaces(row.replace(/\s*$/, "")));
        }

        return out;
    };

    // Small function to search the factions
    Bot.findFaction = (fact) => {
        const formattedFact = fact.toLowerCase().replace(/\s+/g, "");
        let found = Bot.factions.find((f) => f.toLowerCase().replace(/\s+/g, "") === formattedFact);
        if (found) {
            return found.toLowerCase();
        }
        found = Bot.factions.find((f) => f.toLowerCase().replace(/\s+/g, "") === formattedFact.substring(0, formattedFact.length - 1));
        if (formattedFact.endsWith("s") && found) {
            return found.toLowerCase();
        }
        found = Bot.factions.find((f) => f.toLowerCase().replace(/\s+/g, "") === `${formattedFact}s`);
        if (!formattedFact.endsWith("s") && found) {
            return found.toLowerCase();
        }
        const close = Bot.factions.filter((f) => f.toLowerCase().replace(/\s+/g, "").includes(formattedFact.toLowerCase()));
        if (close.length) {
            return close.map((f) => f.toLowerCase());
        }

        return false;
    };

    // Expand multiple spaces to have zero width spaces between them so
    // Discord doesn't collapse em
    Bot.expandSpaces = (str) => {
        let outStr = "";
        for (const e of str.split(/([\s]{2,})/)) {
            if (e.match(/[\s]{2,}/)) {
                outStr += e.split("").join(Bot.constants.zws);
            } else {
                outStr += e;
            }
        }
        return outStr;
    };

    // Get the ally code of someone that's registered
    Bot.getAllyCode = async (message, user, useMessageId = true) => {
        const otherCodeRegex = /^-\d{1,2}$/;
        let userStr = user;
        if (Array.isArray(user)) userStr = user?.join(" ")?.toString().trim() || "";

        let userAcct = null;
        if (userStr === "me" || userStr?.match(otherCodeRegex) || (!userStr && useMessageId)) {
            // Grab the sender's primary code
            if (message.author) {
                // Message.author for messages
                userAcct = await Bot.userReg.getUser(message.author.id);
            } else {
                // Message.user for interactions
                userAcct = await Bot.userReg.getUser(message.user.id);
            }
        } else if (Bot.isUserID(userStr)) {
            // Try to grab the primary code for the mentioned user
            userAcct = await Bot.userReg.getUser(userStr.replace(/[^\d]*/g, ""));
        } else if (Bot.isAllyCode(userStr)) {
            // Otherwise, just scrap everything but numbers, and send it back
            return userStr.replace(/[^\d]*/g, "");
        }

        if (userAcct?.accounts?.length) {
            let account = null;
            if (userStr?.match(otherCodeRegex)) {
                // If it's a -1/ -2 code, try to grab the specified code
                const index = Number.parseInt(userStr.replace("-", ""), 10) - 1;
                account = userAcct.accounts[index];
            } else {
                // If it's a missing allycode, a "me", or for a specified discord ID, just grab the primary if available
                account = userAcct.accounts.find((a) => a.primary);
            }
            return account ? account.allyCode : null;
        }
        return null;
    };

    // Convert from milliseconds
    Bot.convertMS = (milliseconds) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const totalMin = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const hour = Math.floor(totalMin / 60);
        const minute = totalMin % 60;
        return {
            hour: hour,
            minute: minute,
            totalMin: totalMin,
            seconds: seconds,
        };
    };

    // Return a divider of equals signs
    Bot.getDivider = (count, divChar = "=") => {
        if (count <= 0) throw new Error("Invalid count value");
        if (typeof divChar !== "string") throw new Error("divChar must be a string!");
        return divChar.repeat(count);
    };

    Bot.isChannelId = (mention) => /^\d{17,19}/.test(mention);
    Bot.isChannelMention = (mention) => /^<#\d{17,19}>/.test(mention);
    Bot.isRoleMention = (mention) => /^<@&\d{17,19}>/.test(mention);
    Bot.isUserMention = (mention) => /^<@!?\d{17,19}>/.test(mention);

    Bot.chunkArray = (inArray, chunkSize) => {
        if (!Array.isArray(inArray)) throw new Error("[chunkArray] inArray must be an array!");
        const res = [];
        for (let ix = 0, len = inArray.length; ix < len; ix += chunkSize) {
            res.push(inArray.slice(ix, ix + chunkSize));
        }
        return res;
    };

    // Returns a gear string (9+4 or 13r5), etc
    Bot.getGearStr = (charIn, preStr = "") => {
        // If the character is not unlocked
        if (!charIn?.gear) return "N/A";

        let charGearOut = preStr + charIn.gear.toString();
        if (charIn.equipped?.length) {
            charGearOut += `+${charIn.equipped.length}`;
        } else if (charIn?.relic?.currentTier > 2) {
            charGearOut += `r${charIn.relic.currentTier - 2}`;
        }
        return charGearOut;
    };

    // Get the overall levels for a guild as a whole (Gear, rarity, relic, etc)
    Bot.summarizeCharLevels = (guildMembers, type) => {
        const max = { gear: 13, relic: 9, rarity: 7 };
        if (!max?.[type]) return new Error(`[summarizeLevels] Invalid type (${type})`);
        if (!Array.isArray(guildMembers)) return new Error("[summarizeCharLevels] guildMembers must be an array!");

        const levels = {};
        for (let ix = max[type]; ix >= 1; ix--) {
            let lvlCount = 0;
            for (const member of guildMembers) {
                if (type === "relic") {
                    lvlCount += member.roster.filter((c) => c?.combatType === 1 && c.relic?.currentTier - 2 === ix).length;
                } else {
                    lvlCount += member.roster.filter((c) => c?.combatType === 1 && c[type] === ix).length;
                }
            }
            if (lvlCount > 0) {
                levels[ix] = lvlCount;
            }
        }
        const tieredLvl = Object.keys(levels).reduce((acc, curr) => acc + levels[curr] * Number.parseInt(curr, 10), 0);
        const totalLvl = Object.keys(levels).reduce((acc, curr) => acc + levels[curr], 0);
        const avgLvls = (tieredLvl / totalLvl).toFixed(2);

        return [levels, avgLvls];
    };

    const ROMAN_REGEX = /^(X|XX|XXX|XL|L|LX|LXX|LXXX|XC|C)?(I|II|III|IV|V|VI|VII|VIII|IX)$/i;
    Bot.toProperCase = (strIn) => {
        if (!strIn) return strIn;
        return strIn.replace(/([^\W_]+[^\s-]*) */g, (txt) => {
            if (ROMAN_REGEX.test(txt)) return txt.toUpperCase();
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    };

    // Trim down large numbers to be more easily readable
    Bot.shortenNum = (number, trimTo = 2) => {
        const million = 1_000_000;
        const thousand = 1_000;

        if (number >= million) {
            return `${trimFloat(number / million, trimTo)}M`;
        }
        if (number >= thousand) {
            return `${trimFloat(number / thousand, trimTo)}K`;
        }
    };

    // Helper for shortenNum,
    // Trims a fload down to either 0 or 1 (by default) decimal points
    function trimFloat(num, dec = 1) {
        if (num % 1 === 0) {
            return num.toString();
        }
        return num.toFixed(dec);
    }

    // Check the abilities table in the swapi db, and sort out what each omicron is good for
    Bot.sortOmicrons = async () => {
        // Get all omicron abilities
        const abilityList = await Bot.cache.get(
            Bot.config.mongodb.swapidb,
            "abilities",
            {
                isOmicron: true,
                language: "eng_us",
            },
            {
                skillId: 1,
                _id: 0,
                descKey: 1,
            },
        );

        const omicronTypes = {
            tw: [],
            ga3: [],
            ga: [],
            tb: [],
            raid: [],
            conquest: [],
            other: [],
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
        return (
            (channel?.guild &&
                channel.permissionsFor(user)?.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) ||
            false
        );
    };

    Bot.getBlankUnitImage = async (defId) => {
        return await Bot.getUnitImage(defId, {
            gear: -1,
            level: -1,
            rarity: -1,
            skills: null,
            relic: null,
        });
    };

    let unitsList = [...Bot.characters, ...Bot.ships];
    Bot.getUnitImage = async (defId, { rarity, level, gear, skills, relic }) => {
        let thisChar;
        try {
            thisChar = unitsList.find((ch) => ch.uniqueName === defId);

            // If it doesn't find it, try remaking the list (Lazy reload)
            if (!thisChar) {
                unitsList = [...Bot.characters, ...Bot.ships];
                thisChar = unitsList.find((ch) => ch.uniqueName === defId);
            }
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
            defId,
            charUrl: thisChar?.avatarURL,
            avatarName: thisChar?.avatarName,
            rarity,
            level,
            gear,
            zetas: skills?.filter((s) => s.isZeta && (s.tier >= s?.zetaTier || (s.isOmicron && s.tier >= s.tiers - 1))).length || 0,
            relic: relic?.currentTier || 0,
            omicron: skills?.filter((s) => s.isOmicron && s.tier === s.tiers).length || 0,
            side: thisChar.side,
        };

        try {
            const res = await fetch(`${Bot.config.imageServIP_Port}/char/`, {
                method: "post",
                body: JSON.stringify(fetchBody),
                headers: { "Content-Type": "application/json" },
            });
            const resBuf = await res.arrayBuffer();
            return resBuf ? Buffer.from(resBuf) : null;
        } catch (e) {
            Bot.logger.error(`[Bot.getUnitImage] Something broke while requesting image.\n${e}`);
            return null;
        }
    };
};
