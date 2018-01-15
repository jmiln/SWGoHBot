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

    // Generic (Not tied to a command)
    COMMAND_EXTENDED_HELP: (command) => `**Extended help for ${command.help.name}** \n**Usage**: ${command.help.usage} \n${command.help.extended}`,

    // Abilities Command 
    COMMAND_ABILITIES_NEED_CHARACTER: (prefix, usage) => `Need a character. Usage is \`${prefix}${usage}\``,
    COMMAND_ABILITIES_INVALID_CHARACTER: (prefix, usage) => `Invalid character. Usage is \`${prefix}${usage}\``,
    COMMAND_ABILITIES_COOLDOWN: (aCooldown) => `**Ability Cooldown:** ${aCooldown}\n`,
    COMMAND_ABILITIES_ABILITY: (aType, mat, cdString, aDesc) => `**Ability Type:** ${aType}     **Max ability mat needed:** ${mat}\n${cdString}${aDesc}`,
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

    // Event Command (View)
    COMMAND_EVENT_TIME: (eventName, eventDate) => `**${eventName}** \nEvent Time: ${eventDate}\n`,
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




};