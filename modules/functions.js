const momentTZ = require('moment-timezone');
const Fuse = require("fuse-js-latest");
require('moment-duration-format');
const {promisify, inspect} = require('util');      // eslint-disable-line no-unused-vars
const moment = require('moment');       // eslint-disable-line no-unused-vars
const fs = require('fs');    // eslint-disable-line no-unused-vars
const readdir = promisify(require("fs").readdir);       // eslint-disable-line no-unused-vars
const request = require('request-promise-native');
const Discord = require('discord.js');

module.exports = (client) => {
    // The scheduler for events
    client.schedule = require("node-schedule");
    
    /*
        PERMISSION LEVEL FUNCTION
        This is a very basic permission system for commands which uses "levels"
        "spaces" are intentionally left black so you can add them if you want.
        NEVER GIVE ANYONE BUT OWNER THE LEVEL 10! By default this can run any
        command including the VERY DANGEROUS `eval` and `exec` commands!
        */
    client.permlevel = message => {
        let permlvl = 0;

        // If bot owner, return max perm level
        if (message.author.id === client.config.ownerid) return 10;

        // If DMs or webhook, return 0 perm level.
        if (!message.guild || !message.member) return 0;
        const guildConf = message.guildSettings;

        // Guild Owner gets an extra level, wooh!
        if (message.channel.type === 'text') {
            if (message.author.id === message.guild.owner.id) return permlvl = 4;
        }

        // Also giving them the permissions if they have the manage server role, 
        // since they can change anything else in the server, so no reason not to
        if (message.member.hasPermission(['ADMINISTRATOR', 'MANAGE_GUILD'])) return permlvl = 3;

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

    client.myTime = () => {
        return momentTZ.tz('US/Pacific').format('M/D/YYYY hh:mma');
    };

    // This finds any character that matches the search, and returns them in an array
    client.findChar = (searchName, charList, ship=false) => {
        const options = {
            tokenize: true,
            matchAllTokens: true,
            threshold: 0,
            distance: 0,
            keys: [ "name", "aliases" ]
        };
        const options2 = {
            keys: ['name', 'aliases'],
            threshold: .1,
            distance: 4
        };
        // In case of any extra spaces
        searchName = searchName.trim().toLowerCase();

        // Check the names for an exact match
        for (let ix = 0; ix < charList.length; ix++) {
            if (charList[ix].name.toLowerCase() === searchName) {
                return [charList[ix]];
            }
        }

        // If there's not an exact name match, fuzzy search it
        if (ship) options.keys.push('crew');
        const fuse = new Fuse(charList, options);
        let chars = fuse.search(searchName);
        if (chars.length >= 1) {
            return chars;
        }

        // If it's not exact, send back the big mess
        if (ship) options2.keys.push('crew');
        const fuse2 = new Fuse(charList, options2);
        chars = fuse2.search(searchName);
        return chars;
    };



    // This find one character that matches the search, and returns it
    client.findCharByName = (searchName, charList) => {
        var options = {
            keys: ['name'],
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
    client.log = (type, msg, title="Log", codeType="md", prefix="") => {
        console.log(`[${client.myTime()}] [${type}] [${title}]${msg}`);
        try {
            const chan = client.config.logs.channel;
            const mess = `${prefix === '' ? '' : prefix + ' '}[${client.myTime()}] [${type}] ${msg}`.replace(/\n/g, '"|"');
            const args = {code: codeType, split: true};
            // Sends the logs to the channel I have set up for it.
            if (client.config.logs.logToChannel) {
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
            console.log(`[${client.myTime()}] I couldn't send a log:\n${e}`);
        }
    };

    client.sendMsg = (chanID, msg, options={}) => {
        msg = msg.replace(/"\|"/g, '\n').replace(/\|:\|/g, "'");
        client.channels.get(chanID).send(msg, options);
    };

    /*
     *  CHANGELOG MESSAGE
     *  Send a changelog message to the specified channel
     */
    client.sendChangelog = (clMessage) => {
        clMessage = clMessage.replace(/\n/g, '"|"');
        if (client.config.changelog.sendChangelogs) {
            const clChan = client.config.changelog.changelogChannel;
            if (client.channels.has(clChan)) {
                client.sendMsg(clChan, clMessage);
            } else {
                try {
                    clMessage = clMessage.replace(/'/g, '|:|');
                    client.shard.broadcastEval(`
                        const clMess = '${clMessage}';
                        if (this.channels.has('${clChan}')) {
                            this.sendMsg('${clChan}', clMess);
                        } 
                    `);
                } catch (e) {
                    console.log(`[${client.myTime()}] I couldn't send a log:\n${e}`);
                }
            }
        }
    };


    /*
     * ANNOUNCEMENT MESSAGE
     * Sends a message to the set announcement channel
     */
    client.announceMsg = async (guild, announceMsg, channel='') => {
        const guildSettings = await client.database.models.settings.findOne({where: {guildID: guild.id}, attributes: ['announceChan']});
        const guildConf = guildSettings.dataValues;
        let guildChannel;

        let announceChan = guildConf.announceChan;
        if (channel !== '') {
            announceChan = channel;
        }

        if (guild.channels.exists('name', announceChan)) {
            guildChannel = await guild.channels.find('name', announceChan);
            if (guildChannel.permissionsFor(guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) {
                await guildChannel.send(announceMsg).catch(console.error);
            } else {
                return;
            }
        } else {
            return;
        }
    };

    /*
     * Loads the given command
     */
    client.loadCommand = (commandName) => {
        try {
            const cmd = new (require(`../commands/${commandName}`))(client);
            if (cmd.help.category === "SWGoH" && !client.swgohAPI) {
                return 'Unable to load command ${commandName}: no swgohAPI';
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
        if (typeof command === 'string') {
            const commandName = command;
            if (client.commands.has(commandName)) {
                command = client.commands.get(commandName);
            } else if (client.aliases.has(commandName)) {
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
        const cmdFiles = await readdir('./commands/');
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
                console.log('Error: ' + e);
                errArr.push(f);
            }
        });
        const channel = client.channels.get(msgID);
        if (channel) {
            channel.send(`Reloaded ${coms.length} commands, failed to reload ${errArr.length} commands.${errArr.length > 0 ? '\n```' + errArr.join('\n') + '```' : ''}`);
        }
    };

    // Reload the events files (message, guildCreate, etc)
    client.reloadAllEvents = async (msgID) => {
        const ev = [], errEv = [];
        const evtFiles = await readdir("./events/");
        evtFiles.forEach(file => {
            try {
                const eventName = file.split(".")[0];
                const event = require(`../events/${file}`);
                client.removeAllListeners(eventName);
                client.on(eventName, event.bind(null, client));
                delete require.cache[require.resolve(`../events/${file}`)];
                ev.push(eventName);
            } catch (e) {
                errEv.push(file);
            }
        });
        const channel = client.channels.get(msgID);
        if (channel) {
            channel.send(`Reloaded ${ev.length} events, failed to reload ${errEv.length} events.${errEv.length > 0 ? '\n```' + errEv.join('\n') + '```' : ''}`);
        }
    };

    // Reload the functions (this) file
    client.reloadFunctions = async (msgID) => {
        let err = false;
        try {
            delete require.cache[require.resolve("../modules/functions.js")];
            require("../modules/functions.js")(client);
        } catch (e) {
            err = e;
        }
        const channel = client.channels.get(msgID);
        if (channel) {
            if (err) {
                channel.send(`Something broke: ${err}`);
            } else {
                channel.send(`Reloaded functions`);
            }
        }
    };

    // Reload the data files (ships, teams, characters)
    client.reloadDataFiles = async (msgID) => {
        let err = false;
        try {
            client.characters = await JSON.parse(fs.readFileSync("data/characters.json"));
            client.ships = await JSON.parse(fs.readFileSync("data/ships.json"));
            client.squads = await JSON.parse(fs.readFileSync("data/squads.json"));
            client.resources = await JSON.parse(fs.readFileSync("data/resources.json"));
        } catch (e) {
            err = e;
        }
        const channel = client.channels.get(msgID);
        if (channel) {
            if (err) {
                channel.send(`Something broke: ${err}`);
            } else {
                channel.send(`Reloaded data files.`);
            }
        }
    };

    // Reload all the language files
    client.reloadLanguages = async (msgID) => {
        let err = false;
        try {
            Object.keys(client.languages).forEach(lang => {
                delete client.languages[lang];
            });
            const langFiles = await readdir(`${process.cwd()}/languages/`);
            langFiles.forEach(file => {
                const langName = file.split(".")[0];
                const lang = require(`${process.cwd()}/languages/${file}`);
                client.languages[langName] = new lang(client);
                delete require.cache[require.resolve(`${process.cwd()}/languages/${file}`)];
            });
        } catch (e) {
            err = e;
        }
        const channel = client.channels.get(msgID);
        if (channel) {
            if (err) {
                channel.send(`Something broke: ${err}`);
            } else {
                channel.send(`Reloaded language files.`);
            }
        }
    };

    /*
      SINGLE-LINE AWAITMESSAGE
      A simple way to grab a single reply, from the user that initiated
      the command. Useful to get "precisions" on certain things...
      USAGE
      const response = await client.awaitReply(msg, "Favourite Color?");
      msg.reply(`Oh, I really love ${response} too!`);
      */
    client.awaitReply = async (msg, question, limit = 60000) => {
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
    client.clean = async (client, text) => {
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

    String.prototype.toProperCase = function() {
        return this.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    };

    // `await wait(1000);` to "pause" for 1 second.
    global.wait = promisify(setTimeout);

    // These 2 simply handle unhandled things. Like Magic. /shrug
    process.on("uncaughtException", (err) => {
        const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
        console.error(`[${client.myTime()}] Uncaught Exception: `, errorMsg);

        // If it's that error, don't bother showing it again
        try {
            if (!errorMsg.startsWith('Error: RSV2 and RSV3 must be clear') && client.config.logs.logToChannel) {
                client.channels.get(client.config.log(`\`\`\`inspect(errorMsg)\`\`\``,{split: true}));
            }
        } catch (e) {
            // Don't bother doing anything
        }
        // Always best practice to let the code crash on uncaught exceptions. 
        // Because you should be catching them anyway.
        process.exit(1);
    });

    process.on("unhandledRejection", err => {
        const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
        console.error(`[${client.myTime()}] Uncaught Promise Error: `, errorMsg);
        try {
            if (client.config.logs.logToChannel) {
                client.channels.get(client.config.logs.channel).send(`\`\`\`${inspect(errorMsg)}\`\`\``,{split: true});
            }
        } catch (e) {
            // Don't bother doing anything
        }
    });

    /*
     *  COMMAND HELP OUTPUT
     *  Input the language and the command, and it'll give ya back the embed object to send
     */
    client.helpOut = (message, command) => {
        const language = message.language;
        const help = language.get(`COMMAND_${command.help.name.toUpperCase()}_HELP`);
        const actions = help.actions.slice();
        let headerString = `**Aliases:** \`${command.conf.aliases.length > 0 ? command.conf.aliases.join(', ') : "No aliases for this command"}\`\n**Description:** ${help.description}\n`;

        // Stick the extra help bit in
        actions.push(language.get('BASE_COMMAND_HELP_HELP', command.help.name.toLowerCase()));
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
            if (action.action !== '') {
                outAct.name = action.action;
                outAct.value = `${action.actionDesc === '' ? '' : action.actionDesc} \n\`\`\`${action.usage}\`\`\`${argString}\n`;
                actionArr.push(outAct);
            } else {
                headerString += `\`\`\`${action.usage}\`\`\`${argString}`;
            }
        });
        message.channel.send({embed: {
            "color": 0x605afc,
            "author": {
                "name": language.get('BASE_COMMAND_HELP_HEADER', command.help.name)
            },
            "description": headerString,
            "fields": actionArr
        }});
    };


    /*
     *  MESSAGE SPLITTER
     *  Input an array of strings, and it will put them together so that it 
     *  doesn't exceed the 2000 character limit of Discord mesages.
     */
    client.msgArray = (arr, join='\n', maxLen=1900) => {
        const messages = [];
        arr.forEach((elem) => {
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
    client.codeBlock = (lang, str) => {
        return `\`\`\`${lang}\n${str}\`\`\``;
    };

    /*
     * Return a duration string
     */
    client.duration = (time, message=null) => {
        const lang = message ? message.language : client.languages[client.config.defaultSettings.language];
        return moment.duration(Math.abs(moment(time).diff(moment()))).format(`d [${lang.getTime('DAY', 'PLURAL')}], h [${lang.getTime('HOUR', 'SHORT_PLURAL')}], m [${lang.getTime('MINUTE', 'SHORT_SING')}]`);
    };

    /*
     * Get the current guild count
     */
    client.guildCount = async () => {
        let guilds = 0;
        if (client.shard && client.shard.count > 0) {
            await client.shard.fetchClientValues('guilds.size')
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
        if (!temp) return false;

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
            return client.shard.broadcastEval(`this.findEmoji('${id}');`)//.call(this, '${id}')`)
                .then(emojiArray => {
                    // Locate a non falsy result, which will be the emoji in question
                    const foundEmoji = emojiArray.find(emoji => emoji);
                    if (!foundEmoji) return false;

                    // console.log(client.guilds.get(foundEmoji.guild));

                    // Reconstruct an emoji object as required by discord.js
                    try {
                        if (!client.guilds.has(foundEmoji.guild)) return false;
                        // Only works if on the same shard, so kinda pointless at this point
                        return new Discord.Emoji(client.guilds.get(foundEmoji.guild), foundEmoji);
                    } catch (e) {
                        console.log(e);
                    }
                });
        } else {
            const emoji = client.findEmoji(id);
            if (!emoji) return false;
            return new Discord.Emoji(client.guilds.get(emoji.guild), emoji);
        }
    };


    /*
     * isUserID
     * Check if a string of numbers is a valid user.
     */
    client.isUserID = (numStr) => {
        const match = /(?:\\<@!?)?([0-9]{17,20})>?/gi.exec(numStr);
        return match ? true : false;
    };

    /*
     * isAllyCode
     * Check if a string of numbers is a valid ally code.
     */
    client.isAllyCode = (aCode) => {
        const match = aCode.replace(/[^\d]*/g, '').match(/\d{9}/);
        return match ? true : false;
    };

    // Expand multiple spaces to have zero width spaces between so 
    // Discord doesn't collapse em
    client.expandSpaces = (str) => {
        let outStr = '';
        str.split(/([\s]{2,})/).forEach(e => {
            if (e.match(/[\s]{2,}/)) {
                outStr += e.split('').join('\u200B');
            } else {
                outStr += e;
            }
        });
        return outStr;
    };

    // Get the ally code of someone that's registered
    client.getAllyCode = async (message, user) => {
        if (user) {
            user = user.toString().trim();
        }
        let uID, uAC;
        if (!user || user === 'me') {
            uID = message.author.id;
            try {
                uAC = await client.database.models.allyCodes.findOne({where: {id: uID}});
                return [uAC.dataValues.allyCode];
            } catch (e) {
                return [];
            }
        } else if (client.isUserID(user)) {
            uID = user.replace(/[^\d]*/g, '');
            try {
                uAC = await client.database.models.allyCodes.findOne({where: {id: uID}});
                return [uAC.dataValues.allyCode];
            } catch (e) {
                return [];
            }
        }  else if (client.isAllyCode(user)) {
            return [user.replace(/[^\d]*/g, '')];
        }  else {
            // TODO  Get this working
            return [];
            // const outArr = [];
            // const results = await client.swgohAPI.report( 'getPlayerProfile', { "name": user } );
            // if (results.length > 1) {
            //     results.forEach(p => {
            //         outArr.push(p.allyCode);
            //     });
            // } else if (results.length ===  1) {
            //     outArr.push(results[0].allyCode);
            // }
            // return outArr;
        }
    };


    // Bunch of stuff for the events 
    client.loadAllEvents = async () => {
        let ix = 0;
        const nowTime = momentTZ().subtract(2, 'h').unix();
        const events = await client.database.models.eventDBs.findAll();

        const eventList = [];
        for (let i = 0; i < events.length; i++ ) {
            const event = events[i];
            const eventNameID = event.eventID.split('-');
            const guildID = eventNameID[0];
            
            // Make sure it only loads events for it's shard
            if (client.guilds.keyArray().includes(guildID)) {
                const guildSettings = await client.database.models.settings.findOne({where: {guildID: guildID}, attributes: Object.keys(client.config.defaultSettings)});
                const guildConf = guildSettings.dataValues;
                eventList.push([event.dataValues, guildConf]);
            }
        }

        if (eventList.length > 0) {
            for (let i = 0; i < eventList.length; i++ ) {
                const [event, guildConf] = eventList[i];
                // If it's past when it was supposed to announce
                if (event.eventDT < nowTime*1000) {
                    await client.database.models.eventDBs.destroy({where: {eventID: event.eventID}})
                        .catch(error => { client.log('ERROR',`Broke trying to delete zombies ${error}`); });
                } else {
                    ix++;
                    client.scheduleEvent(event, guildConf.eventCountdown);
                }
            }
        }
        console.log(`Loaded ${ix} events`);
    };

    // Actually schedule em here
    client.scheduleEvent = async (event, countdown) => {
        client.schedule.scheduleJob(event.eventID, parseInt(event.eventDT), function() {
            client.eventAnnounce(event);
        });
    
        if (countdown.length && (event.countdown === 'true' || event.countdown === 'yes' || event.countdown === true)) {
            const timesToCountdown = countdown;
            const nowTime = momentTZ().unix() * 1000;
            timesToCountdown.forEach(time => {
                const cdTime = time * 60;
                const evTime = event.eventDT / 1000;
                const newTime = (evTime-cdTime-60) * 1000; 
                if (newTime > nowTime) {    // If the countdown is between now and the event
                    const sID = `${event.eventID}-CD${time}`;
                    if (!client.evCountdowns[event.eventID]) {
                        client.evCountdowns[event.eventID] = [sID];
                    } else {
                        client.evCountdowns[event.eventID].push(sID);
                    }
                    client.schedule.scheduleJob(sID, parseInt(newTime) , function() {
                        client.countdownAnnounce(event);                    
                    });
                }
            });
        }
    };

    // Delete em here as needed
    client.deleteEvent = async (eventID) => {
        const event = await client.database.models.eventDBs.findOne({where: {eventID: eventID}});

        await client.database.models.eventDBs.destroy({where: {eventID: eventID}})
            .then(() => {
                const eventToDel = client.schedule.scheduledJobs[eventID];
                if (!eventToDel) console.log('Broke trying to delete: ' + event);
                eventToDel.cancel();
            })
            .catch(error => { 
                client.log('ERROR',`Broke deleting an event ${error}`); 
            });

        if (client.evCountdowns[event.eventID] && (event.countdown === 'true' || event.countdown === 'yes')) {
            client.evCountdowns[event.eventID].forEach(time => {
                const eventToDel = client.schedule.scheduledJobs[time];
                if (eventToDel) {
                    eventToDel.cancel();
                }
            });
        }
    };
    
    // To stick into node-schedule for each countdown event
    client.countdownAnnounce = async (event) => {
        let eventName = event.eventID.split('-');
        const guildID = eventName.splice(0, 1)[0];
        eventName = eventName.join('-');
    
        const guildSettings = await client.database.models.settings.findOne({where: {guildID: guildID}, attributes: Object.keys(client.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;
    
        var timeToGo = momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT)), 'minutes') * -1, 'minutes').format(`h [${client.languages[guildConf.language].getTime('HOUR', 'SHORT_SING')}], m [${client.languages[guildConf.language].getTime('MINUTE', 'SHORT_SING')}]`);
        var announceMessage = client.languages[guildConf.language].get('BASE_EVENT_STARTING_IN_MSG', eventName, timeToGo);
    
        if (guildConf["announceChan"] != "" || event.eventChan !== '') {
            if (event['eventChan'] && event.eventChan !== '') { // If they've set a channel, use it
                client.announceMsg(client.guilds.get(guildID), announceMessage, event.eventChan);
            } else { // Else, use the default one from their settings
                client.announceMsg(client.guilds.get(guildID), announceMessage);
            }
        }
    };
    
    // To stick into node-schedule for each full event
    client.eventAnnounce = async (event) => {
        // Parse out the eventName and guildName from the ID
        let eventName = event.eventID.split('-');
        const guildID = eventName.splice(0, 1)[0];
        eventName = eventName.join('-');
    
        const guildSettings = await client.database.models.settings.findOne({where: {guildID: guildID}, attributes: Object.keys(client.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;
    
        let repTime = false, repDay = false;
        let newEvent = {};
        const repDays = event.repeatDays;

        if (event.countdown === 'yes') {
            event.countdown = 'true';
        } else if (event.countdown === 'no') {
            event.countdown = 'false';
        }

        // Announce the event
        var announceMessage = `**${eventName}**\n${event.eventMessage}`;
        if (guildConf["announceChan"] != "" || event.eventChan !== '') {
            if (event['eventChan'] && event.eventChan !== '') { // If they've set a channel, use it
                try {
                    client.announceMsg(client.guilds.get(guildID), announceMessage, event.eventChan);
                } catch (e) {
                    client.log('ERROR', 'Broke trying to announce event with ID: ${event.eventID} \n${e}');
                }
            } else { // Else, use the default one from their settings
                client.announceMsg(client.guilds.get(guildID), announceMessage);
            }
        }
    
        // If it's got any left in repeatDays
        if (repDays.length > 0) {    
            repDay = true;        
            let eventMsg = event.eventMessage;
            // If this is the last time, tack a message to the end to let them know it's the last one
            if (repDays.length === 1) {
                eventMsg += client.languages[guildConf.language].get('BASE_LAST_EVENT_NOTIFICATION');
            }
            newEvent = {
                "eventID": event.eventID,
                "eventDT": (momentTZ(parseInt(event.eventDT)).add(parseInt(repDays.splice(0, 1)), 'd').unix()*1000),
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
        } else if (event['repeat'] && (event.repeat['repeatDay'] !== 0 || event.repeat['repeatHour'] !== 0 || event.repeat['repeatMin'] !== 0)) { // At least one of em is more than 0
            repTime = true;
            newEvent = {
                "eventID": event.eventID,
                "eventDT": (momentTZ(parseInt(event.eventDT)).add(event.repeat['repeatDay'], 'd').add(event.repeat['repeatHour'], 'h').add(event.repeat['repeatMin'], 'm').unix()*1000),
                "eventMessage": event.eventMessage,
                "eventChan": event.eventChan,
                "countdown": event.countdown,
                "repeat": {
                    "repeatDay": event.repeat['repeatDay'],
                    "repeatHour": event.repeat['repeatHour'],
                    "repeatMin": event.repeat['repeatMin']
                },
                "repeatDays": []
            };
        }  

        if (repTime || repDay) {
            await client.database.models.eventDBs.update(newEvent, {where: {eventID: event.eventID}})
                .then(async () => {
                    client.scheduleEvent(newEvent, guildConf.eventCountdown);
                })
                .catch(error => { client.log('ERROR', "Broke trying to replace event: " + error); });
        } else {
            // Just destroy it
            await client.database.models.eventDBs.destroy({where: {eventID: event.eventID}})
                .then(async () => {})
                .catch(error => { client.log('ERROR',`Broke trying to delete old event ${error}`); });
        }
    };

    // Convert from milliseconds
    client.convertMS = (milliseconds) => {
        var day, hour, minute, seconds;
        seconds = Math.floor(milliseconds / 1000);
        minute = Math.floor(seconds / 60);
        seconds = seconds % 60;
        hour = Math.floor(minute / 60);
        minute = minute % 60;
        day = Math.floor(hour / 24);
        hour = hour % 24;
        return {
            day: day,
            hour: hour,
            minute: minute,
            seconds: seconds
        };
    };

    
    // Reload the SWGoH data for all patrons
    client.reloadPatrons = async () => {
        client.patrons = await client.getPatrons();
        let patronIDs = (client.config.vipList && client.config.vipList.length) ? client.config.vipList : [];
        if (!patronIDs.indexOf(client.config.ownerid)) {
            patronIDs.push(client.config.ownerid);
        }
        client.patrons.forEach(patron => {
            if (patron.discordID) {
                patronIDs.push(patron.discordID.toString());
            }
        });
        patronIDs = [...new Set(patronIDs)];
        console.log('Reloading Patrons (' + patronIDs.length + ')');
        if (patronIDs.length) {
            for (let ix=0; ix < patronIDs.length; ix++) {
                const allyCodes = await client.getAllyCode(null, patronIDs[ix].toString());
                if (allyCodes.length) {
                    await client.swgohAPI.player(allyCodes[0]);
                }
            }
        }
    };

    // Get all patrons and their info
    client.getPatrons = async () => {
        const patreon = client.config.patreon;
        return new Promise(async (resolve, reject) => {
            if (!patreon) {
                resolve([]);
            }
            try {
                let response = await request({
                    headers: {
                        Authorization: 'Bearer ' + patreon.creatorAccessToken
                    },
                    uri: 'https://www.patreon.com/api/oauth2/api/current_user/campaigns',
                    json: true
                });

                if (response && response.data && response.data.length) {
                    response = await request({
                        headers: {
                            Authorization: 'Bearer ' + patreon.creatorAccessToken
                        },
                        uri: 'https://www.patreon.com/api/oauth2/api/campaigns/' + response.data[0].id + '/pledges',
                        json: true
                    });

                    const data = response.data;
                    const included = response.included;

                    const pledges = data.filter(data => data.type === 'pledge');
                    const users = included.filter(inc => inc.type === 'user');

                    let patrons = [];
                    pledges.forEach(pledge => {
                        const user = users.filter(user => user.id === pledge.relationships.patron.data.id)[0];
                        patrons.push({
                            id: pledge.relationships.patron.data.id,
                            full_name: user.attributes.full_name,
                            vanity: user.attributes.vanity,
                            email: user.attributes.email,
                            discordID: user.attributes.social_connections.discord ? user.attributes.social_connections.discord.user_id : null,
                            amount_cents: pledge.attributes.amount_cents,
                            created_at: pledge.attributes.created_at,
                            declined_since: pledge.attributes.declined_since,
                            patron_pays_fees: pledge.attributes.patron_pays_fees,
                            pledge_cap_cents: pledge.attributes.pledge_cap_cents,
                            image_url: user.attributes.image_url
                        });
                    });

                    patrons = patrons.filter(patron => !patron.declined_since);

                    resolve(patrons);
                }
            } catch (e) {
                reject(e);
            }
        });
    };
};
