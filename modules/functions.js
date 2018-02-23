const momentTZ = require('moment-timezone');
const util = require('util');
const Fuse = require("fuse-js-latest");
require('moment-duration-format');

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
    client.findChar = (searchName, charList, noLimit=false) => {
        var options = {
            keys: ['name', 'aliases'],
            threshold: .1,
            distance: 4
        };
        const fuse = new Fuse(charList, options);
        let chars = fuse.search(searchName);
        // If there's a ton of em, only return the first 4
        if (chars.length > 4 && !noLimit) {
            chars = chars.slice(0, 4);
        }
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
    client.log = (type, msg, title, codeType, prefix) => {
        if (!title) title = "Log";
        if (!codeType) codeType = "md";
        if (!prefix) {
            prefix = ""; 
        } else {
            prefix = prefix + ' ';
        }
        console.log(`[${client.myTime()}] [${type}] [${title}]${msg}`);
        try {
            // Sends the logs to the channel I have set up for it.
            if (client.config.logs.logToChannel) {
                client.channels.get(client.config.logs.channel).send(`${prefix}[${client.myTime()}] [${type}] ${msg}`, {code: codeType, split: true});
            }
        } catch (e) {
            // Probably broken because it's not started yet
            // console.log(`[${client.myTime()}] I couldn't send a log:\n${e}`);
        }
    };

    /*
     * ANNOUNCEMENT MESSAGE
     * Sends a message to the set announcement channel
     */
    client.announceMsg = async (guild, announceMsg, channel='') => {
        const guildSettings = await client.guildSettings.findOne({where: {guildID: guild.id}, attributes: ['announceChan']});
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
     * COMMAND ERROR
     * Spits back the correct usage and such for a command
     */
    client.cmdErr = (message, command) => {
        message.channel.send(`**Extended help for ${command.help.name}** \n**Usage**: ${command.help.usage} \n${command.help.extended}`);
    };

    /*
     * RELOAD COMMAND
     * Reloads the given command
     */
    client.reload = (command) => {
        return new Promise((resolve, reject) => {
            try {
                delete require.cache[require.resolve(`../commands/${command}.js`)];
                const cmd = require(`../commands/${command}.js`);
                client.commands.delete(command);
                client.aliases.forEach((cmd, alias) => {
                    if (cmd === command) client.aliases.delete(alias);
                });
                client.commands.set(command, cmd);
                cmd.conf.aliases.forEach(alias => {
                    client.aliases.set(alias, cmd.help.name);
                });
                resolve();
            } catch (e) {
                reject(e);
            }
        });
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
            const collected = await msg.channel.awaitMessages(filter, {
                max: 1,
                time: limit,
                errors: ["time"]
            });
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
            text = require("util").inspect(text, {
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
    global.wait = require("util").promisify(setTimeout);


    // Another semi-useful utility command, which creates a "range" of numbers
    // in an array. `range(10).forEach()` loops 10 times for instance. Why?
    // Because honestly for...i loops are ugly.
    global.range = (count, start = 0) => {
        const myArr = [];
        for (var i = 0; i < count; i++) {
            myArr[i] = i + start;
        }
        return myArr;
    };

    // These 2 simply handle unhandled things. Like Magic. /shrug
    process.on("uncaughtException", (err) => {
        const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
        console.error(`[${client.myTime()}] Uncaught Exception: `, errorMsg);

        // If it's that error, don't bother showing it again
        try {
            if (!errorMsg.startsWith('Error: RSV2 and RSV3 must be clear') && client.config.logs.logToChannel) {
                client.channels.get(client.config.logs.channel).send(`\`\`\`util.inspect(errorMsg)\`\`\``,{split: true});
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
                client.channels.get(client.config.logs.channel).send(`\`\`\`${util.inspect(errorMsg)}\`\`\``,{split: true});
            }
        } catch (e) {
            // Don't bother doing anything
        }
    });





    // Bunch of stuff for the events 
    client.loadAllEvents = async () => {
        let ix = 0;
        const nowTime = momentTZ().subtract(2, 'h').unix();
        const events = await client.guildEvents.findAll();

        const eventList = [];
        events.forEach(event => {
            eventList.push(event.dataValues);
        });

        if (eventList.length > 0) {
            eventList.forEach(async event => {
                // If it's past when it was supposed to announce
                if (event.eventDT < nowTime) {
                    await client.guildEvents.destroy({where: {eventID: event.eventID}})
                        .then(() => {})
                        .catch(error => { client.log('ERROR',`Broke trying to delete zombies ${error}`); });
                } else {
                    ix++;
                    client.scheduleEvent(event);
                }
            });
        }
        console.log(`Loaded ${ix} events`);
    };

    // Actually schedule em here
    client.scheduleEvent = async (event) => {
        client.schedule.scheduleJob(event.eventID, parseInt(event.eventDT), function() {
            client.eventAnnounce(event);
        });
    
        if (event.countdown === 'yes') {
            const timesToCountdown = [ 2880, 1440, 720, 360, 180, 120, 60, 30, 10 ];
            const nowTime = momentTZ().unix();
            timesToCountdown.forEach(time => {
                const cdTime = time * 60;
                const evTime = event.eventDT / 1000;
                const newTime = (evTime-cdTime-60) * 1000; 
                if (newTime > nowTime) {
                    client.schedule.scheduleJob(`${event.eventID}-CD${time}`, parseInt(newTime) , function() {
                        client.countdownAnnounce(event);                    
                    });
                }
            });
        }
    };

    // Delete em here as needed
    client.deleteEvent = async (eventID) => {
        const event = await client.guildEvents.findOne({where: {eventID: eventID}});

        await client.guildEvents.destroy({where: {eventID: eventID}})
            .then(() => {
                const eventToDel = client.schedule.scheduledJobs[eventID];
                eventToDel.cancel();
            })
            .catch(error => { 
                client.log('ERROR',`Broke deleting an event ${error}`); 
            });

        if (event.countdown === 'yes') {
            const timesToCountdown = [ 2880, 1440, 720, 360, 180, 120, 60, 30, 10 ];
            const nowTime = momentTZ().unix();
            timesToCountdown.forEach(time => {
                const cdTime = time * 60;
                const evTime = event.eventDT / 1000;
                const newTime = (evTime-cdTime-60) * 1000; 
                if (newTime > nowTime) {
                    const eventToDel = client.schedule.scheduledJobs[`${eventID}-CD${time}`];
                    eventToDel.cancel();
                }
            });
        }
    };
    
    // To stick into node-schedule for each countdown event
    client.countdownAnnounce = async (event) => {
        const eventNameID = event.eventID.split('-');
        const eventName = eventNameID[1];
        const guildID = eventNameID[0];
    
        const guildSettings = await client.guildSettings.findOne({where: {guildID: guildID}, attributes: Object.keys(client.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;
    
        var timeToGo = momentTZ.duration(momentTZ().diff(momentTZ(parseInt(event.eventDT)), 'minutes') * -1, 'minutes').format("h [hr], m [min]");
        var announceMessage = client.languages[guildConf.language].BASE_EVENT_STARTING_IN_MSG(eventName, timeToGo);
    
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
        const eventNameID = event.eventID.split('-');
        const eventName = eventNameID[1];
        const guildID = eventNameID[0];
    
        const guildSettings = await client.guildSettings.findOne({where: {guildID: guildID}, attributes: Object.keys(client.config.defaultSettings)});
        const guildConf = guildSettings.dataValues;
    
        let repTime = false, repDay = false;
        let newEvent = {};
        const repDays = event.repeatDays;

        // Announce the event
        var announceMessage = `**${eventName}**\n\n${event.eventMessage}`;
        if (guildConf["announceChan"] != "" || event.eventChan !== '') {
            if (event['eventChan'] && event.eventChan !== '') { // If they've set a channel, use it
                try {
                    client.announceMsg(client.guilds.get(guildID), announceMessage, event.eventChan);
                } catch(e) {
                    client.log('ERROR', 'Broke trying to announce event with ID: ${event.eventID} \n${e}')
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
                eventMsg += client.languages[guildConf.language].BASE_LAST_EVENT_NOTIFICATOIN;
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
        await client.guildEvents.destroy({where: {eventID: event.eventID}})
            .then(async () => {
                // If it's supposed to repeat, go ahead and put it back in    
                if (repTime) {
                    await client.guildEvents.create({
                        eventID: newEvent.eventID,
                        eventDT: newEvent.eventDT,
                        eventMessage: newEvent.eventMessage,
                        eventChan: newEvent.eventChan,
                        countdown: newEvent.countdown,
                        repeat: {
                            "repeatDay": newEvent.repeat['repeatDay'],
                            "repeatHour": newEvent.repeat['repeatHour'],
                            "repeatMin": newEvent.repeat['repeatMin']
                        },
                        repeatDays: []
                    })
                        .then(() => {
                            client.scheduleEvent(newEvent);
                        })
                        .catch(error => { client.log('ERROR',`Broke trying to replace old event ${error}`); });
                } else if (repDay) {
                    await client.guildEvents.create({
                        eventID: newEvent.eventID,
                        eventDT: newEvent.eventDT,
                        eventMessage: newEvent.eventMessage,
                        eventChan: newEvent.eventChan,
                        countdown: newEvent.countdown,
                        repeat: {
                            "repeatDay": 0,
                            "repeatHour": 0,
                            "repeatMin": 0
                        },
                        repeatDays: repDays
                    })
                        .then(() => {
                            client.scheduleEvent(newEvent);
                        })
                        .catch(error => { client.log('ERROR',`Broke trying to replace old event ${error}`); });
                }
            })
            .catch(error => { client.log('ERROR',`Broke trying to delete old event ${error}`); });
    };
};
