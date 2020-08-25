const Discord = require("discord.js");
const Fuse = require("fuse-js-latest");
const moment = require("moment-timezone");
require("moment-duration-format");
const {promisify, inspect} = require("util");     // eslint-disable-line no-unused-vars
const fs = require("fs");
const readdir = promisify(require("fs").readdir);

module.exports = (Bot, client) => {
    // A zero-width-space
    Bot.zws = "\u200B";

    // Some normal color codes
    Bot.colors = {
        black:  "#000000",
        blue:   "#0000FF",
        green:  "#00FF00",
        red:    "#FF0000",
        white:  "#FFFFFF",
        yellow: "#FFFF00",
    };

    /*
        PERMISSION LEVEL FUNCTION
        This is a very basic permission system for commands which uses "levels"
        "spaces" are intentionally left black so you can add them if you want.
        NEVER GIVE ANYONE BUT OWNER THE LEVEL 10! By default this can run any
        command including the VERY DANGEROUS `eval` and `exec` commands!
        */
    Bot.permlevel = message => {
        let permlvl = 0;

        // If bot owner, return max perm level
        if (message.author.id === Bot.config.ownerid) return 10;

        // If DMs or webhook, return 0 perm level.
        if (!message.guild || !message.member) return 0;
        const guildConf = message.guildSettings;

        // Guild Owner gets an extra level, wooh!
        if (message.channel.type === "text" && message.guild) {
            if (message.author.id === message.guild.owner.id) return permlvl = 4;
        }

        // Also giving them the permissions if they have the manage server role,
        // since they can change anything else in the server, so no reason not to
        if (message.member.hasPermission(["ADMINISTRATOR"]) || message.member.hasPermission(["MANAGE_GUILD"])) return permlvl = 3;

        // The rest of the perms rely on roles. If those roles are not found
        // in the settings, or the user does not have it, their level will be 0
        try {
            const adminRoles = guildConf.adminRole;

            for (var ix = 0, len = adminRoles.length; ix < len; ix++) {
                const adminRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === adminRoles[ix].toLowerCase());
                if (adminRole && message.member.roles.cache.has(adminRole.id)) return permlvl = 3;
            }
        } catch (e) {() => {};}
        return permlvl;
    };

    Bot.myTime = () => {
        return moment.tz("US/Pacific").format("M/D/YYYY h:mma");
    };

    Bot.isMain = () => {
        if (client.user.id === "315739499932024834") return true;
        return false;
    };

    // This finds any character that matches the search, and returns them in an array
    Bot.findChar = (searchName, charList, ship=false) => {
        if (!searchName || !searchName.length) {
            return [];
        }
        const options = {
            tokenize: true,
            matchAllTokens: true,
            threshold: 0,
            distance: 0,
            keys: [ "name", "aliases" ]
        };
        const options2 = {
            keys: ["name", "aliases"],
            threshold: .1,
            distance: 4
        };
        // In case of any extra spaces
        searchName = searchName.trim().toLowerCase();

        // Check the names for an exact match
        for (let ix = 0; ix < charList.length; ix++) {
            if (charList[ix].name.toLowerCase() === searchName || charList[ix].aliases.map(a => a.toLowerCase()).includes(searchName)) {
                return [charList[ix]];
            }
        }

        // If there's not an exact name match, fuzzy search it
        if (ship) options.keys.push("crew");
        const fuse = new Fuse(charList, options);
        let chars = fuse.search(searchName);
        if (chars.length >= 1) {
            return chars;
        }

        // If it's not exact, send back the big mess
        if (ship) options2.keys.push("crew");
        const fuse2 = new Fuse(charList, options2);
        chars = fuse2.search(searchName);
        return chars;
    };



    // This find one character that matches the search, and returns it
    Bot.findCharByName = (searchName, charList) => {
        var options = {
            keys: ["name"],
            threshold: 0.0
        };
        const fuse = new Fuse(charList, options);
        const char = fuse.search(searchName);
        return char[0];
    };

    // Parse the webhook url, and get the id & token from the end
    function parseWebhook(url) {
        const webhookCredentials = url.split("/").slice(-2);
        return {
            id: webhookCredentials[0],
            token: webhookCredentials[1]
        };
    }

    Bot.sendWebhook = (hookUrl, embed) => {
        const h = parseWebhook(hookUrl);
        const hook = new Discord.WebhookClient(h.id, h.token);
        hook.send({embeds: [
            embed
        ]}).catch(() => {});
    };

    /*
     * LOGGING FUNCTION
     * Logs to console & if set up, the log channel
     */
    Bot.log = (title="Log", msg, options={}) => {
        console.log(`[${Bot.myTime()}][${title}]${msg}`);
        if (!options.noSend) {
            if (client.shard) {
                title = title + ` (${client.shard.id})`;
            }
            try {
                // Sends the logs to the channel I have set up for it.
                if (Bot.config.logs.logToChannel && Bot.config.webhookURL) {
                    Bot.sendWebhook(Bot.config.webhookURL, {
                        title: title ? title : null,
                        description: msg,
                        color: options.color ? options.color : null,
                        footer: {text: Bot.myTime()}
                    });
                }
            } catch (e) {
                // Probably broken because it's not started yet
                console.log(`[${Bot.myTime()}] I couldn't send a log:\n${e}`);
            }
        }
    };

    /*
     * ANNOUNCEMENT MESSAGE
     * Sends a message to the set announcement channel
     */
    Bot.announceMsg = async (guild, announceMsg, channel="") => {
        if (!guild || !guild.id) return;
        const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guild.id}, attributes: ["announceChan"]});
        const guildConf = guildSettings.dataValues;

        let announceChan = guildConf.announceChan;
        if (channel !== "") {
            announceChan = channel;
        }
        // Try and get it by ID first
        let chan = guild.channels.cache.get(announceChan.replace(/[^0-9]/g, ""));

        // If  that didn't work, try and get it by name
        if (!chan) {
            chan = guild.channels.cache.find(c => c.name === announceChan);
        }

        // If that still didn't work, or if it doesn't have the base required perms, return
        if (!chan || !chan.send || !chan.permissionsFor(client.user.id).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
            return;
        } else {
            // If everything is ok, go ahead and try sending the message
            await chan.send(announceMsg).catch(() => {Bot.logger.error("Broke sending accounceMsg");});
        }
    };

    /*
     * Loads the given command
     */
    client.loadCommand = (commandName) => {
        try {
            const cmd = new (require(`../commands/${commandName}`))(Bot);
            if (cmd.help.category === "SWGoH" && !Bot.swgohAPI) {
                return "Unable to load command ${commandName}: no swgohAPI";
            } else if (!cmd.conf.enabled) {
                return false;
            }
            client.commands.set(cmd.help.name, cmd);
            cmd.conf.aliases.forEach(alias => {
                client.aliases.set(alias, cmd.help.name);
            });
            return false;
        } catch (e) {
            return `Unable to load command ${commandName}: ${e}`;
        }
    };

    /*
     * Unloads the given command
     */
    client.unloadCommand = (command) => {
        if (typeof command === "string") {
            const commandName = command;
            if (client.commands.has(commandName)) {
                command = client.commands.get(commandName);
            } else if (Bot.aliases.has(commandName)) {
                command = client.commands.get(client.aliases.get(commandName));
            }
        }

        client.commands.delete(command);
        client.aliases.forEach((cmd, alias) => {
            if (cmd === command) client.aliases.delete(alias);
        });
        delete require.cache[require.resolve(`../commands/${command.help.name}.js`)];
        return false;
    };

    /*
     * Combines the last two, and reloads a command
     */
    client.reloadCommand = async (commandName) => {
        let command;
        if (client.commands.has(commandName)) {
            command = client.commands.get(commandName);
        } else if (client.aliases.has(commandName)) {
            command = client.commands.get(client.aliases.get(commandName));
        }
        if (!command) return new Error(`The command \`${commandName}\` doesn"t seem to exist, nor is it an alias. Try again!`);

        let response = client.unloadCommand(command);
        if (response) {
            return new Error(`Error Unloading: ${response}`);
        } else {
            response = client.loadCommand(command.help.name);
            if (response) {
                return new Error(`Error Loading: ${response}`);
            }
        }
        return command.help.name;
    };

    // Reloads all commads (even if they were not loaded before)
    // Will not remove a command it it's been loaded,
    // but will load a new command it it's been added
    client.reloadAllCommands = async (msgID) => {
        client.commands.keyArray().forEach(c => {
            client.unloadCommand(c);
        });
        const cmdFiles = await readdir("./commands/");
        const coms = [], errArr = [];
        cmdFiles.forEach(async (f) => {
            try {
                const cmd = f.split(".")[0];
                if (f.split(".").slice(-1)[0] !== "js") {
                    errArr.push(f);
                } else {
                    const res = client.loadCommand(cmd);
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
        const channel = client.channels.cache.get(msgID);
        if (channel) {
            channel.send(`Reloaded ${coms.length} commands, failed to reload ${errArr.length} commands.${errArr.length > 0 ? "\n```" + errArr.join("\n") + "```" : ""}`);
        }
    };

    // Reload the events files (message, guildCreate, etc)
    client.reloadAllEvents = async (msgID) => {
        const ev = [], errEv = [];

        const evtFiles = await readdir("./events/");
        evtFiles.forEach(file => {
            try {
                const eventName = file.split(".")[0];
                client.removeAllListeners(eventName);
                const event = require(`../events/${file}`);
                if (eventName === "ready") {
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
        const channel = client.channels.cache.get(msgID);
        if (channel) {
            channel.send(`Reloaded ${ev.length} events, failed to reload ${errEv.length} events.${errEv.length > 0 ? "\n```" + errEv.join("\n") + "```" : ""}`);
        }
    };

    // Reload the functions (this) file
    client.reloadFunctions = async (msgID) => {
        let err = false;
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
        } catch (e) {
            err = e;
        }
        const channel = client.channels.cache.get(msgID);
        if (channel) {
            if (err) {
                channel.send(`Something broke: ${err}`);
            } else {
                channel.send("Reloaded functions");
            }
        }
    };

    // Reload the swapi file
    client.reloadSwapi = async (msgID) => {
        let err = false;
        try {
            delete require.cache[require.resolve("../modules/swapi.js")];
            Bot.swgohAPI = require("../modules/swapi.js")(Bot);
        } catch (e) {
            err = e;
        }
        const channel = client.channels.cache.get(msgID);
        if (channel) {
            if (err) {
                channel.send(`Something broke: ${err}`);
            } else {
                channel.send("Reloaded swapi");
            }
        }
    };

    // Reload the users file
    client.reloadUserReg = async (msgID) => {
        let err = false;
        try {
            delete require.cache[require.resolve("../modules/users.js")];
            Bot.userReg = require("../modules/users.js")(Bot);
        } catch (e) {
            err = e;
        }
        const channel = client.channels.cache.get(msgID);
        if (channel) {
            if (err) {
                channel.send(`Something broke: ${err}`);
            } else {
                channel.send("Reloaded users");
            }
        }
    };

    // Reload the data files (ships, teams, characters)
    client.reloadDataFiles = async (msgID) => {
        let err = false;
        try {
            Bot.abilityCosts = await JSON.parse(fs.readFileSync("data/abilityCosts.json"));
            Bot.acronyms     = await JSON.parse(fs.readFileSync("data/acronyms.json"));
            Bot.arenaJumps   = await JSON.parse(fs.readFileSync("data/arenaJumps.json"));
            Bot.characters   = await JSON.parse(fs.readFileSync("data/characters.json"));
            Bot.charLocs     = await JSON.parse(fs.readFileSync("data/charLocations.json"));
            Bot.missions     = await JSON.parse(fs.readFileSync("data/missions.json"));
            Bot.resources    = await JSON.parse(fs.readFileSync("data/resources.json"));
            Bot.ships        = await JSON.parse(fs.readFileSync("data/ships.json"));
            Bot.shipLocs     = await JSON.parse(fs.readFileSync("data/shipLocations.json"));
            Bot.squads       = await JSON.parse(fs.readFileSync("data/squads.json"));
            const gameData   = await JSON.parse(fs.readFileSync("data/gameData.json"));
            Bot.statCalculator.setGameData(gameData);
        } catch (e) {
            err = e;
        }
        const channel = client.channels.cache.get(msgID);
        if (channel) {
            if (err) {
                channel.send(`Something broke: ${err}`);
            } else {
                channel.send("Reloaded data files.");
            }
        }
    };

    // Reload all the language files
    client.reloadLanguages = async (chanID) => {
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
        const channel = client.channels.cache.get(chanID);
        if (channel) {
            if (err) {
                channel.send(`Something broke: ${err}`);
            } else {
                channel.send("Reloaded language files.");
            }
        }
    };

    /*
      SINGLE-LINE AWAITMESSAGE
      A simple way to grab a single reply, from the user that initiated
      the command. Useful to get "precisions" on certain things...
      USAGE
      const response = await Bot.awaitReply(msg, "Favourite Color?");
      msg.reply(`Oh, I really love ${response} too!`);
      */
    Bot.awaitReply = async (msg, question, limit = 60000) => {
        const filter = m => m.author.id === msg.author.id;
        await msg.channel.send(question).catch(() => {Bot.logger.error("Broke in awaitReply");});
        try {
            const collected = await msg.channel.awaitMessages(filter, {max: 1, time: limit, errors: ["time"]});
            return collected.first().content;
        } catch (e) {
            return false;
        }
    };

    /*
     * STRING TRUNCATE FUNCTION
     */
    Bot.truncate = (string, len, terminator="...") => {
        const termLength = terminator.length;

        if (string.length > len) {
            return string.substring(0, len - termLength) + terminator;
        } else {
            return string;
        }
    };

    /*
      MESSAGE CLEAN FUNCTION
      "Clean" removes @everyone pings, as well as tokens, and makes code blocks
      escaped so they're shown more easily. As a bonus it resolves promises
      and stringifies objects!
      This is mostly only used by the Eval and Exec commands.
      */
    Bot.clean = async (client, text) => {
        if (text && text.constructor.name == "Promise")
            text = await text;
        if (typeof evaled !== "string")
            text = inspect(text, {
                depth: 0
            });

        text = text
            .replace(/`/g, "`" + String.fromCharCode(8203))
            .replace(/@/g, "@" + String.fromCharCode(8203))
            .replace(client.token, "mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0");

        return text;
    };

    /* MISCELANEOUS NON-CRITICAL FUNCTIONS */

    // `await wait(1000);` to "pause" for 1 second.
    Bot.wait = promisify(setTimeout);

    // These 2 simply handle unhandled things. Like Magic. /shrug
    process.on("uncaughtException", (err) => {
        const errorMsg = err.stack.replace(new RegExp(`${process.cwd()}`, "g"), ".");
        console.error(`[${Bot.myTime()}] Uncaught Exception: `, errorMsg);

        // If it's that error, don't bother showing it again
        try {
            if (!errorMsg.startsWith("Error: RSV2 and RSV3 must be clear") && Bot.config.logs.logToChannel) {
                client.channels.cache.get(Bot.config.logs.channel).send("```inspect(errorMsg)```",{split: true});
            }
        } catch (e) {
            // Don't bother doing anything
        }
        // Always best practice to let the code crash on uncaught exceptions.
        // Because you should be catching them anyway.
        process.exit(1);
    });

    process.on("unhandledRejection", (err) => {
        const errorMsg = err.stack.replace(new RegExp(`${process.cwd()}`, "g"), ".");
        if (errorMsg.includes("ShardClientUtil._handleMessage") && errorMsg.includes("client is not defined")) {
            Bot.logger.error("The following error probably has to do with a 'client' inside a broadcastEval");
        }
        Bot.logger.error(`Uncaught Promise Error: ${errorMsg}`, true);
        try {
            if (Bot.config.logs.logToChannel) {
                client.channels.cache.get(Bot.config.logs.channel).send(`\`\`\`${inspect(errorMsg)}\`\`\``,{split: true});
            }
        } catch (e) {
            // Don't bother doing anything
        }
    });

    /*
     *  COMMAND HELP OUTPUT
     *  Input the language and the command, and it'll give ya back the embed object to send
     */
    Bot.helpOut = (message, command) => {
        const language = message.language;
        const help = language.get(`COMMAND_${command.help.name.toUpperCase()}_HELP`);
        if (!help || !help.actions) Bot.logger.error("Broke in helpOut with " + message.content);
        const actions = help.actions ? help.actions.slice() : [];
        let headerString = `**Aliases:** \`${command.conf.aliases.length > 0 ? command.conf.aliases.join(", ") : "No aliases for this command"}\`\n**Description:** ${help.description}\n`;

        // Stick the extra help bit in
        actions.push(language.get("BASE_COMMAND_HELP_HELP", command.help.name.toLowerCase()));
        const actionArr = [];

        actions.forEach(action => {
            const outAct = {};
            const keys = Object.keys(action.args);
            let argString = "";
            if (keys.length > 0) {
                keys.forEach(key => {
                    argString += `**${key}**  ${action.args[key]}\n`;
                });
            }
            if (action.action && action.action.length) {
                outAct.name = action.action;
                if (action.usage && action.usage.length) {
                    outAct.value = `${action.actionDesc === "" ? "" : action.actionDesc} \n\`\`\`${action.usage}\`\`\`${argString}\n`;
                } else {
                    outAct.value = `${action.actionDesc === "" ? "" : action.actionDesc} \n${argString}\n`;
                }
                actionArr.push(outAct);
            } else {
                if (action.usage && action.usage.length) {
                    headerString += `\`\`\`${action.usage}\`\`\`${argString}`;
                } else {
                    headerString += argString;
                }
            }
        });
        message.channel.send({embed: {
            "color": "#605afc",
            "author": {
                "name": language.get("BASE_COMMAND_HELP_HEADER", command.help.name)
            },
            "description": headerString,
            "fields": actionArr
        }}).catch(() => {Bot.logger.error("Broke in helpOut");});
    };


    /*
     *  MESSAGE SPLITTER
     *  Input an array of strings, and it will put them together so that it
     *  doesn't exceed the given max length.
     */
    Bot.msgArray = (arr, join="\n", maxLen=1900) => {
        const messages = [];
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

    /*
     * CODE BLOCK MAKER
     * Makes a codeblock with the specified lang for highlighting.
     */
    Bot.codeBlock = (str, lang="") => {
        return `\`\`\`${lang}\n${str}\`\`\``;
    };

    /*
     * Return a duration string
     */
    Bot.duration = (time, message=null) => {
        const lang = message ? message.language : Bot.languages[Bot.config.defaultSettings.language];
        return moment.duration(Math.abs(moment(time).diff(moment()))).format(`d [${lang.getTime("DAY", "PLURAL")}], h [${lang.getTime("HOUR", "SHORT_PLURAL")}], m [${lang.getTime("MINUTE", "SHORT_SING")}]`);
    };

    /*
     * LAST UPDATED FOOTER
     * Simple one to make the "Last updated ____ " footers
     */
    Bot.updatedFooter = (updated, message=null, type="player", userCooldown) => {
        const baseCooldown = { player: 2, guild: 6 };
        const minCooldown = { player: 1, guild: 3 };

        if (!userCooldown) userCooldown = baseCooldown;
        let between = Bot.convertMS(new Date() - new Date(updated));

        if (between.hour >= minCooldown[type] && between.hour < userCooldown[type]) {
            // If the data is between the shorter time they'd get from patreon, and the
            // time they'd get without, stick the patreon link in the footer
            between = " | patreon.com/swgohbot";
        } else {
            // Otherwise, if it's too new, too old, or they already have the faster
            // times, don't add it in
            between = "";
        }
        return {
            text: message.language.get("BASE_SWGOH_LAST_UPDATED", Bot.duration(updated, message)) + between
        };
    };

    /*
     * Get the current user count
     */
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

    /*
     * Get the current guild count
     */
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

    /*
     * Find an emoji by ID
     * Via https://discordjs.guide/#/sharding/extended?id=using-functions-continued
     */
    client.findEmoji = (id) => {
        const temp = client.emojis.cache.get(id);
        if (!temp) return null;

        // Clone the object because it is modified right after, so as to not affect the cache in client.emojis
        const emoji = Object.assign({}, temp);
        // Circular references can't be returned outside of eval, so change it to the id
        if (emoji.guild) emoji.guild = emoji.guild.id;
        // A new object will be construted, so simulate raw data by adding this property back
        emoji.require_colons = emoji.requiresColons;

        return emoji;
    };


    /*
     * Use the findEmoji() to check all shards if sharded
     * If sharded, also use the example from
     * https://discordjs.guide/#/sharding/extended?id=using-functions-continued
     */
    client.getEmoji = (id) => {
        if (client.shard && client.shard.count > 0) {
            return client.shard.broadcastEval(`this.findEmoji('${id}');`)
                .then(emojiArray => {
                    // Locate a non falsy result, which will be the emoji in question
                    const foundEmoji = emojiArray.find(emoji => emoji);
                    if (!foundEmoji) return false;

                    return client.api.guilds(foundEmoji.guild).get()
                        .then(raw => {
                            const guild = new Discord.Guild(client, raw);
                            const emoji = new Discord.Emoji(guild, foundEmoji);
                            return emoji;
                        });
                });
        } else {
            const emoji = client.findEmoji(id);
            if (!emoji) return false;
            return new Discord.Emoji(client.guilds.cache.get(emoji.guild), emoji);
        }
    };

    // Load all the emotes that may be used for the bot at some point (from data/emoteIDs.js)
    client.loadAllEmotes = async () => {
        const emoteList = require("../data/emoteIDs.js");
        for (const emote of Object.keys(emoteList)) {
            const e = await client.getEmoji(emoteList[emote]);
            if (!e) {
                Bot.logger.error("Couldn't get emote: " + emote);
                continue;
            } else {
                Bot.emotes[emote] = e;
            }
        }
    };



    /*
     * isUserID
     * Check if a string of numbers is a valid user.
     */
    Bot.isUserID = (numStr) => {
        const match = /(?:\\<@!?)?([0-9]{17,20})>?/gi.exec(numStr);
        return match ? true : false;
    };

    /*
     * getUserID
     * Get a valid Discord id string from a given string.
     */
    Bot.getUserID = (numStr) => {
        const match = /(?:\\<@!?)?([0-9]{17,20})>?/gi.exec(numStr);
        if (match) {
            return numStr.replace(/[^0-9]/g, "");
        }
        return null;
    };

    /*
     * isAllyCode
     * Check if a string of numbers is a valid ally code.
     */
    Bot.isAllyCode = (aCode) => {
        const match = aCode.toString().replace(/[^\d]*/g, "").match(/\d{9}/);
        return match ? true : false;
    };

    /*
     * makeTable
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
        if (!headers || !rows || !rows.length) throw new Error("Need both headers and rows");
        const max = {};
        Object.keys(headers).forEach(h => {
            // Get the max length needed, then add a bit for padding
            if (options.useHeader) {
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
            Object.keys(headers).forEach((h, ix) => {
                const rowMax = max[h];
                const head = headers[h];
                let value = r[h];
                if (!value) {
                    value = 0;
                }
                const pad = rowMax - value.toString().length;
                row += head.startWith ? head.startWith : "";
                if (!head.align || (head.align && head.align === "center")) {
                    const padBefore = Math.floor(pad/2);
                    const padAfter = pad-padBefore;
                    if (padBefore) row += " ".repeat(padBefore);
                    row += value;
                    if (padAfter) row  += " ".repeat(padAfter);
                } else if (head.align === "left" && ix === 0 && !h.startWith) {
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

    /*
     * Small function to search the factions
     */
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


    // Expand multiple spaces to have zero width spaces between so
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
        if (Array.isArray(user)) user = user.join(" ");
        if (user) {
            user = user.toString().trim();
        }
        let uID;
        if (!user || user === "me" || Bot.isUserID(user)) {
            if ((!user || user === "me") && useMessageId) {
                uID = message.author.id;
            } else {
                uID = user.replace(/[^\d]*/g, "");
            }
            try {
                const exists = await Bot.userReg.getUser(uID);
                if (exists && exists.accounts.length) {
                    const account = exists.accounts.find(a => a.primary);
                    return [account.allyCode];
                } else {
                    return [];
                }
            } catch (e) {
                return [];
            }
        }  else if (Bot.isAllyCode(user)) {
            return [user.replace(/[^\d]*/g, "")];
        }  else {
            const outArr = [];
            const results = await Bot.swgohAPI.playerByName(user);
            if (results.length > 1) {
                results.forEach(p => {
                    outArr.push(p.allyCode);
                });
            } else if (results.length ===  1) {
                outArr.push(results[0].allyCode);
            }
            return outArr;
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

    // Clean mentions out of messages and replace them with the text version
    Bot.cleanMentions = (guild, input) => {
        return input
            .replace(/@(here|everyone)/g, `@${Bot.zws}$1`)
            .replace(/<(@[!&]?|#)(\d{17,19})>/g, (match, type, id) => {
                switch (type) {
                    case "@":
                    case "@!": {
                        const  user = guild.members.cache.get(id);
                        return user ? `@${user.displayname}` : `<${type}${Bot.zws}${id}>`;
                    }
                    case "@&": {
                        const  role = guild.roles.cache.get(id);
                        return role ? `@${role.name}` : match;
                    }
                    case "#": {
                        const  channel  = guild.channels.cache.get(id);
                        return channel ? `#${channel.name}` : `<${type}${Bot.zws}${id}>`;
                    }
                    default: return `<${type}${Bot.zws}${id}>`;
                }
            });
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
};
