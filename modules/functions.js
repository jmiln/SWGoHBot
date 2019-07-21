const momentTZ = require("moment-timezone");
const Fuse = require("fuse-js-latest");
require("moment-duration-format");
const {promisify, inspect} = require("util");      // eslint-disable-line no-unused-vars
const moment = require("moment");       // eslint-disable-line no-unused-vars
const fs = require("fs");    // eslint-disable-line no-unused-vars
const readdir = promisify(require("fs").readdir);       // eslint-disable-line no-unused-vars
const request = require("request-promise-native");
const Discord = require("discord.js");

module.exports = (Bot, client) => {
    // The scheduler for events
    Bot.schedule = require("node-schedule");

    // A zero-width-space
    Bot.zws = "\u200B";

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
        if (message.channel.type === "text") {
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
                const adminRole = message.guild.roles.find(r => r.name.toLowerCase() === adminRoles[ix].toLowerCase());
                if (adminRole && message.member.roles.has(adminRole.id)) return permlvl = 3;
            }
        } catch (e) {() => {};}
        return permlvl;
    };

    Bot.myTime = () => {
        return momentTZ.tz("US/Pacific").format("M/D/YYYY hh:mma");
    };

    // This finds any character that matches the search, and returns them in an array
    Bot.findChar = (searchName, charList, ship=false) => {
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

    /*
     * LOGGING FUNCTION
     * Logs to console. Future patches may include time+colors
     */
    Bot.log = (type, msg, title="Log", codeType="md", prefix="", options={}) => {
        console.log(`[${Bot.myTime()}] [${type}] [${title}]${msg}`);
        if (!options.noSend) {
            try {
                const chan = Bot.config.logs.channel;
                const mess = `${prefix === "" ? "" : prefix + " "}[${Bot.myTime()}] [${type}] ${msg}`.replace(/\n/g, "\"|\"");
                const args = {code: codeType, split: true};
                // Sends the logs to the channel I have set up for it.
                if (Bot.config.logs.logToChannel) {
                    if (client.channels.has(chan)) {
                        client.sendMsg(chan, mess, args);
                    } else if (client.shard && client.shard.count > 0) {
                        // If it's on a different shard, then send it there
                        client.shard.broadcastEval(`
                            const thisChan = ${inspect(chan)};
                            const msg = "${mess}";
                            if (this.channels.has(thisChan)) {
                                this.sendMsg(thisChan, msg, ${inspect(args)});
                            }
                            `);
                    }
                }
            } catch (e) {
                // Probably broken because it's not started yet
                console.log(`[${Bot.myTime()}] I couldn't send a log:\n${e}`);
            }
        }
    };

    client.sendMsg = (chanID, msg, options={}) => {
        if (!msg) return;
        msg = msg.replace(/"\|"/g, "\n").replace(/\|:\|/g, "'");
        client.channels.get(chanID).send(msg, options);
    };

    /*
     *  CHANGELOG MESSAGE
     *  Send a changelog message to the specified channel
     */
    Bot.sendChangelog = (clMessage) => {
        clMessage = clMessage.replace(/\n/g, "\"|\"");
        if (Bot.config.changelog.sendChangelogs) {
            const clChan = Bot.config.changelog.changelogChannel;
            if (client.channels.has(clChan)) {
                client.sendMsg(clChan, clMessage);
            } else {
                try {
                    clMessage = clMessage.replace(/'/g, "|:|");
                    client.shard.broadcastEval(`
                        const clMess = '${clMessage}';
                        if (this.channels.has('${clChan}')) {
                            this.sendMsg('${clChan}', clMess);
                        }
                    `);
                } catch (e) {
                    console.log(`[${Bot.myTime()}] I couldn't send a log:\n${e}`);
                }
            }
        }
    };


    /*
     * ANNOUNCEMENT MESSAGE
     * Sends a message to the set announcement channel
     */
    Bot.announceMsg = async (guild, announceMsg, channel="") => {
        const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guild.id}, attributes: ["announceChan"]});
        const guildConf = guildSettings.dataValues;

        let announceChan = guildConf.announceChan;
        if (channel !== "") {
            announceChan = channel;
        }
        // Try and get it by ID first
        let chan = guild.channels.get(announceChan.replace(/[^0-9]/g, ""));

        // If  that didn't work, try and get it by name
        if (!chan) {
            chan = guild.channels.find(c => c.name === announceChan);
        }

        // If that still didn't work, or if it doesn't have the base required perms, return
        if (!chan || !chan.send || !chan.permissionsFor(guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
            return;
        } else {
            // If everything is ok, go ahead and try sending the message
            await chan.send(announceMsg).catch(console.error);
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
                console.log("Error: " + e);
                errArr.push(f);
            }
        });
        const channel = client.channels.get(msgID);
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
                console.log("In Event reload: " + e);
                errEv.push(file);
            }
        });
        const channel = client.channels.get(msgID);
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
        } catch (e) {
            err = e;
        }
        const channel = client.channels.get(msgID);
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
        const channel = client.channels.get(msgID);
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
        const channel = client.channels.get(msgID);
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
        } catch (e) {
            err = e;
        }
        const channel = client.channels.get(msgID);
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
        const channel = client.channels.get(chanID);
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
        await msg.channel.send(question);
        try {
            const collected = await msg.channel.awaitMessages(filter, {max: 1, time: limit, errors: ["time"]});
            return collected.first().content;
        } catch (e) {
            return false;
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
        const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
        console.error(`[${Bot.myTime()}] Uncaught Exception: `, errorMsg);

        // If it's that error, don't bother showing it again
        try {
            if (!errorMsg.startsWith("Error: RSV2 and RSV3 must be clear") && Bot.config.logs.logToChannel) {
                client.channels.get(Bot.config.logs.channel).send("```inspect(errorMsg)```",{split: true});
            }
        } catch (e) {
            // Don't bother doing anything
        }
        // Always best practice to let the code crash on uncaught exceptions.
        // Because you should be catching them anyway.
        process.exit(1);
    });

    process.on("unhandledRejection", (err) => {
        const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
        console.error(`[${Bot.myTime()}] Uncaught Promise Error: `, errorMsg);
        try {
            if (Bot.config.logs.logToChannel) {
                client.channels.get(Bot.config.logs.channel).send(`\`\`\`${inspect(errorMsg)}\`\`\``,{split: true});
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
        const actions = help.actions.slice();
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
            "color": 0x605afc,
            "author": {
                "name": language.get("BASE_COMMAND_HELP_HEADER", command.help.name)
            },
            "description": headerString,
            "fields": actionArr
        }});
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
            if (typeof elem !== "string") console.log(elem + " Is not a string!");
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
            await client.shard.fetchClientValues("users.size")
                .then(results => {
                    users =  results.reduce((prev, val) => prev + val, 0);
                })
                .catch(console.error);
            return users;
        } else {
            return client.users.size;
        }
    };

    /*
     * Get the current guild count
     */
    Bot.guildCount = async () => {
        let guilds = 0;
        if (client.shard && client.shard.count > 0) {
            await client.shard.fetchClientValues("guilds.size")
                .then(results => {
                    guilds =  results.reduce((prev, val) => prev + val, 0);
                })
                .catch(console.error);
            return guilds;
        } else {
            return client.guilds.size;
        }
    };

    /*
     * Find an emoji by ID
     * Via https://discordjs.guide/#/sharding/extended?id=using-functions-continued
     */
    client.findEmoji = (id) => {
        const temp = client.emojis.get(id);
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

                    return client.rest.makeRequest("get", Discord.Constants.Endpoints.Guild(foundEmoji.guild).toString(), true)
                        .then(raw => {
                            const guild = new Discord.Guild(client, raw);
                            const emoji = new Discord.Emoji(guild, foundEmoji);
                            return emoji;
                        });
                });
        } else {
            const emoji = client.findEmoji(id);
            if (!emoji) return false;
            return new Discord.Emoji(client.guilds.get(emoji.guild), emoji);
        }
    };

    // Load all the emotes that may be used for the bot at some point (from data/emoteIDs.js)
    client.loadAllEmotes = async () => {
        const emoteList = require("../data/emoteIDs.js");
        for (const emote of Object.keys(emoteList)) {
            const e = await client.getEmoji(emoteList[emote]);
            if (!e) {
                console.log("Couldn't get emote: " + emote);
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
        const match = aCode.replace(/[^\d]*/g, "").match(/\d{9}/);
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
    Bot.getAllyCode = async (message, user) => {
        if (user) {
            user = user.toString().trim();
        }
        let uID, uAC;
        if (!user || user === "me" || Bot.isUserID(user)) {
            if (!user || user === "me") {
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
                    uAC = await Bot.swgohAPI.whois(uID);
                    if (uAC.get.length) {
                        await Bot.userReg.addUser(uAC.get[0].discordId, uAC.get[0].allyCode);
                        return [uAC.get[0].allyCode];
                    }
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


    // Bunch of stuff for the events
    Bot.loadAllEvents = async () => {
        let ix = 0;
        const nowTime = momentTZ().unix() * 1000;                       // The current time of it running
        const oldTime = momentTZ().subtract(20, "m").unix() * 1000;     // 20 min ago, don't try again if older than this
        const events = await Bot.database.models.eventDBs.findAll();

        const eventList = [];
        for (let i = 0; i < events.length; i++ ) {
            const event = events[i];
            const eventNameID = event.eventID.split("-");
            const guildID = eventNameID[0];

            // Make sure it only loads events for it's shard
            if (client.guilds.keyArray().includes(guildID)) {
                const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guildID}, attributes: Object.keys(Bot.config.defaultSettings)});
                const guildConf = guildSettings.dataValues;
                eventList.push([event.dataValues, guildConf]);
            }
        }

        if (eventList.length > 0) {
            for (let i = 0; i < eventList.length; i++ ) {
                const [event, guildConf] = eventList[i];
                // If it's past when it was supposed to announce
                if (event.eventDT < nowTime) {
                    // If it's been skipped over somehow (probably bot reboot or discord connection issue)
                    if (event.eventDT > oldTime) {
                        // If it's barely missed the time (within 20min), then send it late, but with a
                        // note about it being late, then re-schedule if needed
                        let eventName = event.eventID.split("-");
                        const guildID = eventName.splice(0, 1)[0];
                        eventName = eventName.join("-");

                        const lang = Bot.languages[guildConf.language] || Bot.languages["en_US"];

                        // Alert them that it was skipped with a note
                        const announceMessage = `**${eventName}**\n${event.eventMessage} \n\n${Bot.codeBlock(lang.get("BASE_EVENT_LATE"))}`;
                        if (guildConf["announceChan"] != "" || event.eventChan !== "") {
                            if (event["eventChan"] && event.eventChan !== "") { // If they've set a channel, use it
                                try {
                                    Bot.announceMsg(client.guilds.get(guildID), announceMessage, event.eventChan);
                                } catch (e) {
                                    Bot.log("ERROR", "Broke trying to announce event with ID: ${ev.eventID} \n${e}");
                                }
                            } else { // Else, use the default one from their settings
                                Bot.announceMsg(client.guilds.get(guildID), announceMessage);
                            }
                        }
                    }
                    if (event.repeatDays.length || (event.repeat.repeatDay || event.repeat.repeatHour || event.repeat.repeatMin)) {
                        // If it's got a repeat set up, simulate it/ find the next viable time then re-set it in the future/ wipe the old one
                        const tmpEv = await reCalc(event, nowTime);
                        if (tmpEv) {
                            // Got a viable next time, so set it and move on
                            event.eventDT = tmpEv.eventDT;
                            event.repeatDays = tmpEv.repeatDays;
                            event.repeat = tmpEv.repeat;
                            // Save it back with the new values
                            await Bot.database.models.eventDBs.update(event, {where: {eventID: event.eventID}})
                                .then(async () => {
                                    Bot.scheduleEvent(event, guildConf.eventCountdown);
                                });
                        } else {
                            // There was no viable next time, so wipe it out
                            await Bot.database.models.eventDBs.destroy({where: {eventID: event.eventID}})
                                .catch(error => { Bot.log("ERROR",`Broke trying to delete zombies ${error}`); });
                        }
                    } else {
                        // If no repeat and it's long-gone, just wipe it from existence
                        await Bot.database.models.eventDBs.destroy({where: {eventID: event.eventID}})
                            .catch(error => { Bot.log("ERROR",`Broke trying to delete zombies ${error}`); });
                    }
                } else {
                    ix++;
                    Bot.scheduleEvent(event, guildConf.eventCountdown);
                }
            }
        }
        console.log(`Loaded ${ix} events`);
    };

    // Actually schedule em here
    Bot.scheduleEvent = async (event, countdown) => {
        Bot.schedule.scheduleJob(event.eventID, parseInt(event.eventDT), function() {
            Bot.eventAnnounce(event);
        });

        if (countdown.length && (event.countdown === "true" || event.countdown === "yes" || event.countdown === true)) {
            const timesToCountdown = countdown;
            const nowTime = momentTZ().unix() * 1000;
            timesToCountdown.forEach(time => {
                const cdTime = time * 60;
                const evTime = event.eventDT / 1000;
                const newTime = (evTime-cdTime-60) * 1000;
                if (newTime > nowTime) {    // If the countdown is between now and the event
                    const sID = `${event.eventID}-CD${time}`;
                    if (!Bot.evCountdowns[event.eventID]) {
                        Bot.evCountdowns[event.eventID] = [sID];
                    } else {
                        Bot.evCountdowns[event.eventID].push(sID);
                    }
                    Bot.schedule.scheduleJob(sID, parseInt(newTime) , function() {
                        Bot.countdownAnnounce(event);
                    });
                }
            });
        }
    };

    // Re-caclulate a viable eventDT, and return the updated event
    async function reCalc(ev, nowTime) {
        if (ev.repeatDays.length > 0) { // repeatDays is an array of days to skip
            // If it's got repeatDays set up, splice the next time, and if it runs out of times, return null
            while (nowTime > ev.eventDT && ev.repeatDays.length > 0) {
                const days = ev.repeatDays.splice(0, 1)[0];
                ev.eventDT = momentTZ(parseInt(ev.eventDT)).add(parseInt(days), "d").unix()*1000;
            }
            if (nowTime > ev.eventDT) { // It ran out of days
                return null;
            }
        } else { // 0d0h0m
            // Else it's using basic repeat
            while (nowTime > ev.eventDT) {
                ev.eventDT = momentTZ(parseInt(ev.eventDT)).add(ev.repeat.repeatDay, "d").add(ev.repeat.repeatHour, "h").add(ev.repeat.repeatMin, "m").unix()*1000;
            }
        }
        return ev;
    }

    // Delete em here as needed
    Bot.deleteEvent = async (eventID) => {
        const event = await Bot.database.models.eventDBs.findOne({where: {eventID: eventID}});

        await Bot.database.models.eventDBs.destroy({where: {eventID: eventID}})
            .then(() => {
                const eventToDel = Bot.schedule.scheduledJobs[eventID];
                if (!eventToDel) {
                    console.log("Could not find scheduled event to delete: " + event);
                } else {
                    eventToDel.cancel();
                }
            })
            .catch(error => {
                Bot.log("ERROR",`Broke deleting an event ${error}`);
            });

        if (Bot.evCountdowns[event.eventID] && (event.countdown === "true" || event.countdown === "yes")) {
            Bot.evCountdowns[event.eventID].forEach(time => {
                const eventToDel = Bot.schedule.scheduledJobs[time];
                if (eventToDel) {
                    eventToDel.cancel();
                }
            });
        }
    };

    // To stick into node-schedule for each countdown event
    Bot.countdownAnnounce = async (event) => {
        let eventName = event.eventID.split("-");
        const guildID = eventName.splice(0, 1)[0];
        eventName = eventName.join("-");

        const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guildID}, attributes: Object.keys(Bot.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;

        var timeToGo = momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT)), "minutes") * -1, "minutes").format(`h [${Bot.languages[guildConf.language].getTime("HOUR", "SHORT_SING")}], m [${Bot.languages[guildConf.language].getTime("MINUTE", "SHORT_SING")}]`);
        var announceMessage = Bot.languages[guildConf.language].get("BASE_EVENT_STARTING_IN_MSG", eventName, timeToGo);

        if (guildConf["announceChan"] != "" || event.eventChan !== "") {
            if (event["eventChan"] && event.eventChan !== "") { // If they've set a channel, use it
                Bot.announceMsg(client.guilds.get(guildID), announceMessage, event.eventChan);
            } else { // Else, use the default one from their settings
                Bot.announceMsg(client.guilds.get(guildID), announceMessage);
            }
        }
    };

    // To stick into node-schedule for each full event
    Bot.eventAnnounce = async (event) => {
        // Parse out the eventName and guildName from the ID
        let eventName = event.eventID.split("-");
        const guildID = eventName.splice(0, 1)[0];
        eventName = eventName.join("-");

        const guildSettings = await Bot.database.models.settings.findOne({where: {guildID: guildID}, attributes: Object.keys(Bot.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;

        let repTime = false, repDay = false;
        let newEvent = {};
        const repDays = event.repeatDays;

        if (event.countdown === "yes") {
            event.countdown = "true";
        } else if (event.countdown === "no") {
            event.countdown = "false";
        }

        // Announce the event
        var announceMessage = `**${eventName}**\n${event.eventMessage}`;
        if (guildConf["announceChan"] != "" || event.eventChan !== "") {
            if (event["eventChan"] && event.eventChan !== "") { // If they've set a channel, use it
                try {
                    Bot.announceMsg(client.guilds.get(guildID), announceMessage, event.eventChan);
                } catch (e) {
                    Bot.log("ERROR", "Broke trying to announce event with ID: ${event.eventID} \n${e}");
                }
            } else { // Else, use the default one from their settings
                Bot.announceMsg(client.guilds.get(guildID), announceMessage);
            }
        }

        // If it's got any left in repeatDays
        if (repDays.length > 0) {
            repDay = true;
            let eventMsg = event.eventMessage;
            // If this is the last time, tack a message to the end to let them know it's the last one
            if (repDays.length === 1) {
                eventMsg += Bot.languages[guildConf.language].get("BASE_LAST_EVENT_NOTIFICATION");
            }
            newEvent = {
                "eventID": event.eventID,
                "eventDT": (momentTZ(parseInt(event.eventDT)).add(parseInt(repDays.splice(0, 1)), "d").unix()*1000),
                "eventMessage": eventMsg,
                "eventChan": event.eventChan,
                "countdown": event.countdown,
                "repeat": {
                    "repeatDay": 0,
                    "repeatHour": 0,
                    "repeatMin": 0
                },
                "repeatDays": repDays
            };
            // Else if it's set to repeat
        } else if (event["repeat"] && (event.repeat["repeatDay"] !== 0 || event.repeat["repeatHour"] !== 0 || event.repeat["repeatMin"] !== 0)) { // At least one of em is more than 0
            repTime = true;
            newEvent = {
                "eventID": event.eventID,
                "eventDT": (momentTZ(parseInt(event.eventDT)).add(event.repeat["repeatDay"], "d").add(event.repeat["repeatHour"], "h").add(event.repeat["repeatMin"], "m").unix()*1000),
                "eventMessage": event.eventMessage,
                "eventChan": event.eventChan,
                "countdown": event.countdown,
                "repeat": {
                    "repeatDay": event.repeat["repeatDay"],
                    "repeatHour": event.repeat["repeatHour"],
                    "repeatMin": event.repeat["repeatMin"]
                },
                "repeatDays": []
            };
        }

        if (repTime || repDay) {
            await Bot.database.models.eventDBs.update(newEvent, {where: {eventID: event.eventID}})
                .then(async () => {
                    Bot.scheduleEvent(newEvent, guildConf.eventCountdown);
                })
                .catch(error => { Bot.log("ERROR", "Broke trying to replace event: " + error); });
        } else {
            // Just destroy it
            await Bot.database.models.eventDBs.destroy({where: {eventID: event.eventID}})
                .then(async () => {})
                .catch(error => { Bot.log("ERROR",`Broke trying to delete old event ${error}`); });
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


    // Reload the SWGoH data for all patrons
    Bot.reloadPatrons = async () => {
        try {
            Bot.patrons = await Bot.getPatrons();
        } catch (e) {
            // Something happened
            console.log("Broke getting patrons: " + e);
        }
        // console.log("Reloaded " + Bot.patrons.length + " active patrons");
    };

    // Get the cooldown
    Bot.getPlayerCooldown = (author) => {
        const patron = Bot.patrons.find(u => u.discordID === author);
        if (!patron) {
            return {
                player: 2*60,
                guild:  6*60
            };
        }
        if (patron.amount_cents >= 500) {
            // If they have the $5 tier or higher, they get shorted guild & player times
            return {
                player: 60,
                guild:  3*60
            };
        } else if (patron.amount_cents >= 100) {
            // They have the $1 tier, so they get short player times
            return {
                player: 60,
                guild:  6*60
            };
        } else {
            // If they are not a patron, their cooldown is the default
            return {
                player: 2*60,
                guild:  6*60
            };
        }
    };

    // Check for updated ranks
    Bot.getRanks = async () => {
        for (const patron of Bot.patrons) {
            if (patron.amount_cents < 100) continue;
            const user = await Bot.userReg.getUser(patron.discordID);
            // If they're not registered with anything or don't have any ally codes
            if (!user || !user.accounts.length) continue;

            // If they don't want any alerts
            if (!user.arenaAlert || user.arenaAlert.enableRankDMs === "off") continue;
            const accountsToCheck = JSON.parse(JSON.stringify(user.accounts));

            for (let ix = 0; ix < accountsToCheck.length; ix++) {
                const acc = accountsToCheck[ix];
                if (((user.accounts.length > 1 && patron.amount_cents < 500) || user.arenaAlert.enableRankDMs === "primary") && !acc.primary) {
                    continue;
                }
                let player;
                try {
                    player = await Bot.swgohAPI.fastPlayer(acc.allyCode);
                } catch (e) {
                    return console.log("Broke in getRanks: " + e.message);
                }
                if (!acc.lastCharRank) {
                    acc.lastCharRank = 0;
                    acc.lastCharClimb = 0;
                }
                if (!acc.lastShipRank) {
                    acc.lastShipRank = 0;
                    acc.lastShipClimb = 0;
                }
                const now = moment();
                if (!user.arenaAlert.arena) user.arenaAlert.arena = "none";
                if (!user.arenaAlert.payoutWarning) user.arenaAlert.payoutWarning = 0;
                if (player.arena.char && player.arena.char.rank) {
                    if (["both", "char"].includes(user.arenaAlert.arena)) {
                        let then = moment(now).utcOffset(player.poUTCOffsetMinutes).endOf("day").subtract(6, "h");
                        if (then.unix() < now.unix()) {
                            then = moment(now).utcOffset(player.poUTCOffsetMinutes).endOf("day").add(18, "h");
                        }
                        const minTil =  parseInt((then-now)/60/1000);
                        const payoutTime = moment.duration(then-now).format("h[h] m[m]") + " until payout.";

                        const pUser = await client.fetchUser(patron.discordID);
                        if (pUser) {
                            if (user.arenaAlert.payoutWarning > 0) {
                                if (user.arenaAlert.payoutWarning  === minTil) {
                                    pUser.send({embed: {
                                        author: {name: "Arena Payout Alert"},
                                        description: `${player.name}'s character arena payout is in **${minTil}** minutes!\nYour current rank is ${player.arena.char.rank}`,
                                        color: 0x00FF00
                                    }});
                                }
                            }
                            if (minTil === 0 && user.arenaAlert.enablePayoutResult) {
                                pUser.send({embed: {
                                    author: {name: "Character arena"},
                                    description: `${player.name}'s payout ended at **${player.arena.char.rank}**!`,
                                    color: 0x00FF00
                                }});
                            }

                            if (player.arena.char.rank > acc.lastCharRank) {
                                // DM user that they dropped
                                pUser.send({embed: {
                                    author: {name: "Character Arena"},
                                    description: `**${player.name}'s** rank just dropped from ${acc.lastCharRank} to **${player.arena.char.rank}**\nDown by **${player.arena.char.rank - acc.lastCharClimb}** since last climb`,
                                    color: 0xff0000,
                                    footer: {
                                        text: payoutTime
                                    }
                                }});
                            }
                        }
                    }
                    acc.lastCharClimb = acc.lastCharClimb ? (player.arena.char.rank < acc.lastCharRank ? player.arena.char.rank : acc.lastCharClimb) : player.arena.char.rank;
                    acc.lastCharRank = player.arena.char.rank;
                }
                if (player.arena.ship && player.arena.ship.rank) {
                    if (["both", "fleet"].includes(user.arenaAlert.arena)) {
                        let then = moment(now).utcOffset(player.poUTCOffsetMinutes).endOf("day").subtract(5, "h");
                        if (then.unix() < now.unix()) {
                            then = moment(now).utcOffset(player.poUTCOffsetMinutes).endOf("day").add(19, "h");
                        }

                        const minTil =  parseInt((then-now)/60/1000);
                        const payoutTime = moment.duration(then-now).format("h[h] m[m]") + " until payout.";
                        const pUser = await client.fetchUser(patron.discordID);
                        if (pUser) {
                            if (user.arenaAlert.payoutWarning > 0) {
                                if (user.arenaAlert.payoutWarning  === minTil) {
                                    pUser.send({embed: {
                                        author: {name: "Arena Payout Alert"},
                                        description: `${player.name}'s ship arena payout is in **${minTil}** minutes!`,
                                        color: 0x00FF00
                                    }});
                                }
                            }

                            if (minTil === 0 && user.arenaAlert.enablePayoutResult) {
                                pUser.send({embed: {
                                    author: {name: "Fleet arena"},
                                    description: `${player.name}'s payout ended at **${player.arena.ship.rank}**!`,
                                    color: 0x00FF00
                                }});
                            }

                            if (player.arena.ship.rank > acc.lastShipRank) {
                                pUser.send({embed: {
                                    author: {name: "Fleet Arena"},
                                    description: `**${player.name}'s** rank just dropped from ${acc.lastShipRank} to **${player.arena.ship.rank}**\nDown by **${player.arena.ship.rank - acc.lastShipClimb}** since last climb`,
                                    color: 0xff0000,
                                    footer: {
                                        text: payoutTime
                                    }
                                }});
                            }
                        }
                    }
                    acc.lastShipClimb = acc.lastShipClimb ? (player.arena.ship.rank < acc.lastShipRank ? player.arena.ship.rank : acc.lastShipClimb) : player.arena.ship.rank;
                    acc.lastShipRank = player.arena.ship.rank;
                }
                if (patron.amount_cents < 500) {
                    user.accounts[user.accounts.findIndex(a => a.primary)] = acc;
                } else {
                    user.accounts[ix] = acc;
                }
                // Wait here in case of extra accounts
                await Bot.wait(500);
            }
            await Bot.userReg.updateUser(patron.discordID, user);
        }
    };

    // Get all patrons and their info
    Bot.getPatrons = async () => {
        const patreon = Bot.config.patreon;
        return new Promise(async (resolve, reject) => {
            if (!patreon) {
                resolve([]);
            }
            try {
                let response = await request({
                    headers: {
                        Authorization: "Bearer " + patreon.creatorAccessToken
                    },
                    uri: "https://www.patreon.com/api/oauth2/api/current_user/campaigns",
                    json: true
                });

                if (response && response.data && response.data.length) {
                    response = await request({
                        headers: {
                            Authorization: "Bearer " + patreon.creatorAccessToken
                        },
                        uri: "https://www.patreon.com/api/oauth2/api/campaigns/1328738/pledges?page%5Bcount%5D=100",
                        json: true
                    });

                    const data = response.data;
                    const included = response.included;

                    const pledges = data.filter(data => data.type === "pledge");
                    const users = included.filter(inc => inc.type === "user");

                    let patrons = [];
                    pledges.forEach(pledge => {
                        const user = users.filter(user => user.id === pledge.relationships.patron.data.id)[0];
                        patrons.push({
                            id:                 pledge.relationships.patron.data.id,
                            full_name:          user.attributes.full_name,
                            vanity:             user.attributes.vanity,
                            email:              user.attributes.email,
                            discordID:          user.attributes.social_connections.discord ? user.attributes.social_connections.discord.user_id : null,
                            amount_cents:       pledge.attributes.amount_cents,
                            created_at:         pledge.attributes.created_at,
                            declined_since:     pledge.attributes.declined_since,
                            patron_pays_fees:   pledge.attributes.patron_pays_fees,
                            pledge_cap_cents:   pledge.attributes.pledge_cap_cents,
                            image_url:          user.attributes.image_url
                        });
                    });

                    // Filter out inactive patrons
                    patrons = patrons.filter(patron => !patron.declined_since);

                    // This is so I can manually add people in, be it bugginess or just so they can try it out
                    const others = Bot.config.patrons ? Bot.config.patrons : [];

                    // Add myself in since I can't really be my own patron
                    others.push(Bot.config.ownerid);
                    others.forEach(o => {
                        if (!patrons.find(p => p.discordID === o)) {
                            patrons.push({
                                discordID: o,
                                amount_cents: 100
                            });
                        }
                    });
                    resolve(patrons);
                }
            } catch (e) {
                console.log("Error getting patrons");
                reject(e);
            }
        });
    };
};
