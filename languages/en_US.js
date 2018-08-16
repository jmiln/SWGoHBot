const Language = require('../base/Language');
const DAYSOFWEEK = {
    SUNDAY: {
        SHORT: 'Sun',
        LONG: 'Sunday'
    },
    MONDAY: {
        SHORT: 'Mon',
        LONG: 'Monday'
    },
    TUESDAY: {
        SHORT: 'Tue',
        LONG: 'Tuesday'
    },
    WEDNESDAY: {
        SHORT: 'Wed',
        LONG: 'Wednesday'
    },
    THURSDAY: {
        SHORT: 'Thu',
        LONG: 'Thursday'
    },
    FRIDAY: {
        SHORT: 'Fri',
        LONG: 'Friday'
    },
    SATURDAY: {
        SHORT: 'Sat',
        LONG: 'Saturday'
    }
};
const TIMES = {
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
};

function getDay(day, type) {
    return DAYSOFWEEK[`${day}`][`${type}`];
}

function getTime(unit, type) {
    return TIMES[`${unit}`][`${type}`];
}

module.exports = class extends Language {
    constructor(...args) {
        super(...args);

        this.getDay = getDay;
        this.getTime = getTime;
        this.language = {
            // Default in case it can't find one.
            BASE_DEFAULT_MISSING: 'Trying to use a nonexistent string here. If you see this message, please report it so it can be fixed.',

            // Base swgohBot.js file
            BASE_LAST_EVENT_NOTIFICATION: `\n\nThis is the last instance of this event. To continue receiving this announcement, create a new event.`,
            BASE_EVENT_STARTING_IN_MSG: (key, timeToGo) => `**${key}**\nStarting in ${timeToGo}`,

            // Base swgohAPI
            BASE_SWGOH_NO_ALLY: (prefix=';') => `Sorry, but that user is not registered. Please go register with \`${prefix}register add <user> <allycode>\``,
            BASE_SWGOH_NOT_REG: (user, prefix=';') => `Sorry, but that user is not registered. Please go register with \`${prefix}register add @${user} <allycode>\``,
            BASE_SWGOH_NO_USER: (prefix) => `Sorry, but I don't have that user listed anywhere. Please make sure they are registered with \`${prefix}register add <user> <allycode>\``,
            BASE_SWGOH_NO_GUILD_FOR_USER: (prefix=';') => `I cannot find a guild for that user. Please make sure they are registered with \`${prefix}register add <user> <allycode>\``,
            BASE_SWGOH_NO_GUILD: 'I cannot find any users for that guild. \nPlease make sure you have spelled the name correctly, and that the capitalization is correct.',
            BASE_SWGOH_MISSING_CHAR: 'You need to enter a character to check for',
            BASE_SWGOH_NO_CHAR_FOUND: (character) => `I did not find any results for ${character}`,
            BASE_SWGOH_CHAR_LIST: (chars) => `Your search came up with too many results, please be more specific. \nHere's a list of the close matches.\n\`\`\`${chars}\`\`\``,
            BASE_SWGOH_NO_ACCT: `Something went wrong, please make sure your account is synced correctly.`,
            BASE_SWGOH_LAST_UPDATED: (date) => `Last updated ${date} ago`,
            BASE_SWGOH_PLS_WAIT_FETCH: (dType) => `Please wait while I get your ${dType ? dType : 'data'}`,
            BASE_SWGOH_NAMECHAR_HEADER: (name, char) => `${name}'s ${char}`,

            // Generic (Not tied to a command)
            COMMAND_EXTENDED_HELP: (command) => `**Extended help for ${command.help.name}** \n**Usage**: ${command.help.usage} \n${command.help.extended}`,
            COMMAND_INVALID_BOOL: `Invalid value, try true or false`,
            COMMAND_MISSING_PERMS: `Sorry, but you don't have the correct permissions to use that.`,
            BASE_COMMAND_UNAVAILABLE: "This command is unavailable via private message. Please run this command in a guild.",
            BASE_COMMAND_HELP_HEADER: (name) => `Help for ${name}`,
            BASE_COMMAND_HELP_HEADER_CONT: (name) => `Continued help for ${name}`,
            BASE_CONT_STRING: '(cont)',
            BASE_COMMAND_HELP_HELP: (name) => {
                return {
                    action: "Show help",
                    actionDesc: "Show this message",
                    usage: `;${name} help`,
                    args: {}
                };
            },
            BASE_MOD_TYPES: {
                SQUARE:  'Square',
                ARROW:   'Arrow',
                DIAMOND: 'Diamond',
                TRIANGLE:'Triangle',
                CIRCLE:  'Circle',
                CROSS:   'Cross',
                ACCURACY:   'Accuracy',
                CRITCHANCE: 'Crit Chance',
                CRITDAMAGE: 'Crit Damage',
                DEFENSE:    'Defense',
                HEALTH:     'Health',
                OFFENSE:    'Offense',
                POTENCY:    'Potency',
                SPEED:      'Speed',
                TENACITY:   'Tenacity'
            },

            // Abilities Command
            COMMAND_ABILITIES_NEED_CHARACTER: (prefix) => `Need a character. Usage is \`${prefix}abilities <characterName>\``,
            COMMAND_ABILITIES_INVALID_CHARACTER: (prefix) => `Invalid character. Usage is \`${prefix}abilities <characterName>\``,
            COMMAND_ABILITIES_COOLDOWN: (aCooldown) => `**Ability Cooldown:** ${aCooldown}\n`,
            COMMAND_ABILITIES_ABILITY: (aType, mat, cdString, aDesc) => `**Ability Type:** ${aType}     **Max ability mat needed:**  ${mat}\n${cdString}${aDesc}`,
            COMMAND_ABILITIES_ABILITY_CODE: (abilityName, type, tier, aDesc) => `### ${abilityName} ###\n* Ability type: ${type}\n* Max ability mat needed: ${tier}\n* Description: ${aDesc}\n\n`,
            COMMAND_ABILITIES_HELP: {
                description: "Shows the abilities for the specified character.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';abilities <characterName>',
                        args: {}
                    }
                ]
            },

            // Activities Command
            COMMAND_ACTIVITIES_SUNDAY: `== Before Reset == \nComplete Arena Battles \nSave Cantina Energy \nSave Normal Energy\n\n== After Reset == \nSpend Cantina Energy \nSave Normal Energy`,
            COMMAND_ACTIVITIES_MONDAY: `== Before Reset == \nSpend Cantina Energy \nSave Normal Energy \n\n== After Reset == \nSpend Normal Energy on Light Side Battles `,
            COMMAND_ACTIVITIES_TUESDAY: `== Before Reset == \nSpend Normal Energy on Light Side Battles \nSave All Kinds of Energy\n\n== After Reset == \nSpend All Kinds of Energy \nSave Normal Energy`,
            COMMAND_ACTIVITIES_WEDNESDAY: `== Before Reset == \nSpend All Kinds of Energy \nSave Normal Energy\n\n== After Reset == \nSpend Normal Energy on Hard Mode Battles`,
            COMMAND_ACTIVITIES_THURSDAY: `== Before Reset == \nSpend Normal Energy on Hard Mode Battles \nSave Challenges\n\n== After Reset == \nComplete Challenges \nSave Normal Energy`,
            COMMAND_ACTIVITIES_FRIDAY: `== Before Reset == \nComplete Challenges \nSave Normal Energy\n\n== After Reset == \nSpend Normal Energy on Dark Side Battles`,
            COMMAND_ACTIVITIES_SATURDAY: `== Before Reset == \nSpend Normal Energy on Dark Side Battles \nSave Arena Battles \nSave Cantina Energy\n\n== After Reset == \nComplete Arena Battles \nSave Cantina Energy`,
            COMMAND_ACTIVITIES_ERROR: (prefix, usage) => `Invalid day, usage is \`${prefix}${usage}\``,
            COMMAND_ACTIVITIES_HELP: {
                description: "Shows the daily guild activites.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';activities [dayOfWeek]',
                        args: {}
                    }
                ]
            },

            // Arenarank Command
            COMMAND_ARENARANK_INVALID_NUMBER: `You need to enter a valid rank number`,
            COMMAND_ARENARANK_BEST_RANK: `You've already gotten as far as you can, congrats!`,
            COMMAND_ARENARANK_RANKLIST: (currentRank, battleCount, plural, est, rankList) => `From rank ${currentRank}, in ${battleCount} battle${plural} ${est}\nThe best you can get is ${rankList}`,
            COMMAND_ARENARANK_HELP: {
                description: "Shows the (approximate) highest rank you can get if you win every arena battle.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';arenarank <currentRank> [battleCount]',
                        args: {}
                    }
                ]
            },

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
            COMMAND_CHALLENGES_HELP: {
                description: "Shows the daily guild challenges.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';challenges <dayOfWeek>',
                        args: {}
                    }
                ]
            },

            // Changelog Command (Help)
            COMMAND_CHANGELOG_HELP: {
                description: "Adds a changelog to the db, and sends it to the changelog channel.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'changelog <message>',
                        args: {
                            "message": "Use [Updated], [Fixed], [Removed], and [Added] to organize the changes."
                        }
                    }
                ]
            },

            // Character gear Command
            COMMAND_CHARGEAR_NEED_CHARACTER: (prefix) => `Need a character. Usage is \`${prefix}charactergear <character> [starLvl]\``,
            COMMAND_CHARGEAR_INVALID_CHARACTER: (prefix) => `Invalid character. Usage is \`${prefix}charactergear <character> [starLvl]\``,
            COMMAND_CHARGEAR_GEAR_ALL: (name, gearString) => ` * ${name} * \n### All Gear Needed ### \n${gearString}`,
            COMMAND_CHARGEAR_GEAR_NA: 'This gear has not been entered yet',
            COMMAND_CHARACTERGEAR_HELP: {
                description: "Shows the gear requirements for the specified character/ lvl.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'charactergear <character> [gearLvl]',
                        args: {}
                    }
                ]
            },

            // Command Report Command
            COMMAND_COMMANDREPORT_HELP: ({
                description: "Shows a list of all the commands that have been run in the last 10 days.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';commandreport',
                        args: {}
                    }
                ]
            }),

            // Current Events Command
            COMMAND_CURRENTEVENTS_HEADER: "SWGoH Events Schedule",
            COMMAND_CURRENTEVENTS_DESC: (num) => `Next ${num} events.\nNote: *Dates are subject to change.*`,
            COMMAND_CURRENTEVENTS_HELP: {
                description: "Shows any upcoming events.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';currentevents [num]',
                        args: {
                            "num": "The max number of events you want to show"
                        }
                    }
                ]
            },

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

            // Event Command (Help)
            COMMAND_EVENT_HELP: {
                description: "Used to make, check, or delete an event.",
                actions: [
                    {
                        action: "Create",
                        actionDesc: 'Create a new event listing',
                        usage: ';event create <eventName> <eventDay> <eventTime> [eventMessage]',
                        args: {
                            "--repeat <repeatTime>": "Lets you set a duration with the format of 00d00h00m. It will repeat after that time has passed.",
                            "--repeatDay <schedule>": ["Lets you set it to repeat on set days with the format of 0,0,0,0,0.",
                                "Example: `-repeatDay 1,2,3` would repeat the event 1 day after the original event triggers, then 2 days after that, then 3 after that"
                            ].join('\n'),
                            "--channel <channelName>": "Lets you set a specific channel for the event to announce on.",
                            "--countdown": "Adds a countdown to when your event will trigger."
                        }
                    },
                    {
                        action: "View",
                        actionDesc: 'View your current event listings.',
                        usage: ';event view [eventName]',
                        args: {
                            "--min": "Lets you view the events without the event message",
                            "--page <page#>": "Lets you select a page of events to view"
                        }
                    },
                    {
                        action: "Delete",
                        actionDesc: 'Delete an event.',
                        usage: ';event delete <eventName>',
                        args: {}
                    },
                    {
                        action: "Trigger",
                        actionDesc: 'Trigger an event in the specified channel, leaves the event alone.',
                        usage: ';event trigger <eventName>',
                        args: {}
                    }
                ]
            },

            // Faction Command
            COMMAND_FACTION_INVALID_CHAR: (prefix) => `Invalid faction, usage is \`${prefix}faction <faction>\``,
            COMMAND_FACTION_CODE_OUT: (searchName, charString) => `# Characters in the ${searchName} faction # \n${charString}`,
            COMMAND_FACTION_HELP: {
                description: "Shows the list of characters in the specified faction.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'faction <faction>',
                        args: {
                            "faction": "The faction you want to see the roster of. \nKeep in mind, this is as shown in game, so it's rebel, not rebels"
                        }
                    }
                ]
            },

            // Guilds Command
            COMMAND_GUILDS_MORE_INFO: 'For more info on a specific guild:',
            COMMAND_GUILDS_HELP: {
                description: "Shows everyone that's in your guild/ some basic stats.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';guild [user]',
                        args: {
                            "user": "A way to identify the guild. (mention | allyCode | guildName)"
                        }
                    }
                ]
            },

            // GuildSearch Command
            COMMAND_GUILDSEARCH_BAD_STAR: 'You can only choose a star level from 1-7',
            COMMAND_GUILDSEARCH_BAD_SORT: (sortType, filters) => `Sorry, but \`${sortType}\` is not a supported sorting method. Only \`${filters.join(', ')}\` supported.`,
            COMMAND_GUILDSEARCH_MISSING_CHAR: 'You need to enter a character to check for',
            COMMAND_GUILDSEARCH_NO_RESULTS: (character) => `I did not find any results for ${character}`,
            COMMAND_GUILDSEARCH_CHAR_LIST: (chars) => `Your search came up with too many results, please be more specific. \nHere's a list of the close matches.\n\`\`\`${chars}\`\`\``,
            COMMAND_GUILDSEARCH_NO_CHAR_STAR: (starLvl) => `No one in your guild seems to have this character at ${starLvl} stars.`,
            COMMAND_GUILDSEARCH_NO_CHAR: `No one in your guild seems to have this character.`,
            COMMAND_GUILDSEARCH_NOT_ACTIVATED: (count) => `Not Activated (${count})`,
            COMMAND_GUILDSEARCH_STAR_HEADER: (star, count) => `${star} Star (${count})`,
            COMMAND_GUILDSEARCH_HELP: {
                description: "Shows the star level of the selected character for everyone in the guild.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';guildsearch [user] <character> [-ships] [-reverse] [-sort type] [starLvl]',
                        args: {
                            "user": "The person you're adding. (me | userID | mention)",
                            "character": "The character you want to search for.",
                            "-ships": "Search for ships, you can use `-s, -ship, or -ships`",
                            "-reverse": "Reverse the chosen sort",
                            "-sort": "Choose either name or gp to sort by",
                            "starLvl": "Select the star level you want to see."
                        }
                    }
                ]
            },

            // Help Command
            COMMAND_HELP_HEADER: (prefix) => `= Command List =\n\n[Use ${prefix}help <commandname> for details]\n`,
            COMMAND_HELP_OUTPUT: (command, prefix) => `= ${command.help.name} = \n${command.help.description} \nAliases:: ${command.conf.aliases.join(", ")}\nUsage:: ${prefix}${command.help.usage}`,
            COMMAND_HELP_HELP: {
                description: "Displays info about available commands.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';help [command]',
                        args: {
                            "command": "The command you want to look up info on."
                        }
                    }
                ]
            },

            // Info Command
            COMMAND_INFO_OUTPUT: (guilds, prefix) => ({
                "header": 'INFORMATION',
                "desc": ` \nCurrently running on **${guilds}** servers \nCurrent prefix: \`${prefix}\``,
                "links": {
                    "Add me to your server": "- http://swgohbot.com/invite",

                    "Support the Bot": "- [Github](https://github.com/jmiln/SWGoHBot)\n- [Patreon](https://www.patreon.com/swgohbot)\n- [PayPal](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=YY3B9BS298KYW)"
                }
            }),
            COMMAND_INFO_HELP: {
                description: "Shows useful links pertaining to the bot.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'info',
                        args: {}
                    }
                ]
            },

            COMMAND_MODS_CRIT_CHANCE_SET: "Crit. Chance x2",
            COMMAND_MODS_CRIT_DAMAGE_SET: "Crit. Damage x4",
            COMMAND_MODS_SPEED_SET: "Speed x4",
            COMMAND_MODS_TENACITY_SET: "Tenacity x2",
            COMMAND_MODS_OFFENSE_SET: "Offense x4",
            COMMAND_MODS_POTENCY_SET: "Potency x2",
            COMMAND_MODS_HEALTH_SET: "Health x2",
            COMMAND_MODS_DEFENSE_SET: "Defense x2",
            COMMAND_MODS_EMPTY_SET: " ",

            COMMAND_MODS_ACCURACY_STAT: "Accuracy",
            COMMAND_MODS_CRIT_CHANCE_STAT: "Crit. Chance",
            COMMAND_MODS_CRIT_DAMAGE_STAT: "Crit. Damage",
            COMMAND_MODS_DEFENSE_STAT: "Defense",
            COMMAND_MODS_HEALTH_STAT: "Health",
            COMMAND_MODS_OFFENSE_STAT: "Offense",
            COMMAND_MODS_PROTECTION_STAT: "Protection",
            COMMAND_MODS_POTENCY_STAT: "Potency",
            COMMAND_MODS_SPEED_STAT: "Speed",
            COMMAND_MODS_TENACITY_STAT: "Tenacity",
            COMMAND_MODS_UNKNOWN: "Unknown",

            // Mods Command
            COMMAND_MODS_NEED_CHARACTER: (prefix) => `Need a character. Usage is \`${prefix}mods <characterName>\``,
            COMMAND_MODS_INVALID_CHARACTER: (prefix) => `Invalid character. Usage is \`${prefix}mods <characterName>\``,
            COMMAND_MODS_EMBED_STRING1: (square, arrow, diamond) => `\`Square:   ${square}\`\n\`Arrow:    ${arrow}\`\n\`Diamond:  ${diamond}\`\n`,
            COMMAND_MODS_EMBED_STRING2: (triangle, circle, cross) => `\`Triangle: ${triangle}\`\n\`Circle:   ${circle}\`\n\`Cross:    ${cross}\`\n`,
            COMMAND_MODS_EMBED_OUTPUT: (modSetString, modPrimaryString) => `**### Sets ###**\n${modSetString}\n**### Primaries ###**\n${modPrimaryString}`,
            COMMAND_MODS_CODE_STRING1: (square, arrow, diamond) => `* Square:   ${square}  \n* Arrow:    ${arrow} \n* Diamond:  ${diamond}\n`,
            COMMAND_MODS_CODE_STRING2: (triangle, circle, cross) => `* Triangle: ${triangle}\n* Circle:   ${circle}\n* Cross:    ${cross}`,
            COMMAND_MODS_CODE_OUTPUT: (charName, modSetString, modPrimaryString) => ` * ${charName} * \n### Sets ### \n${modSetString}\n### Primaries ###\n${modPrimaryString}`,
            COMMAND_NO_MODSETS: "No mod sets for this character",
            COMMAND_MODS_HELP: {
                description: "Shows some suggested mods for the specified character.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'mods <character>',
                        args: {
                            "character": "The character you want to show the mods for"
                        }
                    }
                ]
            },

            // Modsets command
            COMMAND_MODSETS_OUTPUT: `* Critical Chance:  2\n* Critical Damage:  4\n* Defense:  2\n* Health:   2\n* Offense:  4\n* Potency:  2\n* Speed:    4\n* Tenacity: 2`,
            COMMAND_MODSETS_HELP: {
                description: "Shows how many of each kind of mod you need for a set.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'modsets',
                        args: {}
                    }
                ]
            },

            // MyArena Command
            COMMAND_MYARENA_NO_USER: (user) => `Sorry, but I can't find any arena data for ${user}. Please make sure that account is synced`,
            COMMAND_MYARENA_NO_CHAR: 'Something went wrong, I could not get your characters.',
            COMMAND_MYARENA_ARENA: (rank) => `Char Arena (Rank: ${rank})`,
            COMMAND_MYARENA_FLEET: (rank) => `Ship Arena (Rank: ${rank})`,
            COMMAND_MYARENA_EMBED_HEADER: (playerName) => `${playerName}'s Arena`,
            COMMAND_MYARENA_EMBED_FOOTER: (date) => `Arena data as of: ${date}`,
            COMMAND_MYARENA_HELP: {
                description: "Show user's current arena ranks and their squads.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';myarena [user]',
                        args: {
                            "user": "The person you're checking. (me | userID | mention)"
                        }
                    }
                ]
            },

            // MyCharacter Command
            COMMAND_MYCHARACTER_HELP: ({
                description: "Shows the general stats about the selected character.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';mycharacter [user] <character>',
                        args: {
                            "user": "The person you're checking. (me | userID | mention)",
                            "character": "The character you want to search for."
                        }
                    }
                ]
            }),

            // MyMods Command
            COMMAND_MYMODS_NO_MODS: (charName) => `Sorry, but I couldn't find any mods for your ${charName}`,
            COMMAND_MYMODS_MISSING_MODS: `Sorry, but I can't find your mods right now. Please wait a bit then try again.`,
            COMMAND_MYMODS_LAST_UPDATED: (lastUpdated) => `Mods last updated: ${lastUpdated} ago`,
            COMMAND_MYMODS_HELP: ({
                description: "Shows the mods that you have equipped on the selected character.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';mymods [user] <character>',
                        args: {
                            "user": "The person you're checking. (me | userID | mention)",
                            "character": "The character you want to search for."
                        }
                    }
                ]
            }),

            // MyProfile Command
            COMMAND_MYPROFILE_NO_USER: (user) => `Sorry, but I can't find any arena data for ${user}. Please make sure that account is synced`,
            COMMAND_MYPROFILE_EMBED_HEADER: (playerName, allyCode) => `${playerName}'s profile (${allyCode})`,
            COMMAND_MYPROFILE_EMBED_FOOTER: (date) => `Arena data as of: ${date}`,
            COMMAND_MYPROFILE_DESC: (guildName, level, charRank, shipRank, gpFull) => `**Guild:** ${guildName}\n**Level:** ${level}\n**Arena rank:** ${charRank}\n**Ship rank:** ${shipRank}\n**Total GP:** ${gpFull}`,
            COMMAND_MYPROFILE_CHARS: (gpChar, charList, zetaCount) => ({
                header: `Characters (${charList.length})`,
                stats: [
                    `Char GP  :: ${gpChar}`,
                    `7 Star   :: ${charList.filter(c => c.rarity === 7).length}`,
                    `lvl 85   :: ${charList.filter(c => c.level === 85).length}`,
                    `Gear 12  :: ${charList.filter(c => c.gear === 12).length}`,
                    `Gear 11  :: ${charList.filter(c => c.gear === 11).length}`,
                    `Zetas    :: ${zetaCount}`
                ].join('\n')
            }),
            COMMAND_MYPROFILE_SHIPS: (gpShip, shipList) => ({
                header: `Ships (${shipList.length})`,
                stats: [
                    `Ship GP :: ${gpShip}`,
                    `7 Star  :: ${shipList.filter(s => s.rarity === 7).length}`,
                    `lvl 85  :: ${shipList.filter(s => s.level === 85).length}`
                ].join('\n')
            }),
            COMMAND_MYPROFILE_HELP: {
                description: "Show user's general stats.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';myprofile [user]',
                        args: {
                            "user": "The person you're checking. (me | userID | mention)"
                        }
                    }
                ]
            },

            // Nickname Command
            COMMAND_NICKNAME_SUCCESS: `I have changed my nickname.`,
            COMMAND_NICKNAME_FAILURE: `Sorry, but I don't have permission to change that.`,
            COMMAND_NICKNAME_TOO_LONG: 'Sorry, but a name can only contain up to 32 characters.',
            COMMAND_NICKNAME_HELP: {
                description: "Changes the bot's nickname on the server.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';nickname <name>',
                        args: {
                            "name": "The name you're wanting to change it to. Leave it blank to reset it to default."
                        }
                    }
                ]
            },

            // Polls Command
            COMMAND_POLL_NO_ARG: 'You need to provide either an option to vote on, or an action (create/view/etc).',
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
            COMMAND_POLL_CHOICE: (opt, optCount, choice) => `\`[${opt}]\` ${choice}: **${optCount} vote${optCount === 1 ? '' : 's'}**\n`,
            COMMAND_POLL_HELP: {
                description: "Lets you start a poll with multiple options.",
                actions: [
                    {
                        action: "Create",
                        actionDesc: 'Create a new poll',
                        usage: ';poll create <question> | <opt1> | <opt2> | [...] | [opt10]',
                        args: {
                            "question": "The question that you're wanting feedback on.",
                            "opt": "The options that people can choose from"
                        }
                    },
                    {
                        action: "Vote",
                        actionDesc: 'Vote on the option that you choose',
                        usage: ';poll <choice>',
                        args: {
                            "choice": "The option that you choose."
                        }
                    },
                    {
                        action: "View",
                        actionDesc: 'See what the current tally of votes is.',
                        usage: ';poll view',
                        args: {}
                    },
                    {
                        action: "Close",
                        actionDesc: 'End the poll and show the final tally.',
                        usage: ';poll close',
                        args: {}
                    }
                ]
            },

            // Raidteams Command
            COMMAND_RAIDTEAMS_INVALID_RAID: (prefix) => `Invalid raid, usage is \`${prefix}raidteams <raid> <phase>\`\n**Example:** \`${prefix}raidteams pit p3\``,
            COMMAND_RAIDTEAMS_INVALID_PHASE: (prefix) => `Invalid phase, usage is \`${prefix}raidteams <raid> <phase>\`\n**Example:** \`${prefix}raidteams pit p3\``,
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
            COMMAND_RAIDTEAMS_HELP: {
                description: "Shows some teams that work well for each raid.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';raidteams <raid> <phase>',
                        args: {
                            "raid": "The raid that you want to see teams for. (aat|pit|sith)",
                            "phase": "The phase of the raid you want to see. (p1|p2|p3|p4|solo)"
                        }
                    }
                ]
            },

            // Randomchar Command
            COMMAND_RANDOMCHAR_INVALID_NUM: (maxChar) => `Sorry, but you need a number from 1-${maxChar} there.`,
            COMMAND_RANDOMCHAR_HELP: {
                description: "Picks up to 5 random characters to form a squad.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';randomchar [numberOfChars]',
                        args: {
                            "numberOfChars": "The number of characters that you want chosen"
                        }
                    }
                ]
            },

            // Register Command
            COMMAND_REGISTER_MISSING_ARGS: 'You need to supply a userID (mention or ID), and an ally code',
            COMMAND_REGISTER_MISSING_ALLY: 'You need to enter an ally code to link your account to.',
            COMMAND_REGISTER_INVALID_ALLY: (allyCode) => `Sorry, but ${allyCode} is not a valid ally code`,
            COMMAND_REGISTER_PLEASE_WAIT: 'Please wait while I sync your data.',
            COMMAND_REGISTER_ADD_NO_SERVER: 'You can only add users that are in your server.',
            COMMAND_REGISTER_ALREADY_ADDED: (prefix=';') => `That user is already registered! Please use \`${prefix}register update <user>\`.`,
            COMMAND_REGISTER_FAILURE: 'Registration failed, please make sure your ally code is correct.',
            COMMAND_REGISTER_SUCCESS: (user) => `Registration for \`${user}\` successful!`,
            COMMAND_REGISTER_UPDATE_FAILURE: 'Something went wrong, make sure your registered ally code is correct',
            COMMAND_REGISTER_UPDATE_SUCCESS: (user) => `Profile updated for \`${user}\`.`,
            COMMAND_REGISTER_CANNOT_REMOVE: (prefix=';') => `You cannot remove other people. If they left your guild, try \`${prefix}register update <user>\`.`,
            COMMAND_REGISTER_NOT_LINKED: 'You are not linked to a SWGoH account.',
            COMMAND_REGISTER_REMOVE_SUCCESS: 'Successfully unlinked.',
            COMMAND_REGISTER_GUPDATE_SUCCESS: (guild) => `Guild updated for \`${guild}\`.`,
            COMMAND_REGISTER_HELP: {
                description: "Register your ally code to your Discord ID, and sync your SWGoH profile.",
                actions: [
                    {
                        action: "Add",
                        actionDesc: 'Link your Discord profile to a SWGoH account',
                        usage: ';register add <user> <allyCode>',
                        args: {
                            "user": "The person you're adding. (me | userID | mention)",
                            "allyCode": "Your ally code from in-game."
                        }
                    },
                    {
                        action: "Update",
                        actionDesc: 'Update/ resync your SWGoH data.',
                        usage: ';register update <user> [-guild]',
                        args: {
                            "user": "The person you're adding. (me | userID | mention)",
                            "-guild": "Tell it to pull/ update your whole guild (-g | -guild | -guilds)"
                        }
                    },
                    {
                        action: "Remove",
                        actionDesc: 'Unlink your Discord profile from a SWGoH account',
                        usage: ';register remove <user>',
                        args: {
                            "user": "You, this is to unlink it if you have the wrong ally code. (me | userID | mention)"
                        }
                    }
                ]
            },



            // Reload Command
            COMMAND_RELOAD_INVALID_CMD: (cmd) => `I cannot find the command: ${cmd}`,
            COMMAND_RELOAD_SUCCESS: (cmd) => `Successfully reloaded: ${cmd}`,
            COMMAND_RELOAD_FAILURE: (cmd, stackTrace) => `Command reload failed: ${cmd}\n\`\`\`${stackTrace}\`\`\``,
            COMMAND_RELOAD_HELP: {
                description: "Reloads the command file, if it's been updated or modified.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';reload <command>',
                        args: {
                            "command": "The command you're wanting to reload."
                        }
                    }
                ]
            },

            // Reload Data Command
            COMMAND_RELOADDATA_HELP: {
                description: "Reloads the selected file(s).",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';reloaddata <option>',
                        args: {
                            "option": "What you're wanting to reload ( commands | data | events | function )."
                        }
                    }
                ]
            },

            // Resources Command
            COMMAND_RESOURCES_HEADER: 'SWGoH Resources',
            COMMAND_RESOURCES_INVALID_CATEGORY: (list) => `Invalid category. Please choose from one of these: \`${list}\``,
            COMMAND_RESOURCES_HELP: {
                description: "Shows useful SWGoH resources.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';resources <category>',
                        args: {
                            "category": "One of the available categories. (Bots, Game Changers, Websites)"
                        }
                    }
                ]
            },

            // Setconf Command
            COMMAND_SETCONF_MISSING_PERMS: `Sorry, but either you're not an admin, or your server leader has not set up the configs.`,
            COMMAND_SETCONF_MISSING_OPTION: `You must select a config option to change.`,
            COMMAND_SETCONF_MISSING_VALUE: `You must give a value to change that option to.`,
            COMMAND_SETCONF_ARRAY_MISSING_OPT: 'You must use `add` or `remove`.',
            COMMAND_SETCONF_ARRAY_NOT_IN_CONFIG: (key, value) => `Sorry, but \`${value}\` is not set in \`${key}\`.`,
            COMMAND_SETCONF_ARRAY_SUCCESS: (key, value, action) => `\`${value}\` has been ${action} your \`${key}\`.`,
            COMMAND_SETCONF_NO_KEY: (prefix) => `This key is not in the configuration. Look in "${prefix}showconf", or "${prefix}setconf help" for a list`,
            COMMAND_SETCONF_UPDATE_SUCCESS: (key, value) => `Guild configuration item ${key} has been changed to:\n\`${value}\``,
            COMMAND_SETCONF_NO_SETTINGS: `No guild settings found.`,

            COMMAND_SETCONF_ADMINROLE_NEED_ROLE: (opt) => `You must specify a role to ${opt}.`,
            COMMAND_SETCONF_ADMINROLE_MISSING_ROLE: (roleName) => `Sorry, but I cannot find the role ${roleName}. Please try again.`,
            COMMAND_SETCONF_ADMINROLE_ROLE_EXISTS: (roleName) => `Sorry, but ${roleName} is already there.`,
            COMMAND_SETCONF_PREFIX_TOO_LONG: 'Sorry, but you cannot have spaces in your prefix',
            COMMAND_SETCONF_WELCOME_NEED_CHAN: `Sorry, but but your announcement channel either isn't set or is no longer valid.\nGo set \`announceChan\` to a valid channel and try again.\``,
            COMMAND_SETCONF_TIMEZONE_NEED_ZONE: `Invalid timezone, look here https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \nand find the one that you need, then enter what it says in the TZ column`,
            COMMAND_SETCONF_ANNOUNCECHAN_NEED_CHAN: (chanName) => `Sorry, but I cannot find the channel ${chanName}. Please try again.`,
            COMMAND_SETCONF_ANNOUNCECHAN_NO_PERMS: `Sorry, but I don't have permission to send message there. Please either change the perms, or choose another channel.`,
            COMMAND_SETCONF_INVALID_LANG: (value, langList) => `Sorry, but ${value} is not a currently supported language. \nCurrently supported languages are: \`${langList}\``,
            COMMAND_SETCONF_RESET: `Your config has been reset`,
            COMMAND_SETCONF_HELP: {
                description: "Used to set the bot's config settings.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';setconf <key> <value>',
                        args: {}
                    },
                    {
                        action: "prefix",
                        actionDesc: 'Set the bot\'s prefix for your server.',
                        usage: ';setconf prefix <prefix>',
                        args: {}
                    },
                    {
                        action: "adminRole",
                        actionDesc: 'The role that you want to be able to modify bot settings or set up events',
                        usage: ';setconf adminRole <add|remove> <role>',
                        args: {
                            'add':  'Add a role to the list',
                            'remove': 'Remove a role from the list'
                        }
                    },
                    {
                        action: "enableWelcome",
                        actionDesc: 'Toggles the welcome message on/ off.',
                        usage: ';setconf enableWelcome <true|false>',
                        args: {}
                    },
                    {
                        action: "welcomeMessage",
                        actionDesc: 'The welcome message to send if you have it enabled (Special variables below)',
                        usage: ';setconf welcomeMessage <message>',
                        args: {
                            '{{user}}':  "gets replaced with the new user's name.",
                            '{{userMention}}': "makes it mention the new user there."
                        }
                    },
                    {
                        action: "enablePart",
                        actionDesc: 'Toggles the parting message on/ off.',
                        usage: ';setconf enablePart <true|false>',
                        args: {}
                    },
                    {
                        action: "partMessage",
                        actionDesc: 'The part message to send if you have it enabled (Special variables below)',
                        usage: ';setconf partMessage <message>',
                        args: {
                            '{{user}}':  "gets replaced with the new user's name.",
                        }
                    },
                    {
                        action: "useEmbeds",
                        actionDesc: 'Toggles whether or not to use embeds as the output for some commands.',
                        usage: ';setconf useEmbeds <true|false>',
                        args: {}
                    },
                    {
                        action: "timezone",
                        actionDesc: 'Sets the timezone that you want all time related commands to use. Look here if you need a list https://goo.gl/Vqwe49.',
                        usage: ';setconf timezone <timezone>',
                        args: {}
                    },
                    {
                        action: "announceChan",
                        actionDesc: 'Sets the name of your announcements channel for events etc. Make sure it has permission to send them there.',
                        usage: ';setconf announceChan <channelName>',
                        args: {}
                    },
                    {
                        action: "useEventPages",
                        actionDesc: 'Sets it so event view shows in pages, rather than super spammy.',
                        usage: ';setconf useEventPages <true|false>',
                        args: {}
                    },
                    {
                        action: "eventCountdown",
                        actionDesc: 'The time that you want a countdown message to appear',
                        usage: ';setconf eventCountdown <add|remove> <time>',
                        args: {
                            'add':  'Add a time to the list',
                            'remove': 'Remove a time from the list'
                        }
                    },
                    {
                        action: "language",
                        actionDesc: 'Set the bot to use any supported language for the command output.',
                        usage: ';setconf language <lang>',
                        args: {}
                    },
                    {
                        action: "swgohLanguage",
                        actionDesc: 'Sets the bot to use any supported language for the game data output.',
                        usage: ';setconf swgohLanguage <lang>',
                        args: {}
                    },
                    // {
                    //     action: "reset",
                    //     actionDesc: 'Resets the config back to default (ONLY use this if you are sure)',
                    //     usage: ';setconf reset',
                    //     args: {}
                    // }
                ]
            },

            // Shard times command
            COMMAND_SHARDTIMES_MISSING_USER: `I need a user, please enter "me", mention someone here, or input their Discord ID.`,
            COMMAND_SHARDTIMES_MISSING_ROLE: `Sorry, but you can only add yourself unless you have an admin role.`,
            COMMAND_SHARDTIMES_INVALID_USER: `Invalid user, please enter "me", mention someone here, or input their discord ID.`,
            COMMAND_SHARDTIMES_MISSING_TIMEZONE: `You need to enter a timezone.`,
            COMMAND_SHARDTIMES_INVALID_TIMEZONE: `Invalid timezone, look here https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \nand find the one that you need, then enter what it says in the TZ column`,
            COMMAND_SHARDTIMES_USER_ADDED: `User successfully added!`,
            COMMAND_SHARDTIMES_USER_MOVED: (from, to) => `Updated user from ${from} to ${to}.`,
            COMMAND_SHARDTIMES_USER_NOT_ADDED: `Something went wrong when with adding this user. Please try again.`,
            COMMAND_SHARDTIMES_REM_MISSING_PERMS: `Sorry, but you can only remove yourself unless you have an admin role.`,
            COMMAND_SHARDTIMES_REM_SUCCESS: `User successfully removed!`,
            COMMAND_SHARDTIMES_REM_FAIL: `Something went wrong when removing this user. Please try again.`,
            COMMAND_SHARDTIMES_REM_MISSING: `Sorry, but that user does not seem to be here.`,
            COMMAND_SHARDTIMES_SHARD_HEADER: `Shard payouts in:`,
            COMMAND_SHARDTIMES_HELP: {
                description: "Lists the time until the payouts of anyone registered.",
                actions: [
                    {
                        action: "Add",
                        actionDesc: 'Add a user to the shard tracker',
                        usage: ';shardtimes add <user> <timezone> [flag/emoji]',
                        args: {
                            "user": "The person you're adding. (me | userID | mention)",
                            "timezone": "The zone that your account is based in, Use this list:\n https://en.wikipedia.org/wiki/List_of_tz_database_time_zones",
                            "flag/emoji": "An optional emoji if you want it to show by your name"
                        }
                    },
                    {
                        action: "Remove",
                        actionDesc: 'Remove a user from the tracker',
                        usage: ';shardtimes remove <user>',
                        args: {
                            "user": "The person you're adding. (me | userID | mention)"
                        }
                    },
                    {
                        action: "View",
                        actionDesc: 'Look at all the tracked times for you and your shardmates',
                        usage: ';shardtimes view',
                        args: {}
                    }
                ]
            },

            // Ships Command
            COMMAND_SHIPS_NEED_CHARACTER: (prefix) => `Need a character or ship. Usage is \`${prefix}ship <ship|pilot>\``,
            COMMAND_SHIPS_INVALID_CHARACTER: (prefix) => `Invalid character or ship. Usage is \`${prefix}ship <ship|pilot>\``,
            COMMAND_SHIPS_TOO_MANY: `I found more than one result from that search. Please try to be more specific.`,
            COMMAND_SHIPS_CREW: 'Crew',
            COMMAND_SHIPS_FACTIONS: 'Factions',
            COMMAND_SHIPS_ABILITIES: (abilities) => `**Ability Type:** ${abilities.type}   **Ability Cooldown:** ${abilities.abilityCooldown} \n${abilities.abilityDesc}`,
            COMMAND_SHIPS_CODE_ABILITES_HEADER: ` * Abilities *\n`,
            COMMAND_SHIPS_CODE_ABILITIES: (abilityName, abilities) => `### ${abilityName} ###\nAbility Type: ${abilities.type}   Ability Cooldown: ${abilities.abilityCooldown}\n${abilities.abilityDesc}\n\n`,
            COMMAND_SHIPS_HELP: {
                description: "Shows info about the selected ship.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: 'ship <ship|pilot>',
                        args: {
                            "ship|pilot": "The ship or pilot for the ship you want info on."
                        }
                    }
                ]
            },

            // Showconf Command
            COMMAND_SHOWCONF_OUTPUT: (configKeys, serverName) => `The following is the current configuration for ${serverName}: \`\`\`${configKeys}\`\`\``,
            COMMAND_SHOWCONF_HELP: {
                description: "Shows the current configs for your server.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';showconf',
                        args: {}
                    }
                ]
            },

            // Squads Command
            COMMAND_SQUADS_NO_LIST: (list) => `Please select a category from the following list: \n\`${list}\``,
            COMMAND_SQUADS_SHOW_LIST: (name, list) => `Within ${name}, please chose the number corresponding with the phase you want to see: \n${list}`,
            COMMAND_SQUADS_FIELD_HEADER: 'Squads/ Characters',
            COMMAND_SQUAD_INVALID_PHASE: (list) => `Invalid phase number, please choose from the following: \n${list}`,
            COMMAND_SQUADS_HELP: {
                description: "Shows characters/ squads that are useful for various events.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';squads [user] <event> <phaseNum>',
                        args: {
                            "user": "The person you're adding. (me | userID | mention)",
                            "event": "The event that you want to see teams for. (aat|pit|sith|etc.)",
                            "phase": "The number associated with the phase you want to see"
                        }
                    }
                ]
            },

            // Stats Command
            COMMAND_STATS_OUTPUT: (memUsage, cpuLoad, uptime, users, servers, channels, shardID, botLangs, players, guilds, gohLangs, updated) => [
                `= STATISTICS (${shardID}) =`,
                `• Mem Usage  :: ${memUsage} MB`,
                `• CPU Load   :: ${cpuLoad}%`,
                `• Uptime     :: ${uptime}`,
                `• Users      :: ${users}`,
                `• Servers    :: ${servers}`,
                `• Channels   :: ${channels}`,
                `• Languages  :: ${botLangs}`,
                '• Source     :: https://github.com/jmiln/SWGoHBot\n',
                '= SWGoH Stats =',
                `• Registered Players :: ${players}`,
                `• Registered Guilds  :: ${guilds}`,
                `• Available Languages:: ${gohLangs}`,
                `• Client updated     :: ${updated}`
            ].join('\n'),
            COMMAND_STATS_HELP: {
                description: "Shows the bot's stats.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';stats',
                        args: {}
                    }
                ]
            },

            // Test command (in .gitignore)
            COMMAND_TEST_HELP: {
                description: "A command to test things out.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';test',
                        args: {}
                    }
                ]
            },

            // Time Command
            COMMAND_TIME_CURRENT: (time, zone) => `Current time is: ${time} in ${zone} time`,
            COMMAND_TIME_INVALID_ZONE: (time, zone) => `Invalid timezone, here's your guild's time ${time} in ${zone} time`,
            COMMAND_TIME_NO_ZONE: (time) => `Current time is: ${time} UTC time`,
            COMMAND_TIME_WITH_ZONE: (time, zone) => `Current time is: ${time} in ${zone} time`,
            COMMAND_TIME_HELP: {
                description: "Used to check the time with the guild's configured timezone.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';time [timezone]',
                        args: {
                            "timezone": "Optional if you want to see what time it is elsewhere"
                        }
                    }
                ]
            },

            // Updatechar Command
            COMMAND_UPDATECHAR_INVALID_OPT: (arg, usableArgs) => `Sorry, but ${arg} isn't a valid argument. Try one of these: ${usableArgs}`,
            COMMAND_UPDATECHAR_NEED_CHAR: `You need to specify a character to update.`,
            COMMAND_UPDATECHAR_WRONG_CHAR: (charName) => `Sorry, but your search for '${charName}' did not find any results. Please try again.`,
            COMMAND_UPDATECHAR_HELP: {
                description: "Update the info on a specified character.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';updatechar [gear|info|mods] [charater]',
                        args: {
                            "gear": "Update the gear for the character.",
                            "info": "Update the info for the character (Image link, abilities etc.)",
                            "mods": "Update the mods from crouchingrancor.com"
                        }
                    }
                ]
            },

            // UpdateClient Command
            COMMAND_UPDATECLIENT_HELP: {
                description: "Update the client for the SWGoHAPI.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';updateclient',
                        args: {}
                    }
                ]
            },

            // Zetas Command
            COMMAND_ZETA_NO_USER: `Sorry, but I don't have that user listed anywhere.`,
            COMMAND_ZETA_NO_ZETAS: 'You don\'t seem to have any abilities zetad.',
            COMMAND_ZETA_OUT_DESC: `\`${'-'.repeat(30)}\`\n\`[L]\` Leader | \`[S]\` Special | \`[U]\` Unique\n\`${'-'.repeat(30)}\``,
            COMMAND_ZETAS_HELP: {
                description: "Show the abilities that you have put zetas on.",
                actions: [
                    {
                        action: "",
                        actionDesc: '',
                        usage: ';zeta [user]',
                        args: {
                            "user": "The person you're adding. (me | userID | mention)"
                        }
                    }
                ]
            }
        };
    }
};
