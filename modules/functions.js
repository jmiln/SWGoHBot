const moment = require('moment');

module.exports = (client) => {
    /*
		PERMISSION LEVEL FUNCTION
		This is a very basic permission system for commands which uses "levels"
		"spaces" are intentionally left black so you can add them if you want.
		NEVER GIVE ANYONE BUT OWNER THE LEVEL 10! By default this can run any
		command including the VERY DANGEROUS `eval` and `exec` commands!
		*/
    client.permlevel = message => {
        let permlvl = 0;

        const guildSettings = client.guildSettings;

        // If bot owner, return max perm level
        if (message.author.id === client.config.ownerid) return 10;

        // If DMs or webhook, return 0 perm level.
        if (!message.guild || !message.member) return 0;
        const guildConf = guildSettings.get(message.guild.id);

        // Guild Owner gets an extra level, wooh!
        if (message.author.id === message.guild.owner.id) return permlvl = 4;

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
        } catch (e) {
            // console.warn("adminRole not present in guild settings. Skipping Administrator (level 3) check");
        }
        return permlvl;
    };

    client.myTime = () => {
        return moment.tz('US/Pacific').format('M/D/YYYY hh:mma');
    };

    // Putting this here so I can use it across all the spots I need it
    // It finds any character that matches the search, and returns them in an array
    client.findChar = (searchName, charList) => {
        const chars = [];
        searchName = searchName.toLowerCase().replace(/[^\w\s]/gi, '');
        for (var ix = 0; ix < charList.length; ix++) {
            var character = charList[ix];
            for (var jx = 0; jx < character.aliases.length; jx++) {
                if (searchName.toLowerCase() === character.aliases[jx].toLowerCase()) {
                    chars.push(character);
                }
            }
        }
        return chars;
    };

    // And this one is for ships
    client.findShip = (searchName, shipList) => {
        const ships = [];
        searchName = searchName.toLowerCase().replace(/[^\w\s]/gi, '');
        for (var ix = 0; ix < shipList.length; ix++) {
            var ship = shipList[ix];
            for (var jx = 0; jx < ship.aliases.length; jx++) {
                if (searchName.toLowerCase() === ship.aliases[jx].toLowerCase()) {
                    ships.push(ship);
                }
            }
        }
        return ships;
    };

    /*
     * LOGGING FUNCTION
     * Logs to console. Future patches may include time+colors
     */
    client.log = (type, msg, title) => {
        if (!title) title = "Log";
        console.log(`[${client.myTime()}] [${type}] [${title}]${msg}`);
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
        const errorMsg = err.stack.replace(new RegExp(`${__dirname}\/`, "g"), "./");
        console.error(`[${client.myTime()}] Uncaught Exception: `, errorMsg);

        // If it's that error, don't bother showing it again
        if (!errorMsg.startsWith('Error: RSV2 and RSV3 must be clear')) {
            // client.channels.get("356111780579115010").send(`\`\`\`util.inspect(errorMsg)\`\`\``,{split: true});
        }
        // Always best practice to let the code crash on uncaught exceptions. 
        // Because you should be catching them anyway.
        process.exit(1);
    });

    process.on("unhandledRejection", err => {
        console.error(`[${client.myTime()}] Uncaught Promise Error: `, err);
    });

};
