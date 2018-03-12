module.exports = {
    DAYSOFWEEK: {
        SUNDAY: {
            SHORT: 'sun',
            LONG: 'sunday'
        },
        MONDAY: {
            SHORT: 'mon',
            LONG: 'monday'
        },
        TUESDAY: {
            SHORT: 'tue',
            LONG: 'tuesday'
        },
        WEDNESDAY: {
            SHORT: 'wed',
            LONG: 'wednesday'
        },
        THURSDAY: {
            SHORT: 'thu',
            LONG: 'thursday'
        },
        FRIDAY: {
            SHORT: 'fri',
            LONG: 'friday'
        },
        SATURDAY: {
            SHORT: 'sat',
            LONG: 'saturday'
        }
    },

    TIMES: {
        DAY: {
            PLURAL: 'days',
            SING: 'day',
            SHORT_PLURAL: 'ds',
            SHORT_SING: 'd'
        },
        HOUR: {
            PLURAL: 'hours',
            SING: 'hour',
            SHORT_PLURAL: 'hrs',
            SHORT_SING: 'hr'
        },
        MINUTE: {
            PLURAL: 'minutes',
            SING: 'minute',
            SHORT_PLURAL: 'mins',
            SHORT_SING: 'min'
        },
        SECOND: {
            PLURAL: 'seconds',
            SING: 'second',
            SHORT_PLURAL: 'secs',
            SHORT_SING: 'sec'
        }
    },

    // Base swgohBot.js file
    BASE_LAST_EVENT_NOTIFICATOIN: `\n\nThis is the last instance of this event. To continue receiving this announcement, create a new event.`,
    BASE_EVENT_STARTING_IN_MSG: (key, timeToGo) => `**${key}**\nStarting in ${timeToGo}`,

    // Generic (Not tied to a command)
    COMMAND_EXTENDED_HELP: (command) => `**Extended help for ${command.help.name}** \n**Usage**: ${command.help.usage} \n${command.help.extended}`,
    COMMAND_INVALID_BOOL: `Invalid value, try true or false`,
    COMMAND_MISSING_PERMS: `Sorry, but you don't have the correct permissions to use that.`,

    // Event Strings (message/ ready etc.)
    BASE_COMMAND_UNAVAILABLE: "This command is unavailable via private message. Please run this command in a guild.",

    // Abilities Command 
    COMMAND_ABILITIES_NEED_CHARACTER: (prefix, usage) => `Need a character. Usage is \`${prefix}${usage}\``,
    COMMAND_ABILITIES_INVALID_CHARACTER: (prefix, usage) => `Invalid character. Usage is \`${prefix}${usage}\``,
    COMMAND_ABILITIES_COOLDOWN: (aCooldown) => `**Ability Cooldown:** ${aCooldown}\n`,
    COMMAND_ABILITIES_ABILITY: (aType, mat, cdString, aDesc) => `**Ability Type:** ${aType}     **Max ability mat needed:**  ${mat}\n${cdString}${aDesc}`,
    COMMAND_ABILITIES_ABILITY_CODE: (abilityName, type, tier, aDesc) => `### ${abilityName} ###\n* Ability type: ${type}\n* Max ability mat needed: ${tier}\n* Description: ${aDesc}\n\n`,

    // Activities Command
    COMMAND_ACTIVITIES_SUNDAY: `== Before Reset == \nComplete Arena Battles \nSave Cantina Energy \nSave Normal Energy\n\n== After Reset == \nSpend Cantina Energy \nSave Normal Energy`,
    COMMAND_ACTIVITIES_MONDAY: `== Before Reset == \nSpend Cantina Energy \nSave Normal Energy \nSave Galactic War (unless reset available)\n\n== After Reset == \nSpend Normal Energy on Light Side Battles \nSave Galactic War (unless reset available)`,
    COMMAND_ACTIVITIES_TUESDAY: `== Before Reset == \nSpend Normal Energy on Light Side Battles \nSave Galactic War\n\n== After Reset == \nComplete Galactic War Battles \nSave Normal Energy`,
    COMMAND_ACTIVITIES_WEDNESDAY: `== Before Reset == \nComplete Galactic War Battles \nSave Normal Energy\n\n== After Reset == \nSpend Normal Energy on Hard Mode Battles`,
    COMMAND_ACTIVITIES_THURSDAY: `== Before Reset == \nSpend Normal Energy on Hard Mode Battles \nSave Challenges\n\n== After Reset == \nComplete Challenges \nSave Normal Energy`,
    COMMAND_ACTIVITIES_FRIDAY: `== Before Reset == \nComplete Challenges \nSave Normal Energy\n\n== After Reset == \nSpend Normal Energy on Dark Side Battles`,
    COMMAND_ACTIVITIES_SATURDAY: `== Before Reset == \nSpend Normal Energy on Dark Side Battles \nSave Arena Battles \nSave Cantina Energy\n\n== After Reset == \nComplete Arena Battles \nSave Cantina Energy`,
    COMMAND_ACTIVITIES_ERROR: (prefix, usage) => `Invalid day, usage is \`${prefix}${usage}\``,

    // Arenarank Command
    COMMAND_ARENARANK_INVALID_NUMBER: `You need to enter a valid rank number`,
    COMMAND_ARENARANK_BEST_RANK: `You've already gotten as far as you can, congrats!`,
    COMMAND_ARENARANK_RANKLIST: (currentRank, battleCount, plural, est, rankList) => `From rank ${currentRank}, in ${battleCount} battle${plural} ${est}\nThe best you can get is ${rankList}`,

    // Challenges Command
    COMMAND_CHALLENGES_TRAINING: "Training Droids",
    COMMAND_CHALLENGES_ABILITY : "Ability Mats",
    COMMAND_CHALLENGES_BOUNTY  : "Bounty Hunter",  
    COMMAND_CHALLENGES_AGILITY : "Agility Gear",   
    COMMAND_CHALLENGES_STRENGTH: "Strength Gear",  
    COMMAND_CHALLENGES_TACTICS : "Tactics Gear",   
    COMMAND_CHALLENGES_SHIP_ENHANCEMENT: "Ship Enhancement Droids",
    COMMAND_CHALLENGES_SHIP_BUILDING   : "Ship Building Materials",
    COMMAND_CHALLENGES_SHIP_ABILITY    : "Ship Ability Materials",
    COMMAND_CHALLENGES_MISSING_DAY: 'You need to specify a day',
    COMMAND_CHALLENGES_DEFAULT: (prefix, usage) => `Invalid date, usage is \`${prefix}${usage}\``,

    // Character gear Command
    COMMAND_CHARGEAR_NEED_CHARACTER: (prefix, usage) => `Need a character. Usage is \`${prefix}${usage}\``,
    COMMAND_CHARGEAR_INVALID_CHARACTER: (prefix, usage) => `Invalid character. Usage is \`${prefix}${usage}\``,
    COMMAND_CHARGEAR_GEAR_ALL: (name, gearString) => ` * ${name} * \n### All Gear Needed ### \n${gearString}`,
    COMMAND_CHARGEAR_GEAR_NA: 'This gear has not been entered yet',

    // Event Command (Create)
    COMMAND_EVENT_INVALID_ACTION: (actions) => `Valid actions are \`${actions}\`.`,
    COMMAND_EVENT_INVALID_PERMS: `Sorry, but either you're not an admin, or your server leader has not set up the configs.\nYou cannot add or remove an event unless you have the configured admin role.`,
    COMMAND_EVENT_ONE_REPEAT: 'Sorry, but you cannot use both `repeat` and `repeatDay` in one event. Please pick one or the other',
    COMMAND_EVENT_INVALID_REPEAT: `The repeat is in the wrong format. Example: \`5d3h8m\` for 5 days, 3 hours, and 8 minutes`,
    COMMAND_EVENT_USE_COMMAS: `Please use comma seperated numbers for repeatDay. Example: \`1,2,1,3,4\``,
    COMMAND_EVENT_INVALID_CHAN: `This channel is invalid, please try again`,
    COMMAND_EVENT_CHANNEL_NO_PERM: (channel) => `I don't have permission to send messages in ${channel}, please choose one where I can`,
    COMMAND_EVENT_NEED_CHAN: `ERROR: I need to configure a channel to send this to. Configure \`announceChan\` to be able to make events.`,
    COMMAND_EVENT_NEED_NAME: `You must give a name for your event.`,
    COMMAND_EVENT_EVENT_EXISTS: `That event name already exists. Cannot add it again.`,
    COMMAND_EVENT_NEED_DATE: `You must give a date for your event. Accepted format is \`DD/MM/YYYY\`.`,
    COMMAND_EVENT_BAD_DATE: (badDate) => `${badDate} is not a valid date. Accepted format is \`DD/MM/YYYY\`.`,
    COMMAND_EVENT_NEED_TIME: `You must give a time for your event.`,
    COMMAND_EVEMT_INVALID_TIME: `You must give a valid time for your event. Accepted format is \`HH:MM\`, using a 24 hour clock. So no AM or PM`,
    COMMAND_EVENT_PAST_DATE: (eventDATE, nowDATE) => `You cannot set an event in the past. ${eventDATE} is before ${nowDATE}`,
    COMMAND_EVENT_CREATED: (eventName, eventDate) => `Event \`${eventName}\` created for ${eventDate}`,
    COMMAND_EVENT_NO_CREATE: `I couldn't set that event, please try again.`,
    COMMAND_EVENT_TOO_BIG:(charCount) => `Sorry, but either your event's name or message is too big. Please trim it down by at least ${charCount} characters.`,

    // Event Command (View)
    COMMAND_EVENT_TIME: (eventName, eventDate) => `**${eventName}** \n\nEvent Time: ${eventDate}\n`,
    COMMAND_EVENT_TIME_LEFT: (timeLeft) => `Time Remaining: ${timeLeft}\n`,
    COMMAND_EVENT_CHAN: (eventChan) => `Sending on channel: ${eventChan}\n`,
    COMMAND_EVENT_SCHEDULE: (repeatDays) => `Repeat schedule: ${repeatDays}\n`,
    COMMAND_EVENT_REPEAT: (eventDays, eventHours, eventMins) => `Repeating every ${eventDays} days, ${eventHours} hours, and ${eventMins} minutes\n`,
    COMMAND_EVENT_MESSAGE: (eventMsg) => `Event Message: \n\`\`\`md\n${eventMsg}\`\`\``,
    COMMAND_EVENT_UNFOUND_EVENT: (eventName) => `Sorry, but I cannot find the event \`${eventName}\``,
    COMMAND_EVENT_NO_EVENT: `You don't currently have any events scheduled.`,
    COMMAND_EVENT_SHOW_PAGED: (eventCount, PAGE_SELECTED, PAGES_NEEDED, eventKeys) => `Here's your server's Event Schedule \n(${eventCount} total event${eventCount > 1 ? 's' : ''}) Showing page ${PAGE_SELECTED}/${PAGES_NEEDED}: \n${eventKeys}`,
    COMMAND_EVENT_SHOW: (eventCount, eventKeys) => `Here's your server's Event Schedule \n(${eventCount} total event${eventCount > 1 ? 's' : ''}): \n${eventKeys}`,

    // Event Command (Delete)
    COMMAND_EVENT_DELETE_NEED_NAME: `You must give an event name to delete.`,
    COMMAND_EVENT_DOES_NOT_EXIST: `That event does not exist.`,
    COMMAND_EVENT_DELETED: (eventName) => `Deleted event: ${eventName}`,

    // Event Command (Trigger)
    COMMAND_EVENT_TRIGGER_NEED_NAME: `You must give an event name to trigger.`,

    // Faction Command
    COMMAND_FACTION_INVALID_CHAR: (prefix, usage) => `Invalid faction, usage is \`${prefix}${usage}\``,
    COMMAND_FACTION_CODE_OUT: (searchName, charString) => `# Characters in the ${searchName} faction # \n${charString}`,

    // Help Command
    COMMAND_HELP_HEADER: (prefix) => `= Command List =\n\n[Use ${prefix}help <commandname> for details]\n`,
    COMMAND_HELP_OUTPUT: (command, prefix) => `= ${command.help.name} = \n${command.help.description} \nAliases:: ${command.conf.aliases.join(", ")}\nUsage:: ${prefix}${command.help.usage}`,

    // Info Command
    COMMAND_INFO_OUTPUT: `**### INFORMATION ###** \n**Links**\nJoin the bot support server here \n<http://swgohbot.com/server>\nInvite the bot with this link\n<http://swgohbot.com/invite>`,

    // Mods Command
    COMMAND_MODS_NEED_CHARACTER: (prefix, usage) => `Need a character. Usage is \`${prefix}${usage}\``,
    COMMAND_MODS_INVALID_CHARACTER: (prefix, usage) => `Invalid character. Usage is \`${prefix}${usage}\``,
    COMMAND_MODS_EMBED_STRING1: (square, arrow, diamond) => `\`Square:   ${square}\`\n\`Arrow:    ${arrow}\`\n\`Diamond:  ${diamond}\`\n`,
    COMMAND_MODS_EMBED_STRING2: (triangle, circle, cross) => `\`Triangle: ${triangle}\`\n\`Circle:   ${circle}\`\n\`Cross:    ${cross}\`\n`,
    COMMAND_MODS_EMBED_OUTPUT: (modSetString, modPrimaryString) => `**### Sets ###**\n${modSetString}\n**### Primaries ###**\n${modPrimaryString}`,
    COMMAND_MODS_CODE_STRING1: (square, arrow, diamond) => `* Square:   ${square}  \n* Arrow:    ${arrow} \n* Diamond:  ${diamond}\n`,
    COMMAND_MODS_CODE_STRING2: (triangle, circle, cross) => `* Triangle: ${triangle}\n* Circle:   ${circle}\n* Cross:    ${cross}`,
    COMMAND_MODS_CODE_OUTPUT: (charName, modSetString, modPrimaryString) => ` * ${charName} * \n### Sets ### \n${modSetString}\n### Primaries ###\n${modPrimaryString}`,

    // Modsets command
    COMMAND_MODSETS_OUTPUT: `* Critical Chance:  2\n* Critical Damage:  4\n* Defense:  2\n* Health:   2\n* Offense:  4\n* Potency:  2\n* Speed:    4\n* Tenacity: 2`,

    // Nickname Command
    COMMAND_NICKNAME_SUCCESS: `I have changed my nickname.`,
    COMMAND_NICKNAME_FAILURE: `Sorry, but I don't have permission to change that.`,

    // Polls Command
    COMMAND_POLL_ALREADY_RUNNING: "Sorry, but you can only run one poll at a time. Please end the current one first.",
    COMMAND_POLL_MISSING_QUESTION: "You need to specify something to vote on.",
    COMMAND_POLL_TOO_FEW_OPT: "You need to have at least 2 options to vote on.",
    COMMAND_POLL_TOO_MANY_OPT: "You can only have up to 10 options to vote on.",
    COMMAND_POLL_CREATED: (name, prefix, poll) => `**${name}** has started a new poll:\nVote with \`${prefix}poll <choice>\`\n\n${poll}`,
    COMMAND_POLL_NO_POLL: "There is no poll in progress",
    COMMAND_POLL_FINAL: (poll) => `Final results for ${poll}`,
    COMMAND_POLL_FINAL_ERROR: (question) => `I couldn't delete **${question}**, please try again.`,
    COMMAND_POLL_INVALID_OPTION: "That is not a valid option.",
    COMMAND_POLL_SAME_OPT: (opt) => `You have already chosen **${opt}**`,
    COMMAND_POLL_CHANGED_OPT: (oldOpt, newOpt) => `You have changed your choice from **${oldOpt}** to **${newOpt}**`,
    COMMAND_POLL_REGISTERED: (opt) => `Choice for **${opt}** registered`,
    COMMAND_POLL_CHOICE: (opt, optCount, choice) => `\`[${opt}]\` (${optCount} vote${optCount === 1 ? '' : 's'}) ${choice}\n`,
    
    // Raidteams Command
    COMMAND_RAIDTEAMS_INVALID_RAID: (prefix, help) => `Invalid raid, usage is \`${prefix}${help.usage}\`\n**Example:** \`${prefix}${help.example}\``,
    COMMAND_RAIDTEAMS_INVALID_PHASE: (prefix, help) => `Invalid phase, usage is \`${prefix}${help.usage}\`\n**Example:** \`${prefix}${help.example}\``,
    COMMAND_RAIDTEAMS_PHASE_SOLO: 'Solo',
    COMMAND_RAIDTEAMS_PHASE_ONE: 'Phase 1',
    COMMAND_RAIDTEAMS_PHASE_TWO: 'Phase 2',
    COMMAND_RAIDTEAMS_PHASE_THREE: 'Phase 3',
    COMMAND_RAIDTEAMS_PHASE_FOUR: 'Phase 4',
    COMMAND_RAIDTEAMS_CHARLIST: (charList) => `**Characters:** \`${charList}\``,
    COMMAND_RAIDTEAMS_SHOWING: (currentPhase) => `Showing teams for ${currentPhase}`,
    COMMAND_RAIDTEAMS_NO_TEAMS: (currentPhase) => `Cannot find any teams under \`${currentPhase}\``,
    COMMAND_RAIDTEAMS_CODE_TEAMS: (raidName, currentPhase) => ` * ${raidName} * \n\n* Showing teams for ${currentPhase}\n\n`,
    COMMAND_RAIDTEAMS_CODE_TEAMCHARS: (raidTeam, charList) => `### ${raidTeam} ### \n* Characters: ${charList}\n`,
    
    // Randomchar Command
    COMMAND_RANDOMCHAR_INVALID_NUM: (maxChar) => `Sorry, but you need a number from 1-${maxChar} there.`,
    
    // Reload Command
    COMMAND_RELOAD_INVALID_CMD: (cmd) => `I cannot find the command: ${cmd}`,
    COMMAND_RELOAD_SUCCESS: (cmd) => `Successfully reloaded: ${cmd}`,
    COMMAND_RELOAD_FAILURE: (cmd, stackTrace) => `Command reload failed: ${cmd}\n\`\`\`${stackTrace}\`\`\``,

    // Setconf Command
    COMMAND_SETCONF_MISSING_PERMS: `Sorry, but either you're not an admin, or your server leader has not set up the configs.`,
    COMMAND_SETCONF_MISSING_OPTION: `You must select a config option to change.`,
    COMMAND_SETCONF_MISSING_VALUE: `You must give a value to change that option to.`,
    COMMAND_SETCONF_ADMINROLE_MISSING_OPT: `You must use \`add\` or \`remove\`.`,
    COMMAND_SETCONF_ADMINROLE_NEED_ROLE: (opt) => `You must specify a role to ${opt}.`,
    COMMAND_SETCONF_ADMINROLE_MISSING_ROLE: (roleName) => `Sorry, but I cannot find the role ${roleName}. Please try again.`,
    COMMAND_SETCONF_ADMINROLE_ROLE_EXISTS: (roleName) => `Sorry, but ${roleName} is already there.`,
    COMMAND_SETCONF_ADMINROLE_NOT_IN_CONFIG: (roleName) => `Sorry, but ${roleName} is not in your config.`,
    COMMAND_SETCONF_ADMINROLE_SUCCESS: (roleName, action) => `The role ${roleName} has been ${action} your admin roles.`,
    COMMAND_SETCONF_WELCOME_NEED_CHAN: `Sorry, but but your announcement channel either isn't set or is no longer valid.\nGo set \`announceChan\` to a valid channel and try again.\``,
    COMMAND_SETCONF_TIMEZONE_NEED_ZONE: `Invalid timezone, look here https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \nand find the one that you need, then enter what it says in the TZ column`,
    COMMAND_SETCONF_ANNOUNCECHAN_NEED_CHAN: (chanName) => `Sorry, but I cannot find the channel ${chanName}. Please try again.`,    
    COMMAND_SETCONF_ANNOUNCECHAN_NO_PERMS: `Sorry, but I don't have permission to send message there. Please either change the perms, or choose another channel.`,
    COMMAND_SETCONF_NO_KEY: (prefix) => `This key is not in the configuration. Look in "${prefix}showconf", or "${prefix}setconf help" for a list`,
    COMMAND_SETCONF_UPDATE_SUCCESS: (key, value) => `Guild configuration item ${key} has been changed to:\n\`${value}\``,
    COMMAND_SETCONF_NO_SETTINGS: `No guild settings found.`,
    COMMAND_SETCONF_INVALID_LANG: (value, langList) => `Sorry, but ${value} is not a currently supported language. \nCurrently supported languages are: \`${langList}\``,
    COMMAND_SETCONF_RESET: `Your config has been reset`,

    // Shard times command
    COMMAND_SHARDTIMES_MISSING_USER: `I need a user, please enter "me", mention someone here, or input their Discord ID.`,
    COMMAND_SHARDTIMES_MISSING_ROLE: `Sorry, but you can only add yourself unless you have an admin role.`,
    COMMAND_SHARDTIMES_INVALID_USER: `Invalid user, please enter "me", mention someone here, or input their discord ID.`,
    COMMAND_SHARDTIMES_MISSING_TIMEZONE: `You need to enter a timezone.`,
    COMMAND_SHARDTIMES_INVALID_TIMEZONE: `Invalid timezone, look here https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \nand find the one that you need, then enter what it says in the TZ column`,
    COMMAND_SHARDTIMES_USER_ADDED: `User successfully added!`,
    COMMAND_SHARDTIMES_USER_NOT_ADDED: `Something went wrong when with adding this user. Please try again.`,
    COMMAND_SHARDTIMES_REM_MISSING_PERMS: `Sorry, but you can only remove yourself unless you have an admin role.`,
    COMMAND_SHARDTIMES_REM_SUCCESS: `User successfully removed!`,
    COMMAND_SHARDTIMES_REM_FAIL: `Something went wrong when removing this user. Please try again.`,
    COMMAND_SHARDTIMES_REM_MISSING: `Sorry, but that user does not seem to be here.`,
    COMMAND_SHARDTIMES_SHARD_HEADER: `Shard payouts in:`,

    // Ships Command
    COMMAND_SHIPS_NEED_CHARACTER: (prefix, usage) => `Need a character or ship. Usage is \`${prefix}${usage}\``,
    COMMAND_SHIPS_INVALID_CHARACTER: (prefix, usage) => `Invalid character or ship. Usage is \`${prefix}${usage}\``,
    COMMAND_SHIPS_TOO_MANY: `I found more than one result from that search. Please try to be more specific.`,
    COMMAND_SHIPS_CREW: 'Crew',
    COMMAND_SHIPS_FACTIONS: 'Factions',
    COMMAND_SHIPS_ABILITIES: (abilities) => `**Ability Type:** ${abilities.type}   **Ability Cooldown:** ${abilities.abilityCooldown} \n${abilities.abilityDesc}`,
    COMMAND_SHIPS_CODE_ABILITES_HEADER: ` * Abilities *\n`,
    COMMAND_SHIPS_CODE_ABILITIES: (abilityName, abilities) => `### ${abilityName} ###\nAbility Type: ${abilities.type}   Ability Cooldown: ${abilities.abilityCooldown}\n${abilities.abilityDesc}\n\n`,
    
    // Showconf Command
    COMMAND_SHOWCONF_OUTPUT: (configKeys, serverName) => `The following is the current configuration for ${serverName}: \`\`\`${configKeys}\`\`\``,

    // Stats Command
    COMMAND_STATS_OUTPUT: (memUsage, cpuLoad, uptime, users, servers, channels, shardID) => `= STATISTICS (${shardID}) =\n
• Mem Usage  :: ${memUsage} MB
• CPU Load   :: ${cpuLoad}%
• Uptime     :: ${uptime}
• Users      :: ${users}
• Servers    :: ${servers}
• Channels   :: ${channels}
• Source     :: https://github.com/jmiln/SWGoHBot`,

    COMMAND_TIME_CURRENT: (time, zone) => `Current time is: ${time}} in ${zone} time`,
    COMMAND_TIME_INVALID_ZONE: (time, zone) => `Invalid timezone, here's your guild's time ${time} in ${zone} time`,
    COMMAND_TIME_NO_ZONE: (time) => `Current time is: ${time} UTC time`,
    COMMAND_TIME_WITH_ZONE: (time, zone) => `Current time is: ${time} in ${zone} time`,

    COMMAND_UPDATECHAR_INVALID_OPT: (arg, usableArgs) => `Sorry, but ${arg} isn't a valid argument. Try one of these: ${usableArgs}`,
    COMMAND_UPDATECHAR_NEED_CHAR: `You need to specify a character to update.`,
    COMMAND_UPDATECHAR_WRONG_CHAR: (charName) => `Sorry, but your search for '${charName}' did not find any results. Please try again.`
};

