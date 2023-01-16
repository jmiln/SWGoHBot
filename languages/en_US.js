const Language = require("../base/Language");
const langList = ["ENG_US", "GER_DE", "SPA_XM", "FRE_FR", "RUS_RU", "POR_BR", "KOR_KR", "ITA_IT", "TUR_TR", "CHS_CN", "CHT_CN", "IND_ID", "JPN_JP", "THA_TH"];
const swgohLangList = ["de_DE", "en_US", "es_SP", "ko_KR", "pt_BR"];
const DAYSOFWEEK = {
    SUNDAY: {
        SHORT: "Sun",
        LONG: "Sunday"
    },
    MONDAY: {
        SHORT: "Mon",
        LONG: "Monday"
    },
    TUESDAY: {
        SHORT: "Tue",
        LONG: "Tuesday"
    },
    WEDNESDAY: {
        SHORT: "Wed",
        LONG: "Wednesday"
    },
    THURSDAY: {
        SHORT: "Thu",
        LONG: "Thursday"
    },
    FRIDAY: {
        SHORT: "Fri",
        LONG: "Friday"
    },
    SATURDAY: {
        SHORT: "Sat",
        LONG: "Saturday"
    }
};
const TIMES = {
    DAY: {
        PLURAL: "days",
        SING: "day",
        SHORT_PLURAL: "ds",
        SHORT_SING: "d"
    },
    HOUR: {
        PLURAL: "hours",
        SING: "hour",
        SHORT_PLURAL: "hrs",
        SHORT_SING: "hr"
    },
    MINUTE: {
        PLURAL: "minutes",
        SING: "minute",
        SHORT_PLURAL: "mins",
        SHORT_SING: "min"
    },
    SECOND: {
        PLURAL: "seconds",
        SING: "second",
        SHORT_PLURAL: "secs",
        SHORT_SING: "sec"
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
            BASE_DEFAULT_MISSING: "Trying to use a nonexistent string here. If you see this message, please report it so it can be fixed.",

            // Base swgohBot.js file
            BASE_LAST_EVENT_NOTIFICATION: "\n\nThis is the last instance of this event. To continue receiving this announcement, create a new event.",
            BASE_EVENT_STARTING_IN_MSG: (key, timeToGo) => `**${key}**\nStarting in ${timeToGo}`,
            BASE_EVENT_LATE: "Sorry, but this event was triggered later than expected. If it is set to repeat, the next alert should be on time.",

            // Base swgohAPI
            BASE_SWGOH_NO_GUILD: "I cannot find any users for that guild. \nPlease make sure you have spelled the name correctly, and that the capitalization is correct.",
            BASE_SWGOH_MISSING_CHAR: "You need to enter a character to check for",
            BASE_SWGOH_NO_CHAR_FOUND: (character) => `I did not find any results for ${character}`,
            BASE_SWGOH_CHAR_LIST: (chars) => `Your search came up with too many results, please be more specific. \nHere's a list of the close matches.\n\`\`\`${chars}\`\`\``,
            BASE_SWGOH_NO_ACCT: "Something went wrong, please make sure your account is synced correctly.",
            BASE_SWGOH_LAST_UPDATED: (date) => `Last updated ${date} ago`,
            BASE_SWGOH_PLS_WAIT_FETCH: (dType) => `Please wait while I get your ${dType ? dType : "data"}`,
            BASE_SWGOH_NAMECHAR_HEADER: (name, char) => `${name}'s ${char}`,
            BASE_SWGOH_NAMECHAR_HEADER_NUM: (name, char, num) => `${name}'s ${char} (${num})`,
            BASE_SWGOH_LOCKED_CHAR: "Sorry, but it looks like you don't have this character unlocked",
            BASE_SWGOH_GUILD_LOCKED_CHAR: "Sorry, but it looks like no one in your guild has this character unlocked",

            // Generic (Not tied to a command)
            COMMAND_EXTENDED_HELP: (command) => `**Extended help for ${command.help.name}** \n**Usage**: ${command.help.usage} \n${command.help.extended}`,
            COMMAND_INVALID_BOOL: "Invalid value, try true or false",
            COMMAND_MISSING_PERMS: "Sorry, but you don't have the correct permissions to use that.",
            BASE_CANNOT_DM: "Sorry, but I could not send you a message. Please make sure you have it set to let people in this server send you messages.",
            BASE_COMMAND_UNAVAILABLE: "This command is unavailable via private message. Please run this command in a guild.",
            BASE_COMMAND_HELP_HEADER: (name) => `Help for ${name}`,
            BASE_COMMAND_HELP_HEADER_CONT: (name) => `Continued help for ${name}`,
            BASE_CONT_STRING: "(cont)",
            BASE_COMMAND_HELP_HELP: (name) => {
                return {
                    action: "Show help",
                    actionDesc: "Show this message",
                    usage: `;${name} help`,
                    args: {}
                };
            },
            BASE_MOD_TYPES: {
                SQUARE:  "Square",
                ARROW:   "Arrow",
                DIAMOND: "Diamond",
                TRIANGLE:"Triangle",
                CIRCLE:  "Circle",
                CROSS:   "Cross",
                ACCURACY:   "Accuracy",
                CRITCHANCE: "Crit Chance",
                CRITDAMAGE: "Crit Damage",
                DEFENSE:    "Defense",
                HEALTH:     "Health",
                OFFENSE:    "Offense",
                POTENCY:    "Potency",
                SPEED:      "Speed",
                TENACITY:   "Tenacity"
            },
            BASE_MODSETS_FROM_GAME: {
                1: "Health",
                2: "Offense",
                3: "Defense",
                4: "Speed",
                5: "Crit Chance",
                6: "Crit Damage",
                7: "Potency",
                8: "Tenacity"
            },
            BASE_MODS_FROM_GAME: {
                "UNITSTATEVASIONNEGATEPERCENTADDITIVE": "Accuracy %",
                "UNITSTATCRITICALCHANCEPERCENTADDITIVE": "Crit Chance %",
                "UNITSTATCRITICALDAMAGE": "Crit Damage %",
                "UNITSTATCRITICALNEGATECHANCEPERCENTADDITIVE": "Crit Avoidance",
                "UNITSTATDEFENSE": "Defense",
                "UNITSTATDEFENSEPERCENTADDITIVE": "Defense %",
                "UNITSTATACCURACY": "Potency %",
                "UNITSTATMAXHEALTH": "Health",
                "UNITSTATMAXHEALTHPERCENTADDITIVE": "Health %",
                "UNITSTATMAXSHIELD": "Protection",
                "UNITSTATMAXSHIELDPERCENTADDITIVE": "Protection %",
                "UNITSTATOFFENSE": "Offense",
                "UNITSTATOFFENSEPERCENTADDITIVE": "Offense %",
                "UNITSTATRESISTANCE": "Tenacity %",
                "UNITSTATSPEED": "Speed"
            },
            BASE_STAT_NAMES: {
                PRIMARY:    "Primary Attributes",
                STRENGTH:   "Strength",
                AGILITY:    "Agility",
                TACTICS:    "Intelligence",
                GENERAL:    "General",
                HEALTH:     "Health",
                PROTECTION: "Protection",
                SPEED:      "Speed",
                CRITDMG:    "Critical Damage",
                POTENCY:    "Potency",
                TENACITY:   "Tenacity",
                HPSTEAL:    "Health Steal",
                DEFENSEPEN: "Defense Pen",
                PHYSOFF:    "Physical Offense",
                PHYSDMG:    "Physical Damage",
                PHYSCRIT:   "Physical Crit Chance",
                ARMORPEN:   "Armor Pen",
                ACCURACY:   "Accuracy",
                PHYSSURV:   "Physical Survivability",
                ARMOR:      "Armor",
                DODGECHANCE:"Dodge Chance",
                CRITAVOID:  "Critical Avoidance",
                SPECOFF:    "Special Offense",
                SPECDMG:    "Special Damage",
                SPECCRIT:   "Special Crit Chance",
                RESPEN:     "Resistance Pen",
                SPECSURV:   "Special Survivability",
                RESISTANCE: "Resistance",
                DEFLECTION: "Deflection Chance"
            },
            BASE_LEVEL_SHORT: "lvl",
            BASE_GEAR_SHORT: "Gear",
            BASE_SOMETHING_WEIRD: "Something weird happened, and that didn't work. Please report it to SWGoHBot HQ",
            BASE_SOMETHING_BROKE: "Something Broke",
            BASE_SOMETHING_BROKE_GUILD: "Something broke while getting your guild",
            BASE_SOMETHING_BROKE_GUILD_ROSTER: "Something broke while getting your guild's roster",
            BASE_PLEASE_TRY_AGAIN: "Please try again in a bit.",

            // Abilities Command
            COMMAND_CHARACTER_NEED_CHARACTER: "Missing character. \nUsage is `/character character: <characterName>`",
            COMMAND_CHARACTER_INVALID_CHARACTER: "Invalid character. \nUsage is `/character character: <characterName>`",
            COMMAND_CHARACTER_COOLDOWN: (aCooldown) => `**Ability Cooldown:** ${aCooldown}\n`,
            COMMAND_CHARACTER_ABILITY: (aType, mat, cdString, aDesc) => `**Ability Type:** ${aType}\n**Ability mats needed:     ${mat}**\n${cdString}${aDesc}`,
            COMMAND_CHARACTER_HELP: {
                description: "Shows info for the specified character.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";character <characterName>",
                        args: {}
                    }
                ]
            },

            //Acronym Command
            COMMAND_ACRONYMS_INVALID: "Missing acronym to look up.",
            COMMAND_ACRONYMS_NOT_FOUND: "Acronym could not be found.",
            COMMAND_ACRONYMS_HELP: {
                description: "Helps to provide a lookup for the acronyms commonly used in Star Wars: Galaxy of Heroes.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";acronym acronymToLookUp\n;acronym orMultiple acronyms",
                        args: {}
                    }
                ]
            },

            // Activities Command
            COMMAND_ACTIVITIES_SUNDAY:    "== Before Reset == \nComplete Arena Battles \nSave Cantina Energy \nSave Normal Energy\n\n== After Reset == \nSpend Cantina Energy \nSave Normal Energy",
            COMMAND_ACTIVITIES_MONDAY:    "== Before Reset == \nSpend Cantina Energy \nSave Normal Energy \n\n== After Reset == \nSpend Normal Energy on Light Side Battles ",
            COMMAND_ACTIVITIES_TUESDAY:   "== Before Reset == \nSpend Normal Energy on Light Side Battles \nSave All Kinds of Energy\n\n== After Reset == \nSpend All Kinds of Energy \nSave Normal Energy",
            COMMAND_ACTIVITIES_WEDNESDAY: "== Before Reset == \nSpend All Kinds of Energy \nSave Normal Energy\n\n== After Reset == \nSpend Normal Energy on Hard Mode Battles",
            COMMAND_ACTIVITIES_THURSDAY:  "== Before Reset == \nSpend Normal Energy on Hard Mode Battles \nSave Challenges\n\n== After Reset == \nComplete Challenges \nSave Normal Energy",
            COMMAND_ACTIVITIES_FRIDAY:    "== Before Reset == \nComplete Challenges \nSave Normal Energy\n\n== After Reset == \nSpend Normal Energy on Dark Side Battles",
            COMMAND_ACTIVITIES_SATURDAY:  "== Before Reset == \nSpend Normal Energy on Dark Side Battles \nSave Arena Battles \nSave Cantina Energy\n\n== After Reset == \nComplete Arena Battles \nSave Cantina Energy",
            COMMAND_ACTIVITIES_HELP: {
                description: "Shows the daily guild activites.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";activities [dayOfWeek]",
                        args: {}
                    }
                ]
            },

            // ArenaAlert Command
            COMMAND_ARENAALERT_PATREON_ONLY:    "Sorry, but this command/ feature is only available as a thank you to Patreon supporters through https://www.patreon.com/swgohbot",
            COMMAND_ARENAALERT_MISSING_DM:      "Missing option. Try all/primary/off.",
            COMMAND_ARENAALERT_INVALID_DM:      "Invalid option. Try all/primary/off.",
            COMMAND_ARENAALERT_MISSING_ARENA:   "Missing arena, you need to chose one of the following: `char, fleet, both`",
            COMMAND_ARENAALERT_INVALID_ARENA:   "Invalid arena, you need to chose one of the following: `char, fleet, both`",
            COMMAND_ARENAALERT_MISSING_WARNING: "Missing number, try `0` to turn it off, or a number of minutes that you want it to warn you ahead of time.",
            COMMAND_ARENAALERT_INVALID_WARNING: "Invalid number, try `0` to turn it off, or a number of minutes that you want it to warn you ahead of time.",
            COMMAND_ARENAALERT_INVALID_NUMBER:  "Invalid number, your number needs to be between 0 (turns it off), and 1440 (one day).",
            COMMAND_ARENAALERT_INVALID_OPTION:  "Try one of these: `enableDMs, arena, payoutResult, payoutWarning, view`",
            COMMAND_ARENAALERT_INVALID_BOOL:    "Invalid option. Try `yes/no`, `true/false` or `on/off`",
            COMMAND_ARENAALERT_UPDATED:         "Your settings have been updated.",
            COMMAND_ARENAALERT_VIEW_HEADER:     "Arena Rank DMs",
            COMMAND_ARENAALERT_VIEW_DM:         "DM for rank drops",
            COMMAND_ARENAALERT_VIEW_SHOW:       "Show for Arena",
            COMMAND_ARENAALERT_VIEW_WARNING:    "Payout warning",
            COMMAND_ARENAALERT_VIEW_RESULT:     "Payout result alert",
            COMMAND_ARENAALERT_HELP: {
                description: "Manage your arena alert settings.",
                actions: [
                    {
                        action: "Arena Alert",
                        actionDesc: "Set alerts to DM when your rank drops and other arena related stuff.",
                        usage: [
                            ";arenaalert enableDMs <all|primary|off>",
                            ";arenaalert arena <both|fleet|char>",
                            ";arenaalert payoutResult <on|off>",
                            ";arenaalert payoutWarning <0-1439>",
                            ";arenaalert view"
                        ].join("\n"),
                        args: {
                            "enableDMs": "Turn on DM alerts for just your primary allycode, all allycodes, or none",
                            "arena": "Choose which arena's alerts you want",
                            "payoutResult": "Send you a DM with your final payout result",
                            "payoutWarning": "Send you a DM the set number of min before your payout. 0 to turn it off.",
                            "view": "See your current arenaalert settings"
                        }
                    }
                ]
            },

            // Arenarank Command
            COMMAND_ARENARANK_INVALID_NUMBER: "You need to enter a valid rank number",
            COMMAND_ARENARANK_BEST_RANK: "You've already gotten as far as you can, congrats!",
            COMMAND_ARENARANK_RANKLIST: (currentRank, battleCount, plural, est, rankList) => `From rank ${currentRank}, in ${battleCount} battle${plural} ${est}\nThe best you can get is ${rankList}`,
            COMMAND_ARENARANK_ALLYCODE: "This command doesn't support using ally codes, maybe you're looking for the **myArena** command?",
            COMMAND_ARENARANK_HELP: {
                description: "Shows the (approximate) highest rank you can get if you win every arena battle.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";arenarank <currentRank> [battleCount]",
                        args: {}
                    }
                ]
            },

            // ArenaWatch Command
            COMMAND_ARENAWATCH_PATREON_ONLY:        "Sorry, but this command/ feature is only available as a thank you to Patreon supporters through https://www.patreon.com/swgohbot",
            COMMAND_ARENAWATCH_MISSING_PERM:        "You do not have the correct permissions to set this as a log channel, make sure you have an adminRole or MANAGE_SERVER permission",
            COMMAND_ARENAWATCH_MISSING_ARENA:       "Missing arena, you need to chose one of the following: `char, fleet, both`",
            COMMAND_ARENAWATCH_INVALID_ARENA:       "Invalid arena, you need to chose one of the following: `char, fleet, both`",
            COMMAND_ARENAWATCH_INVALID_OPTION:      "Try one of these: `enabled, arena, channel, allycode, or view`",
            COMMAND_ARENAWATCH_INVALID_BOOL:        "Invalid option. Try `yes/no`, `true/false` or `on/off`",
            COMMAND_ARENAWATCH_MISSING_ACTION:      "Missing action, try `add`, `edit` or `remove`",
            COMMAND_ARENAWATCH_INVALID_ACTION:      "Invalid action, try `add`, `edit` or `remove`",
            COMMAND_ARENAWATCH_MISSING_AC:(act) =>  "Missing ally code to " + act,
            COMMAND_ARENAWATCH_INVALID_AC:          "Invalid ally code",
            COMMAND_ARENAWATCH_AC_CAP: (code) =>    `Could not add ${code}, ally code cap reached!`,
            COMMAND_ARENAWATCH_UPDATED:             "Your settings have been updated.",
            COMMAND_ARENAWATCH_HELP: {
                description: "Manage your arena watcher settings.",
                actions: [
                    {
                        action: "Arena Watch",
                        actionDesc: "Set alerts to send messages to a channel when you or a shardmate change rank in an arena.",
                        usage: [
                            ";arenawatch allycode <add|remove> <allycode|allycode:mention>",
                            ";arenawatch allycode <edit> <allycode> <allycode:mention>",
                            ";arenawatch arena <both|fleet|char>",
                            ";arenawatch channel <channelMention> [char|fleet|ship]",
                            ";arenawatch enabled <on|off>",
                        ].join("\n"),
                        args: {
                            "allycode": "Edit the list of ally codes. Use allycode:mention to mention a person",
                            "arena": "Choose which arena's alerts you want",
                            "channel": "Select which channel to output logs to",
                            "enabled": "Toggle alerts for all selected allycodes",
                        }
                    },
                    {
                        action: "Arena Watch (Cont)",
                        actionDesc: "Continuation of the Arena Watch section",
                        usage: [
                            ";arenawatch report <both|climb|drop>",
                            ";arenawatch result <allycode> <none|both|char|fleet>",
                            ";arenawatch showvs <on|off>",
                            ";arenawatch useMarksInLog <on|off>",
                        ].join("\n"),
                        args: {
                            "report": "Tell it to report on just climbs, drops, or both",
                            "result": "Announce a player's final rank at payout",
                            "showVs": "Toggle showing both sides of a battle",
                            "useMarksInLog": "Use the players' marks in the arena log",
                        }
                    },
                    {
                        action: "Arena Watch (Cont v2)",
                        actionDesc: "Another continuation of the Arena Watch section",
                        usage: [
                            ";arenawatch view [allycode]",
                            ";arenawatch warn <allycode> <#ofMin> <none|both|char|fleet>",
                        ].join("\n"),
                        args: {
                            "view": "View the current settings. Include an ally code to view settings for a specific person",
                            "warn": "Warn the player in the log channel, #ofMin before their payout",
                        }
                    },
                    {
                        action: "Arena Payouts",
                        actionDesc: "Keep an updated list of all registered players and how long until their payouts.",
                        usage: [
                            ";arenawatch payout enabled char|fleet",
                            ";arenawatch payout channel <channelMention> <char|fleet|ship>",
                            ";arenawatch payout mark <allycode> [emote/symbol/mark]"
                        ].join("\n"),
                        args: {
                            "enabled": "Toggle the enabled status of each arena type",
                            "channel": "Set the channel for it to use, and which arena to show there.",
                            "mark":    "Mark a player with an emote or symbol, or something else of your choosing. Leave it blank to remove an existing mark."
                        }
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
            COMMAND_CHALLENGES_MISSING_DAY: "You need to specify a day",
            COMMAND_CHALLENGES_HELP: {
                description: "Shows the daily guild challenges.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";challenges <dayOfWeek>",
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
                        actionDesc: "",
                        usage: "changelog <message>",
                        args: {
                            "message": "Use [Updated], [Changed], [Fixed], [Removed], and [Added] to organize the changes."
                        }
                    }
                ]
            },

            // Character gear Command
            COMMAND_CHARACTERGEAR_INVALID_GEAR: "Invalid gear level. Valid gears are between 1 & 12.",
            COMMAND_CHARACTERGEAR_GEAR_ALL: (name, gearString) => ` * ${name} * \n### All Gear Needed ### \n${gearString}`,
            COMMAND_CHARACTERGEAR_GEAR_NA: "This gear has not been entered yet",
            COMMAND_CHARACTERGEAR_HELP: {
                description: "Shows the gear requirements for the specified character/ lvl.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "charactergear <character> [gearLvl] [-all]",
                        args: {
                            "character": "The character you want to see the gear for",
                            "gearLvl": "If you just want to see the gear for a certain gear level",
                            "-all": "Use this flag to expand the gear shown, and show all the bits that make up the main pieces (-a | -recipes | -recs | -expand)"
                        }
                    },
                    {
                        action: "Check your own gear needs",
                        actionDesc: "",
                        usage: "charactergear [user] <character> [gearLvl] [-all]",
                        args: {
                            "user": "The person you want to see the gear for. (me | userID | mention)",
                            "character": "The character you want to see the gear for",
                            "gearLvl": "If you want to see all needed gear up to a certain gear level",
                            "-all": "Use this flag to expand the gear shown, and show all the bits that make up the main pieces (-a | -recipes | -recs | -expand)"
                        }
                    }
                ]
            },

            // CheckAct Help
            COMMAND_CHECKACTIVITY_NOT_ACTIVE: "You need to activate the activity log with the setconf command before you can use this.",
            COMMAND_CHECKACTIVITY_NO_ROLE: (role) => `Cannot find role **${role}**`,
            COMMAND_CHECKACTIVITY_NO_MATCH_TITLE: "No Match",
            COMMAND_CHECKACTIVITY_NO_MATCH: "No one matches your criteria",
            COMMAND_CHECKACTIVITY_TABLE_HEADERS: {
                user: "User",
                time: "Last Seen",
                igTime: "Ingame Act",
                discordTime: "Disc. Act"
            },
            COMMAND_CHECKACTIVITY_LOG_HEADER: (guildName, count) => `${guildName}'s activity log (${count})`,
            COMMAND_CHECKACTIVITY_INVALID_USER: "Invalid user ID, try mentioning the user you're trying to check.",
            COMMAND_CHECKACTIVITY_USER_CHECK: (user, time) => `${user} was last active ${time} ago`,
            COMMAND_CHECKACTIVITY_USER_CHECK2: (user) => `${user} was last active just a bit ago`,
            COMMAND_CHECKACTIVITY_USER_CHECK_HEADER: "User Activity",
            COMMAND_CHECKACTIVITY_NO_USER: (user) => `I have not seen ${user} here`,
            COMMAND_CHECKACTIVITY_HELP: {
                description: "Shows how recently people in your server have been active",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "checkact [user] [-sort name] [-role role] [-time hours]",
                        args: {
                            "user": "Select a specific user to see when they were last active",
                            "-sort": "Sort the list by user names instead of last activity",
                            "-role": "Select a role to filter the list by",
                            "-time": "Will show only people not active within the last x hours"
                        }
                    }
                ]
            },

            // Command Report Command
            COMMAND_COMMANDREPORT_HELP: ({
                description: "Shows a list of all the commands that have been run in the last 10 days.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";commandreport",
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
                        actionDesc: "",
                        usage: ";currentevents [num]",
                        args: {
                            "num": "The max number of events you want to show"
                        }
                    }
                ]
            },

            // Event Command (Create)
            COMMAND_EVENT_INVALID_ACTION: (actions) => `Valid actions are \`${actions}\`.`,
            COMMAND_EVENT_INVALID_PERMS: "Sorry, but either you're not an admin, or your server leader has not set up the configs.\nYou cannot add or remove an event unless you have the configured admin role.",
            COMMAND_EVENT_ONE_REPEAT: "You must pick either `repeat` or `repeatDay` for one event. Please pick one or the other",
            COMMAND_EVENT_INVALID_REPEAT: "The repeat is in the wrong format. Example: `5d3h8m` for 5 days, 3 hours, and 8 minutes",
            COMMAND_EVENT_USE_COMMAS: "Please use comma seperated numbers for repeatDay. Example: `1,2,1,3,4`",
            COMMAND_EVENT_INVALID_CHAN: "This channel is invalid, please try again",
            COMMAND_EVENT_CHANNEL_NO_PERM: (channel) => `I don't have permission to send messages in ${channel}, please choose one where I can`,
            COMMAND_EVENT_NEED_CHAN: "You need to configure a channel to send this to. Configure `announceChan` to be able to make events.",
            COMMAND_EVENT_NEED_NAME: "You must give a name for your event.",
            COMMAND_EVENT_NEED_DATE: "You must give a date for your event. Accepted format is `DD/MM/YYYY`.",
            COMMAND_EVENT_BAD_DATE: (badDate) => `${badDate} is not a valid date. Accepted format is \`DD/MM/YYYY\`.`,
            COMMAND_EVENT_NEED_TIME: "You must give a time for your event.",
            COMMAND_EVEMT_INVALID_TIME: "You must give a valid time for your event. Accepted format is `HH:MM`, using a 24 hour clock. So no AM or PM",
            COMMAND_EVENT_PAST_DATE: (eventDATE, nowDATE) => `You cannot set an event in the past. ${eventDATE} is before ${nowDATE}`,
            COMMAND_EVENT_CREATED: (eventName, eventDate) => `Event \`${eventName}\` created for ${eventDate}`,
            COMMAND_EVENT_NO_CREATE: "I couldn't set that event, please try again.",
            COMMAND_EVENT_TOO_BIG:(charCount) => `Sorry, but either your event's name or message is too big. Please trim it down by at least ${charCount} characters.`,

            // Event Command (Create -json)
            COMMAND_EVENT_JSON_INVALID_NAME: "Invalid or missing event name",
            COMMAND_EVENT_JSON_NO_SPACES: "Event name cannot contain spaces. You can use _ or - instead.",
            COMMAND_EVENT_JSON_EXISTS: "There is already an event with this name",
            COMMAND_EVENT_JSON_DUPLICATE: "You cannot make 2 events with the same name",
            COMMAND_EVENT_JSON_MISSING_DAY: "Missing event date (DD/MM/YYYY)",
            COMMAND_EVENT_JSON_INVALID_DAY: (day) => `Invalid Day (${day}). Must be in the format DD/MM/YYYY`,
            COMMAND_EVENT_JSON_MISSING_TIME: "Missing event time (HH:MM)",
            COMMAND_EVENT_JSON_INVALID_TIME: (time) => `Invalid time (${time}). Must be in 24hr format HH:MM`,
            COMMAND_EVENT_JSON_INVALID_CHANNEL: (chan) => `Invalid channel (${chan}), wrong ID or channel is not in this server`,
            COMMAND_EVENT_JSON_MISSING_CHANNEL_PERMS: (chan) => `Invalid channel (${chan}). I do not have permissions to post there.`,
            COMMAND_EVENT_JSON_NO_2X_REPEAT: "You cannot have both repeat & repeatDay",
            COMMAND_EVENT_JSON_BAD_NUM: "All numbers must be above 0 in repeatDay",
            COMMAND_EVENT_JSON_BAD_FORMAT: "RepeatDay must be in the form of an array (Ex: `[1,2,5,1,4]`)",
            COMMAND_EVENT_JSON_COUNTDOWN_BOOL: "Countdown must be either true or false",
            COMMAND_EVENT_JSON_ERROR_LIST: (num, list) => `Event #${num}    ERROR(s)\n${list}`,
            COMMAND_EVENT_JSON_EVENT_VALID: (num, name, time, day) => `Event #${num} valid\nName: ${name}\nTime: ${time} on ${day}`,
            COMMAND_EVENT_JSON_ERR_NOT_ADDED: (list) => `**One or more of your events has an error, so none have been added:**${list}`,
            COMMAND_EVENT_JSON_EV_ADD_ERROR: (name, msg) => `Failed to create event \`${name}\` ${msg}`,
            COMMAND_EVENT_JSON_YES_NO: (errCount, errLog, addCount, addLog) => `**${errCount} Events failed to add**\n${errLog}\n**${addCount} Added**\n${addLog}`,
            COMMAND_EVENT_JSON_ADDED: (count, log) => `**${count} Events added successfully:**\n${log}`,
            COMMAND_EVENT_JSON_BAD_JSON: "If you're using the `-json` flag, you need valid json inside a code block",

            // Event Command (View)
            COMMAND_EVENT_TIME: (eventName, eventDate) => `**${eventName}** \nEvent Time: ${eventDate}\n`,
            COMMAND_EVENT_TIME_LEFT: (timeLeft) => `Time Remaining: ${timeLeft}\n`,
            COMMAND_EVENT_CHAN: (eventChan) => `Sending on channel: ${eventChan}\n`,
            COMMAND_EVENT_SCHEDULE: (repeatDays) => `Repeat schedule: ${repeatDays}\n`,
            COMMAND_EVENT_REPEAT: (eventDays, eventHours, eventMins) => `Repeating every ${eventDays} days, ${eventHours} hours, and ${eventMins} minutes\n`,
            COMMAND_EVENT_MESSAGE: (eventMsg) => `Event Message: \n\`\`\`md\n${eventMsg}\`\`\``,
            COMMAND_EVENT_UNFOUND_EVENT: (eventName) => `Sorry, but I cannot find the event \`${eventName}\``,
            COMMAND_EVENT_NO_EVENT: "You don't currently have any events scheduled.",
            COMMAND_EVENT_SHOW_PAGED: (eventCount, PAGE_SELECTED, PAGES_NEEDED, eventKeys) => `Here's your server's Event Schedule \n(${eventCount} total event${eventCount > 1 ? "s" : ""}) Showing page ${PAGE_SELECTED}/${PAGES_NEEDED}: \n${eventKeys}`,
            COMMAND_EVENT_SHOW: (eventCount, eventKeys) => `Here's your server's Event Schedule \n(${eventCount} total event${eventCount > 1 ? "s" : ""}): \n${eventKeys}`,

            // Event Command (Delete)
            COMMAND_EVENT_DELETE_NEED_NAME: "You must give an event name to delete.",
            COMMAND_EVENT_DOES_NOT_EXIST: "That event does not exist.",
            COMMAND_EVENT_DELETED: (eventName) => `Deleted event: ${eventName}`,

            // Event Command (Trigger)
            COMMAND_EVENT_TRIGGER_NEED_NAME: "You must give an event name to trigger.",

            // Event Command (Other)
            COMMAND_EVENT_TOO_MANY_EVENTS: "Sorry, but you can only have up to 50 events",

            // Event Command (Edit)
            COMMAND_EVENT_EDIT_MISSING_ARG: "Missing a field to edit",
            COMMAND_EVENT_EDIT_INVALID_ARG: (target, changable) => `${target} is not a valid field. Try one of these:\n\`${changable}\``,
            COMMAND_EVENT_EDIT_MISSING_NAME: "Missing a name to change to",
            COMMAND_EVENT_EDIT_INAVLID_NAME: "Spaces are not allowed in the name, try using `-` or `_` instead.",
            COMMAND_EVENT_EDIT_SPACE_DATE: "There should be no spaces in the date. The correct format is `DD/MM/YYYY`",
            COMMAND_EVENT_EDIT_MISSING_DATE: "Missing a date to change to.",
            COMMAND_EVENT_EDIT_INVALID_DATE: "Invalid date format, only `DD/MM/YYYY` is supported.",
            COMMAND_EVENT_EDIT_SPACE_TIME: "There should be no spaces in the time. The correct format is `HH:mm`",
            COMMAND_EVENT_EDIT_MISSING_TIME: "Missing a time to change to.",
            COMMAND_EVENT_EDIT_INVALID_TIME: "Invalid time format, only `HH:mm` is supported.",
            COMMAND_EVENT_EDIT_MISSING_MESSAGE: "Missing a message to change to",
            COMMAND_EVENT_EDIT_LONG_MESSAGE: "Your new message it soo long. Try trimming it down a bit.",
            COMMAND_EVENT_EDIT_MISSING_CHANNEL: "Missing a channel to change to.",
            COMMAND_EVENT_EDIT_MISSING_COUNTDOWN: "Missing choice, you need to enter whether you want it on or off",
            COMMAND_EVENT_EDIT_INVALID_COUTNDOWN: "Invalid option. Try `yes/no`, `true/false` or `on/off`",
            COMMAND_EVENT_EDIT_MISSING_REPEATDAY: "Missing something to change to, repeatDay needs something in the format of `0,0,0,0,0`.",
            COMMAND_EVENT_EDIT_SPACE_REPEATDAY: "There should be no spaces here, proper format is `0,0,0,0,0`.",
            COMMAND_EVENT_EDIT_BOTH_REPEATDAY: "You already have a repeat set, cannot have both repeat & repeatDay set.",
            COMMAND_EVENT_EDIT_MISSING_REPEAT: "Missing something to change to, repeatDay needs something in the format of `0d0h0m`.",
            COMMAND_EVENT_EDIT_SPACE_REPEAT: "There should be no spaces here, proper format is `0d0h0m`.",
            COMMAND_EVENT_EDIT_BOTH_REPEAT: "You already have a repeatday set, cannot have both repeat & repeatDay set.",
            COMMAND_EVENT_EDIT_UPDATED: (target, cFrom, cTo) => `Changed ${target} from **${cFrom}** to **${cTo}**`,
            COMMAND_EVENT_EDIT_BROKE: "Something went wrong when updating the event.",

            // Event Command (Help)
            COMMAND_EVENT_HELP: {
                description: "Used to make, check, or delete an event.",
                actions: [
                    {
                        action: "Create",
                        actionDesc: "Create a new event listing",
                        usage: ";event create <eventName> <eventDay> <eventTime> [eventMessage]",
                        args: {
                            "--repeat <repeatTime>": "Lets you set a duration with the format of 00d00h00m. It will repeat after that time has passed.",
                            "--repeatDay <schedule>": ["Lets you set it to repeat on set days with the format of 0,0,0,0,0.",
                                "Example: `-repeatDay 1,2,3` would repeat the event 1 day after the original event triggers, then 2 days after that, then 3 after that"
                            ].join("\n"),
                            "--channel <channelName>": "Lets you set a specific channel for the event to announce on.",
                            "--countdown": "Adds a countdown to when your event will trigger."
                        }
                    },
                    {
                        action: "Create (JSON)",
                        actionDesc: "Create a new event listing",
                        usage: ";event create --json <codeBlock w/ json>",
                        args: {
                            "--json <codeBlock>": "Example: ```[{\n    \"name\": \"\",\n    \"time\": \"\",\n    \"day\":  \"\",\n    \"message\": \"\",\n    \"repeatDay\": [0, 0, 0],\n    \"repeat\": \"0d0h0m\",\n    \"countdown\": false,\n    \"channel\": \"\"\n}]```"
                        }
                    },
                    {
                        action: "View",
                        actionDesc: "View your current event listings.",
                        usage: ";event view [eventName]",
                        args: {
                            "--min": "Lets you view the events without the event message",
                            "--page <page#>": "Lets you select a page of events to view"
                        }
                    },
                    {
                        action: "Delete",
                        actionDesc: "Delete an event.",
                        usage: ";event delete <eventName>",
                        args: {}
                    },
                    {
                        action: "Trigger",
                        actionDesc: "Trigger an event in the specified channel, leaves the event alone.",
                        usage: ";event trigger <eventName>",
                        args: {}
                    },
                    {
                        action: "Edit",
                        actionDesc: "Edit a pre-existing event",
                        usage: ";event edit <eventName> <field> <changeTo>",
                        args: {
                            "eventName": "The name of the event you want to edit",
                            "field": "The field you want to change. Choose from one of the following:\n `name, time, date, message, channel, countdown, repeat, repeatday`.",
                            "changeTo": "What you want to change that field to."
                        }
                    }
                ]
            },

            // Faction Command
            COMMAND_FACTION_MISSING_FACTION: "Missing faction",
            COMMAND_FACTION_INVALID_FACTION: "Invalid faction",
            COMMAND_FACTION_CODE_OUT: (searchName, charString) => `# Characters in the ${searchName} faction # \n${charString}`,
            COMMAND_FACTION_USAGE: "Usage is `/faction faction: <faction>`",
            COMMAND_FACTION_HELP: {
                description: "Shows the list of characters in the specified faction.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "faction <faction> [-leader] [-zeta]",
                        args: {
                            "faction": "The faction you want to see the roster of.",
                            "-leader": "Limit the results to characters who have a leader ability",
                            "-zeta": "Limit the results to characters who can have abilities zetad"
                        }
                    },
                    {
                        action: "Player Faction",
                        actionDesc: "See how a player's faction is shaping up",
                        usage: "faction <user> <faction> [-leader] [-zeta]",
                        args: {
                            "user": "A way to identify the player. (mention | allyCode | me)",
                            "faction": "The faction you want to see the roster of.",
                            "-leader": "Limit the results to characters who have a leader ability",
                            "-zeta": "Limit the results to characters who can have abilities zetad"
                        }
                    }
                ]
            },

            // Farm Command
            COMMAND_FARM_LOCATIONS: " farm locations",
            COMMAND_FARM_MISSING_CHARACTER: "Missing character",
            COMMAND_FARM_HARD: "Hard ",
            COMMAND_FARM_LIGHT: "Light Side ",
            COMMAND_FARM_DARK: "Dark Side ",
            COMMAND_FARM_FLEET: "Fleet ",
            COMMAND_FARM_CANTINA: "Cantina ",
            COMMAND_FARM_ENERGY_PER: " energy per attempt",
            COMMAND_FARM_CHAR_UNAVAILABLE: "Looks like that character is not currently farmable, or only available through an event.",
            COMMAND_FARM_EVENT_CHARS: {
                // Heroes Journey
                "REYJEDITRAINING": "Rey's Hero's Journey event",
                "COMMANDERLUKESKYWALKER": "Luke Skywalker Hero's Journey event",
                "JEDIKNIGHTREVAN": "Legend of the Old Republic event",

                // Legendary events
                "CHEWBACCALEGENDARY": "One Famous Wookiee event",
                "R2D2_LEGENDARY": "Daring Droid event",
                "GRANDADMIRALTHRAWN": "Artist of War event",
                "C3POLEGENDARY": "Contact Protocol event",
                "GRANDMASTERYODA": "Grandmaster's Training event",
                "BB8": "Pieces and Plans event",
                "EMPERORPALPATINE": "Emperor's Demise event",

                // TB Rewards
                "IMPERIALPROBEDROID": "Dark Side TB (Special Mission)",
                "HOTHLEIA": "Light Side TB (Special Mission)"
            },
            COMMAND_FARM_HELP: {
                description: "Shows a list of available farming locations for characters.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "farm <character>",
                        args: {
                            "character": "The character you want to see the shard locations for."
                        }
                    }
                ]
            },

            // Grand Arena Command
            COMMAND_GRANDARENA_INVALID_USER: (userNum) => `Invalid user ${userNum}`,
            COMMAND_GRANDARENA_UNREGISTERED: "In order to use the `me` keyword, you need to have an allycode registered with the bot.\nCheck out `/register` or `/userconf`",
            COMMAND_GRANDARENA_INVALID_CHAR: (char) => `Could not find a match for "${char}"`,
            COMMAND_GRANDARENA_COMP_NAMES: {
                charGP: "Char GP",
                shipGP: "Ship GP",
                cArena: "C Arena",
                sArena: "S Arena",
                zetas: "Zetas",
                omicrons: "Omicrons",
                twOmicrons: "TW Omicrons",
                relics: "Relic",
                star6: "6 Star",
                star7: "7 Star",
                g11: "Gear 11",
                g12: "Gear 12",
                g13: "Gear 13",
                "mods6": "6*  Mods",
                "spd10": "10+  Spd",
                "spd15": "15+  Spd",
                "spd20": "20+  Spd",
                "spd25": "25+  Spd",
                "off100": "100+ Off",
                "level": "Lvl",
                "gearLvl": "Gear",
                "starLvl": "Star",
                "speed": "Spd"
            },
            COMMAND_GRANDARENA_EXTRAS_HEADER:"Extras",
            COMMAND_GRANDARENA_EXTRAS: (extraCount) => `There are ${extraCount} more characters that matched your search, but could not be shown.`,
            COMMAND_GRANDARENA_OUT_HEADER: (p1, p2) => `Grand Arena ${p1} vs ${p2}`,
            COMMAND_GRANDARENA_OUT_DESC: (overview, modOverview) => `**Stats:**${overview}**Mod Stats:**${modOverview}`,
            COMMAND_GRANDARENA_HELP: {
                description: "Compares 2 players for Grand Arena.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";grandarena <user1> <user2> [-faction faction] [character1] | [character2] | ...",
                        args: {
                            "users": "A way to identify the user. (mention | allyCode | me)",
                            "characters": "A list of characters (Separated by the | symbol).",
                            "-faction": "A faction you want to show."
                        }
                    }
                ]
            },

            // Guilds Command
            COMMAND_GUILDS_MORE_INFO: "For more info on a specific guild:",
            COMMAND_GUILDS_NO_GUILD: "I cannot find that guild.",
            COMMAND_GUILDS_PLEASE_WAIT: "Please wait while I update your guild's info.",
            COMMAND_GUILDS_USERS_IN_GUILD: (users, guild) => `${users} Players in ${guild}`,
            COMMAND_GUILDS_GUILD_GP_HEADER: "Registered Guild GP",
            COMMAND_GUILDS_GUILD_GP: (total, average) => `Total GP: ${total}\nAverage : ${average}`,
            COMMAND_GUILDS_DESC: "Guild Description",
            COMMAND_GUILDS_MSG: "Chat Announcement",
            COMMAND_GUILDS_REG_NEEDED: "I can't find a guild for that user. Please make sure the ally code is correct.",
            COMMAND_GUILDS_ROSTER_HEADER: (ix, len) => `Roster (${ix}/${len})`,
            COMMAND_GUILDS_RAID_STRINGS: {
                header:              "Raids",
                rancor:              "Rancor:      ",
                rancor_challenge:    "Chal Rancor: ",
                aat:                 "AAT:         ",
                sith_raid:           "Sith:        ",
                heroic:              "Heroic"
            },
            COMMAND_GUILDS_STAT_HEADER: "Stats",
            COMMAND_GUILDS_STAT_STRINGS: (members, lvl, gp, charGP, shipGP) => [
                `Members:      ${members}/50`,
                `Required Lvl: ${lvl}`,
                `Est. char gp: ${charGP}`,
                `Est. ship gp: ${shipGP}`,
                `Total GP:     ${gp}`
            ].join("\n"),
            COMMAND_GUILDS_FOOTER: "`/guilds roster` for a list of your guild members and their gp.\n`/guilds roster show_allycode: true` for a list with their ally codes instead.",
            COMMAND_GUILDS_TWS_HEADER: (guildName) => `${guildName}'s Territory War Summary`,
            COMMAND_GUILDS_HELP: {
                description: "Shows everyone that's in your guild/ some basic stats.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";guild [user]\n;guild [user] [-roster] [-sort] [-reg]\n;guild [user] [-roster] [-allycode] [-reg]\n;guild -relic\n;guild -tickets [allycode] [-sort tickets]",
                        args: {
                            "user": "A way to identify the guild. (mention | allyCode | guildName)",
                            "-roster": "Show a list of all the members of the guild",
                            "-allycode": "Show a member's ally codes instead of GP",
                            "-sort": "Choose either name, rank, or gp to sort by. Also able to sort by tickets for the tickets check",
                            "-reg": "Show the discord names of anyone registered & on the server next to their name.",
                            "-relics:": "See the top relic/ gear tiers that your guild members have",
                            "-tickets": "Show how many raid tickets each member has earned so far"
                        }
                    },
                    {
                        action: "Territory War Summary",
                        actionDesc: "Show a general overview of some important characters for the specified guild",
                        usage: ";guild [user] -twsummary",
                        args: {
                            "user": "A way to identify the guild. (mention | allyCode | guildName)",
                            "-twsummary": "To tell it to show the summary  (-tw)"
                        }
                    }
                ]
            },

            // GuildSearch Command
            COMMAND_GUILDSEARCH_SHIP_STATS: "Sorry, but I cannot get the stats for ships at this time.",
            COMMAND_GUILDSEARCH_CONFLICTING: (args) => `You have conflicting arguments, the following are not compatible with each other. ${args}`,
            COMMAND_GUILDSEARCH_GEAR_SUM: "Char Gear Summary",
            COMMAND_GUILDSEARCH_CHAR_STAR_SUM: "Char Star Lvl Summary",
            COMMAND_GUILDSEARCH_SHIP_STAR_SUM: "Ship Star Lvl Summary",
            COMMAND_GUILDSEARCH_INVALID_SORT: (opts) => `Invalid sort. Try one of these: \`${opts}\``,
            COMMAND_GUILDSEARCH_BAD_STAR: "You can only choose a star level from 1-7",
            COMMAND_GUILDSEARCH_BAD_SORT: (sortType, filters) => `Sorry, but \`${sortType}\` is not a supported sorting method. Only \`${filters.join(", ")}\` supported.`,
            COMMAND_GUILDSEARCH_MISSING_CHAR: "You need to enter a character to check for",
            COMMAND_GUILDSEARCH_NO_RESULTS: (character) => `I did not find any results for ${character}`,
            COMMAND_GUILDSEARCH_CHAR_LIST: (chars) => `Your search came up with too many results, please be more specific. \nHere's a list of the close matches.\n\`\`\`asciidoc\n${chars}\`\`\``,
            COMMAND_GUILDSEARCH_NO_CHAR_STAR: (starLvl) => `No one in your guild seems to have this character at ${starLvl} stars.`,
            COMMAND_GUILDSEARCH_NO_CHAR: "No one in your guild seems to have this character.",
            COMMAND_GUILDSEARCH_NOT_ACTIVATED: (count) => `Not Activated (${count})`,
            COMMAND_GUILDSEARCH_STAR_HEADER: (star, count) => `${star} Star (${count})`,
            COMMAND_GUILDSEARCH_PLEASE_WAIT: "Please wait while I search your guild's roster.",
            COMMAND_GUILDSEARCH_NO_CHARACTER: "It seems that no one in your guild has this character unlocked.",
            COMMAND_GUILDSEARCH_NO_SHIP: "It seems that no one in your guild has this ship unlocked.",
            COMMAND_GUILDSEARCH_NO_CHARACTER_STAR: (star) => `It seems that no one in your guild has this character unlocked at ${star}* or higher.`,
            COMMAND_GUILDSEARCH_NO_SHIP_STAR: (star) => `It seems that no one in your guild has this ship unlocked at ${star}* or higher.`,
            COMMAND_GUILDSEARCH_NO_ZETAS: "It looks like no one in your guild has applied any zetas to this character.",
            COMMAND_GUILDSEARCH_SORTED_BY: (char, sort, doReverse) => `${char} (Sorted by ${doReverse ? `lowest ${sort} first` : sort})`,
            COMMAND_GUILDSEARCH_MODS_HEADER: (guildName) => `${guildName}'s mods`,
            COMMAND_GUILDSEARCH_HELP: {
                description: "Shows the star level of the selected character for everyone in the guild.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";guildsearch [user] <character> [-zetas] [-ships] [-reverse] [-sort type] [-top X] [starLvl]",
                        args: {
                            "user": "The player who's guild you want to check. (me | userID | mention)",
                            "character": "The character you want to search for.",
                            "-ships": "Search for ships, you can use `-s, -ship, or -ships`",
                            "-reverse": "Reverse the chosen sort",
                            "-sort": "Choose either name, gear, or gp to sort by",
                            "-top X": "Show just the top X results, where X is between 0 and 50",
                            "-zetas": "Show only characters with zetas equipped",
                            "starLvl": "Select the star level you want to see."
                        }
                    },
                    {
                        action: "Stat comparison",
                        actionDesc: "Compare stats for a character across your entire guild",
                        usage: ";guildsearch [user] <character> -stats <stat>",
                        args: {
                            "user": "The player who's guild you want to check. (me | userID | mention)",
                            "character": "The character you want to search for.",
                            "stat": "One of the character's stats from below ```Health, Protection, Speed, Potency, PhysicalCriticalChance, SpecialCriticalChance, CriticalDamage, Tenacity, Accuracy, Armor, Resistance```"
                        }
                    },
                    {
                        action: "Mods overview",
                        actionDesc: "Compare some of the more important mods across your entire guild",
                        usage: ";guildsearch [user] [-sort sortBy] -mods",
                        args: {
                            "user": "The player who's guild you want to check. (me | userID | mention)",
                            "-mods": "Tell it you want to see the mods. (-m | -mod)",
                            "-sort": "Sort by either speed, offense, or 6 (for 6* mods)"
                        }
                    },
                    {
                        action: "Gear overview",
                        actionDesc: "Compare the count of upper gear levels across your entire guild",
                        usage: ";guildsearch [user] -gear [-sort gearLvl]",
                        args: {
                            "user": "The player who's guild you want to check. (me | userID | mention)",
                            "-gear": "Display gear tiers for your guild. (-g)",
                            "-sort": "Choose one of the given gear lvls (9,10,11,12) to sort by"
                        }
                    },
                    {
                        action: "Character Star overview",
                        actionDesc: "Compare the count of upper star levels across your entire guild",
                        usage: ";guildsearch [user] -stars [-sort starLvl] [-ship]",
                        args: {
                            "user": "The player who's guild you want to check. (me | userID | mention)",
                            "-stars": "Tell it you want to see the star levels (-star | -*)",
                            "-sort": "Choose one of the given star lvls (10,11,12) to sort by",
                            "-ship": "Show the star count for ships instead of characters (-s | -ship | -ships)"
                        }
                    },
                ]
            },

            // Guild Update Command
            COMMAND_GUILDUPDATE_HELP: {
                description: "Modify and view the settings for the guild update watcher.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: [
                            ";guildupdate allycode <allycode>",
                            ";guildupdate channel <channelMention>",
                            ";guildupdate enabled <on|off>",
                        ].join("\n"),
                        args: {
                            "allycode": "The ally code it will check against for your guild",
                            "channelMention": "Select which channel to output logs to",
                            "enabled": "Toggle this on and off",
                        }
                    }
                ]
            },

            // Help Command (Disabled/ not converted to slash command)
            // COMMAND_HELP_HEADER: (prefix) => `= Command List =\n\n[Use ${prefix}help <commandname> for details]\n`,
            // COMMAND_HELP_OUTPUT: (command, prefix) => `= ${command.help.name} = \n${command.help.description} \nAliases:: ${command.conf.aliases.join(", ")}\nUsage:: ${prefix}${command.help.usage}`,
            // COMMAND_HELP_HELP: {
            //     description: "Displays info about available commands.",
            //     actions: [
            //         {
            //             action: "",
            //             actionDesc: "",
            //             usage: ";help [command]",
            //             args: {
            //                 "command": "The command you want to look up info on."
            //             }
            //         }
            //     ]
            // },

            // Info Command
            COMMAND_INFO_OUTPUT: (shardID) => ({
                "header"      : "== Bot Information ==",
                "shardHeader"      : `== Bot Information [${shardID}] ==`,
                "statHeader"  : "== Bot Stats ==",
                "users"       : "Users",
                "servers"     : "Servers",
                "discordVer"  : "Discord.js",
                "nodeVer"     : "Node",
                "swgohHeader" : "== SWGoH Stats ==",
                "players"     : "Players",
                "guilds"      : "Guilds",
                "lang"        : "Languages",
                "links": {
                    "Add me to your server": "- http://swgohbot.com/invite",
                    "Join SWGoHBot HQ": "- https://discord.gg/FfwGvhr",
                    "Support the Bot": "- [Github](https://github.com/jmiln/SWGoHBot)\n- [Patreon](https://www.patreon.com/swgohbot)\n- [PayPal](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=YY3B9BS298KYW)"
                }
            }),
            COMMAND_INFO_HELP: {
                description: "Shows useful info pertaining to the bot.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "info",
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
            COMMAND_MODS_NEED_CHARACTER: "Need a character. Usage is `/mods character: <characterName>`",
            COMMAND_MODS_INVALID_CHARACTER_HEADER: "Invalid character",
            COMMAND_MODS_USAGE: "Usage is `/mods character: <characterName>`",
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
                        actionDesc: "",
                        usage: "mods <character>",
                        args: {
                            "character": "The character you want to show the mods for"
                        }
                    }
                ]
            },

            // Modsets command
            COMMAND_MODSETS_OUTPUT: "* Critical Chance:  2\n* Critical Damage:  4\n* Defense:  2\n* Health:   2\n* Offense:  4\n* Potency:  2\n* Speed:    4\n* Tenacity: 2",
            COMMAND_MODSETS_HELP: {
                description: "Shows how many of each kind of mod you need for a set.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "modsets",
                        args: {}
                    }
                ]
            },

            // MyArena Command
            COMMAND_MYARENA_NO_USER: (user) => `Sorry, but I can't find any arena data for ${user}. Please make sure that account is synced`,
            COMMAND_MYARENA_NO_CHAR: "Something went wrong, I could not get your characters.",
            COMMAND_MYARENA_ARENA: (rank) => `Char Arena (Rank: ${rank})`,
            COMMAND_MYARENA_FLEET: (rank) => `Ship Arena (Rank: ${rank})`,
            COMMAND_MYARENA_EMBED_HEADER: (playerName) => `${playerName}'s Arena`,
            COMMAND_MYARENA_EMBED_FOOTER: (date) => `Arena data as of: ${date}`,
            COMMAND_MYARENA_HELP: {
                description: "Show user's current arena ranks and their squads.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";myarena [user]",
                        args: {
                            "user": "The person you're checking. (me | userID | mention)"
                        }
                    }
                ]
            },

            // MyCharacter Command
            COMMAND_MYCHARACTER_ABILITIES: "Abilities",
            COMMAND_MYCHARACTER_HELP: ({
                description: "Shows the general stats about the selected character.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";mycharacter [user] <character>\n;mycharacter [user] <character> -s",
                        args: {
                            "user": "The person you're checking. (me | userID | mention)",
                            "character": "The character you want to search for.",
                            "-s": "Make sure it's looking for a ship (You can use the pilot to search this way)"
                        }
                    }
                ]
            }),

            // MyMods Command
            COMMAND_MYMODS_NO_MODS: (charName) => `Sorry, but I couldn't find any mods for your ${charName}`,
            COMMAND_MYMODS_MISSING_MODS: "Sorry, but I can't find your mods right now. Please wait a bit then try again.",
            COMMAND_MYMODS_LAST_UPDATED: (lastUpdated) => `Mods last updated: ${lastUpdated} ago`,
            COMMAND_MYMODS_WAIT: "Please wait while I check your roster.",
            COMMAND_MYMODS_BAD_STAT: (stats) => `Sorry, but I can only sort by the following stats: ${stats}`,
            COMMAND_MYMODS_HEADER_TOTAL: (name, stat) => `${name}'s Highest ${stat} Characters`,
            COMMAND_MYMODS_HEADER_MODS: (name, stat) => `${name}'s Best ${stat} From Mods`,
            COMMAND_MYMODS_HELP: ({
                description: "Shows the mods that you have equipped on the selected character.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";mymods [user] <character>",
                        args: {
                            "user": "The person you're checking. (me | userID | mention)",
                            "character": "The character you want to search for."
                        }
                    },
                    {
                        action: "Best stats",
                        actionDesc: "See your top 10 best characters based on stats",
                        usage: ";mymods -best <filter>\n;mymods -total -best <filter>",
                        args: {
                            "-best": "See what the best stats are (-b)",
                            "-total": "Sort by total stats instead of mod boosts (-t)",
                            "filter": "One of the character's stats you want to see"
                        }
                    }
                ]
            }),

            // MyProfile Command
            COMMAND_MYPROFILE_NO_USER: (user) => `Sorry, but I can't find any arena data for ${user}. Please make sure that account is synced`,
            COMMAND_MYPROFILE_EMBED_HEADER: (playerName, allyCode) => `${playerName}'s profile (${allyCode})`,
            COMMAND_MYPROFILE_EMBED_FOOTER: (date) => `Arena data as of: ${date}`,
            COMMAND_MYPROFILE_DESC: (guildName, level, charRank, shipRank, gpFull) => `**Guild:** ${guildName}\n**Level:** ${level}\n**Arena rank:** ${charRank}\n**Ship rank:** ${shipRank}\n**Total GP:** ${gpFull}`,
            COMMAND_MYPROFILE_RARITY_HEADER: "Rarity",
            COMMAND_MYPROFILE_RELIC_HEADER: "Relics",
            COMMAND_MYPROFILE_MODS: (mods) => ({
                header: "Mod Overview",
                modStrs: [
                    `6* Mods  :: ${mods.sixPip}`,
                    `Spd 15+  :: ${mods.spd15}`,
                    `Spd 20+  :: ${mods.spd20}`,
                    `Off 100+ :: ${mods.off100}`
                ].join("\n")
            }),
            COMMAND_MYPROFILE_CHARS: (gpChar, charList, zetaCount, relicCount, omicronCount) => ({
                header: `Characters (${charList.length})`,
                stats: [
                    `Char GP  :: ${gpChar}`,
                    `7 Star   :: ${charList.filter(c => c.rarity === 7).length}`,
                    `lvl 85   :: ${charList.filter(c => c.level === 85).length}`,
                    `Gear 11  :: ${charList.filter(c => c.gear === 11).length}`,
                    `Gear 12  :: ${charList.filter(c => c.gear === 12).length}`,
                    `Gear 13  :: ${charList.filter(c => c.gear === 13).length}`,
                    `Relic 7+ :: ${relicCount ?  Object.keys(relicCount).reduce((acc, curr) => (parseInt(curr, 10) >= 7 ? relicCount[curr] : 0) + acc, 0): 0}`,
                    `Zetas    :: ${zetaCount}`,
                    `Omicrons :: ${omicronCount}`
                ].join("\n")
            }),
            COMMAND_MYPROFILE_SHIPS: (gpShip, shipList) => ({
                header: `Ships (${shipList.length})`,
                stats: [
                    `Ship GP :: ${gpShip}`,
                    `7 Star  :: ${shipList.filter(s => s.rarity === 7).length}`,
                    `lvl 85  :: ${shipList.filter(s => s.level === 85).length}`
                ].join("\n")
            }),
            COMMAND_MYPROFILE_HELP: {
                description: "Show user's general stats.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";myprofile [user]",
                        args: {
                            "user": "The person you're checking. (me | userID | mention)"
                        }
                    }
                ]
            },

            // Need Command
            COMMAND_NEED_MISSING_USER: "In order to use this command, you must either register or enter an ally code.",
            COMMAND_NEED_MISSING_SEARCH: (search) => `Cannot find any matches for ${search}`,
            COMMAND_NEED_CHAR_HEADER: "__Characters:__",
            COMMAND_NEED_SHIP_HEADER: "__Ships:__",
            COMMAND_NEED_COMPLETE: "You've got everything there, congratulations!",
            COMMAND_NEED_ALL_CHAR: "Congrats, you have all the characters at 7*",
            COMMAND_NEED_ALL_SHIP: "Congrats, you have all the ships at 7*",
            COMMAND_NEED_PARTIAL: (percent) => `You're about **${percent}%** complete.`,
            COMMAND_NEED_HEADER: (player, search) => `${player}'s needs for ${search}`,
            COMMAND_NEED_HELP: {
                description: "Shows your progress towards 7* characters from a faction or shop.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";need [user] <faction|shop|battle|keyword>",
                        args: {
                            "user": "The person you're checking. (me | userID | mention)",
                            "faction | shop": "The faction or shop you want to see your completeness of",
                            "keyword": "One of the keywords shown below"
                        }
                    },
                    {
                        action: "Shops",
                        actionDesc: "",
                        args: {
                            "arena":   "Arena shop",
                            "cantina": "Cantina shop",
                            "fleet":   "Fleet shop",
                            "guild":   "Guild shop",
                            "gw":      "Galactic War shop",
                            "shard":   "Shard shop"
                        }
                    },
                    {
                        action: "Battles",
                        actionDesc: "",
                        args: {
                            "Light battles":   "Light side hard battles",
                            "Dark battles":    "Dark side hard battles",
                            "Cantina battles": "Cantina battles",
                            "Fleet battles":   "Fleet battles"
                        }
                    },
                    {
                        action: "Keywords",
                        actionDesc: "",
                        args: {
                            "battles": "This will show the characters you're missing from all the various battle nodes.",
                            "shops":   "This will show you anything you're missing from all of the stores.",
                            "*":       "This will show you everything that you're missing."
                        }
                    }
                ]
            },

            // Nickname Command
            COMMAND_NICKNAME_SUCCESS: "I have changed my nickname.",
            COMMAND_NICKNAME_FAILURE: "Sorry, but I don't have permission to change that.",
            COMMAND_NICKNAME_TOO_LONG: "Sorry, but a name can only contain up to 32 characters.",
            COMMAND_NICKNAME_HELP: {
                description: "Changes the bot's nickname on the server.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";nickname <name>",
                        args: {
                            "name": "The name you're wanting to change it to. Leave it blank to reset it to default."
                        }
                    }
                ]
            },

            // Polls Command
            COMMAND_POLL_NO_ARG: "You need to provide either an option to vote on, or an action (create/view/etc).",
            COMMAND_POLL_TITLE_TOO_LONG: "Sorry, but your title/ question must be fewer than 256 characters.",
            COMMAND_POLL_ALREADY_RUNNING: "Sorry, but you can only run one poll at a time. Please end the current one first.",
            COMMAND_POLL_MISSING_QUESTION: "You need to specify something to vote on.",
            COMMAND_POLL_TOO_FEW_OPT: "You need to have at least 2 options to vote on.",
            COMMAND_POLL_TOO_MANY_OPT: "You can only have up to 10 options to vote on.",
            COMMAND_POLL_CREATED: (name) => `**${name}** has started a new poll:\nVote with \`/poll vote: <choice>\`\n`,
            COMMAND_POLL_CREATED_SLASH: (name) => `**${name}** has started a new poll:\nVote with \`/poll vote <choice>\`\n`,
            COMMAND_POLL_NO_POLL: "There is no poll in progress",
            COMMAND_POLL_FINAL: (poll) => `Final results for ${poll}`,
            COMMAND_POLL_FINAL_ERROR: (question) => `I couldn't delete **${question}**, please try again.`,
            COMMAND_POLL_INVALID_OPTION: "That is not a valid option.",
            COMMAND_POLL_SAME_OPT: (opt) => `You have already chosen **${opt}**`,
            COMMAND_POLL_CHANGED_OPT: (oldOpt, newOpt) => `You have changed your choice from **${oldOpt}** to **${newOpt}**`,
            COMMAND_POLL_REGISTERED: (opt) => `Choice for **${opt}** registered`,
            COMMAND_POLL_CHOICE: (opt, optCount, choice) => `\`[${opt}]\` ${choice}: **${optCount} vote${optCount === 1 ? "" : "s"}**\n`,
            COMMAND_POLL_FOOTER: (id) => `Poll id: ${id}  -  \`/poll vote <choice>\` to vote`,
            COMMAND_POLL_HELP: {
                description: "Lets you start a poll with multiple options.",
                actions: [
                    {
                        action: "Create",
                        actionDesc: "Create a new poll",
                        usage: ";poll create [-anonymous] <question> | <opt1> | <opt2> | [...] | [opt10]",
                        args: {
                            "question": "The question that you're wanting feedback on.",
                            "opt": "The options that people can choose from.",
                            "-anonymous": "If this flag is included, the current votes will not be shown until the poll is closed. (-anon)"
                        }
                    },
                    {
                        action: "Vote",
                        actionDesc: "Vote on the option that you choose",
                        usage: ";poll <choice>",
                        args: {
                            "choice": "The option that you choose."
                        }
                    },
                    {
                        action: "View",
                        actionDesc: "See what the channel's current poll and it's options are.",
                        usage: ";poll view",
                        args: {}
                    },
                    {
                        action: "Close",
                        actionDesc: "End the channel's current poll and show the final tally.",
                        usage: ";poll close",
                        args: {}
                    },
                    {
                        action: "Remote View/ Vote",
                        actionDesc: "Vote on or view a poll from outside the channel it's linked to.",
                        usage: ";poll view -poll <poll> \n;poll vote <choice> -poll <poll>\n;poll me",
                        args: {
                            "pollID": "The ID of the poll you want to interact with",
                            "choice": "The option that you choose.",
                            "me": "This will send you the current options to vote on, and an an example you can copy/ paste to vote"
                        }
                    }
                ]
            },

            // RaidDamage Command
            COMMAND_RAIDDAMAGE_DMG: "damage",
            COMMAND_RAIDDAMAGE_MISSING_RAID: "Missing Raid",
            COMMAND_RAIDDAMAGE_INVALID_RAID: "Invalid Raid",
            COMMAND_RAIDDAMAGE_RAID_STR: (raids) => `Please select one of the following raids:\n\`${raids}\``,
            COMMAND_RAIDDAMAGE_MISSING_PHASE: "Missing Phase",
            COMMAND_RAIDDAMAGE_INVALID_PHASE: "Invalid Phase",
            COMMAND_RAIDDAMAGE_PHASE_STR: (raid, phases) => `Please select one of the following phases for the ${raid} raid:\n${phases}`,
            COMMAND_RAIDDAMAGE_MISSING_AMT: "Missing Amount",
            COMMAND_RAIDDAMAGE_INVALID_AMT: "Invalid Amount",
            COMMAND_RAIDDAMAGE_AMOUNT_STR: "You need to enter either a number or percent to convert the damage to or from",
            COMMAND_RAIDDAMAGE_OUT_HEADER: (raidName, phaseName) => `${raidName} raid, ${phaseName}`,
            COMMAND_RAIDDAMAGE_OUT_DMG: (inAmt, outAmt) => `**${inAmt} is about ${outAmt} of the boss' hp**`,
            COMMAND_RAIDDAMAGE_OUT_PERCENT: (inAmt, outAmt) => `**${inAmt} is about ${outAmt}**`,
            COMMAND_RAIDDAMAGE_OUT_STR: (inAmt, outAmt, phase, raid) => `${inAmt} is about ${outAmt} during ${phase} of the ${raid} raid.`,
            COMMAND_RAIDDAMAGE_HELP: {
                description: "Convert damage percent or amount to the other",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";raiddamage <raid> <phase> <damage>",
                        args: {
                            "raid": "The raid that you want to see teams for. (aat|pit|sith)",
                            "phase": "The phase of the raid you want to see. (p1|p2|p3|p4|solo)",
                            "damage": "The amount of damage you want to convert. (Ex: 40000 or 35%)"
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
                        actionDesc: "",
                        usage: ";randomchar [user] [numberOfChars] [-star X]",
                        args: {
                            "user": "The user's roster you want it to choose from. (me | userID | mention)",
                            "numberOfChars": "The number of characters that you want chosen",
                            "-star X": "Choose the min star lvl of character that you want chosen, where X is the lvl."
                        }
                    }
                ]
            },

            // Register Command
            COMMAND_REGISTER_MISSING_ALLY: "You need to enter an ally code to link your account to.",
            COMMAND_REGISTER_INVALID_ALLY: (allyCode) => `Sorry, but ${allyCode} is not a valid ally code`,
            COMMAND_REGISTER_ALREADY_REGISTERED: "This is already your registered ally code!",
            COMMAND_REGISTER_ADD_NO_SERVER: "You can only add users that are in your server.",
            COMMAND_REGISTER_PLEASE_WAIT: "Please wait while I sync your data.",
            COMMAND_REGISTER_FAILURE: "Registration failed, please make sure your ally code is correct.",
            COMMAND_REGISTER_SUCCESS_HEADER: (user) => `Registration for ${user} successful!`,
            COMMAND_REGISTER_SUCCESS_DESC: (user, allyCode, gp) => [
                `Allycode :: ${allyCode}`,
                user.guildName ? `Guild    :: ${user.guildName || "N/A"}` : "",
                gp ? `GP       :: ${gp}` : "",
                user.level ? `Level    :: ${user.level}` : ""
            ].join("\n"),
            COMMAND_REGISTER_HELP: {
                description: "Register your ally code to your Discord ID, and sync your SWGoH profile.",
                actions: [
                    {
                        action: "",
                        actionDesc: "Link your Discord profile to a SWGoH account",
                        usage: ";register [user] <allyCode>",
                        args: {
                            "user": "The person you're adding. (userID | mention)",
                            "allyCode": "Your ally code from in-game."
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
                        actionDesc: "",
                        usage: ";reload <command>",
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
                        actionDesc: "",
                        usage: ";reloaddata <option>",
                        args: {
                            "option": "What you're wanting to reload ( commands | data | events | function )."
                        }
                    }
                ]
            },

            // Resources Command
            COMMAND_RESOURCES_HEADER: "SWGoH Resources",
            COMMAND_RESOURCES_INVALID_CATEGORY: (list) => `Invalid category. Please choose from one of these: \`${list}\``,
            COMMAND_RESOURCES_HELP: {
                description: "Shows useful SWGoH resources.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";resources <category>",
                        args: {
                            "category": "One of the available categories. (Bots, Game Changers, Websites)"
                        }
                    }
                ]
            },

            // Setconf Command
            COMMAND_SETCONF_MISSING_PERMS: "Sorry, but either you're not an admin, or your server leader has not set up the configs.",
            COMMAND_SETCONF_MISSING_OPTION: "You must select a config option to change.",
            COMMAND_SETCONF_MISSING_VALUE: "You must give a value to change that option to.",
            COMMAND_SETCONF_ARRAY_MISSING_OPT: "You must use `add` or `remove`.",
            COMMAND_SETCONF_ARRAY_NOT_IN_CONFIG: (key, value) => `Sorry, but \`${value}\` is not set in \`${key}\`.`,
            COMMAND_SETCONF_ARRAY_SUCCESS: (key, value, action) => `\`${value}\` has been ${action} your \`${key}\`.`,
            COMMAND_SETCONF_NO_KEY: "This key is not in the configuration. Look in '/showconf'",
            COMMAND_SETCONF_UPDATE_SUCCESS: (key, value) => `Guild configuration item ${key} has been changed to:\n\`${value}\``,
            COMMAND_SETCONF_NO_SETTINGS: "No guild settings found.",

            COMMAND_SETCONF_ADMINROLE_NEED_ROLE: (opt) => `You must specify a role to ${opt}.`,
            COMMAND_SETCONF_ADMINROLE_MISSING_ROLE: (roleName) => `Sorry, but I cannot find the role ${roleName}. Please try again.`,
            COMMAND_SETCONF_ADMINROLE_ROLE_EXISTS: (roleName) => `Sorry, but ${roleName} is already there.`,
            COMMAND_SETCONF_WELCOME_NEED_CHAN: "Sorry, but but your announcement channel either isn't set or is no longer valid.\nGo set `announceChan` to a valid channel and try again.`",
            COMMAND_SETCONF_TIMEZONE_NEED_ZONE: "Invalid timezone, look here https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \nand find the one that you need, then enter what it says in the TZ column",
            COMMAND_SETCONF_ANNOUNCECHAN_NEED_CHAN: (chanName) => `Sorry, but I cannot find the channel ${chanName}. Please try again.`,
            COMMAND_SETCONF_ANNOUNCECHAN_NO_PERMS: "Sorry, but I don't have permission to send message there. Please either change the perms, or choose another channel.",
            COMMAND_SETCONF_INVALID_LANG: (value, langList) => `Sorry, but ${value} is not a currently supported language. \nCurrently supported languages are: \`${langList}\``,
            COMMAND_SETCONF_INVALID_WEBHOOK: "Sorry, but that's not a valid webhook url. Copy the one that Discord gives you when you set it up",
            COMMAND_SETCONF_RESET: "Your config has been reset",
            COMMAND_SETCONF_HELP: {
                description: "Used to set the bot's config settings.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";setconf <key> <value>",
                        args: {}
                    },
                    {
                        action: "adminRole",
                        actionDesc: "The role that you want to be able to modify bot settings or set up events",
                        usage: ";setconf adminRole <add|remove> <role>",
                        args: {
                            "add":  "Add a role to the list",
                            "remove": "Remove a role from the list"
                        }
                    },
                    {
                        action: "enableWelcome",
                        actionDesc: "Toggles the welcome message on/ off.",
                        usage: ";setconf enableWelcome <true|false>",
                        args: {}
                    },
                    {
                        action: "welcomeMessage",
                        actionDesc: "The welcome message to send if you have it enabled (Special variables below)",
                        usage: ";setconf welcomeMessage <message>",
                        args: {
                            "{{user}}":  "gets replaced with the new user's name.",
                            "{{userMention}}": "makes it mention the new user there."
                        }
                    },
                    {
                        action: "enablePart",
                        actionDesc: "Toggles the parting message on/ off.",
                        usage: ";setconf enablePart <true|false>",
                        args: {}
                    },
                    {
                        action: "partMessage",
                        actionDesc: "The part message to send if you have it enabled (Special variables below)",
                        usage: ";setconf partMessage <message>",
                        args: {
                            "{{user}}":  "gets replaced with the new user's name.",
                        }
                    },
                    {
                        action: "useEmbeds",
                        actionDesc: "Toggles whether or not to use embeds as the output for some commands.",
                        usage: ";setconf useEmbeds <true|false>",
                        args: {}
                    },
                    {
                        action: "timezone",
                        actionDesc: "Sets the timezone that you want all time related commands to use. Look here if you need a list https://goo.gl/Vqwe49.",
                        usage: ";setconf timezone <timezone>",
                        args: {}
                    },
                    {
                        action: "announceChan",
                        actionDesc: "Sets the name of your announcements channel for events etc. Make sure it has permission to send them there.",
                        usage: ";setconf announceChan <channelName>",
                        args: {}
                    },
                    {
                        action: "useEventPages",
                        actionDesc: "Sets it so event view shows in pages, rather than super spammy.",
                        usage: ";setconf useEventPages <true|false>",
                        args: {}
                    },
                    {
                        action: "eventCountdown",
                        actionDesc: "The time that you want a countdown message to appear",
                        usage: ";setconf eventCountdown <add|remove> <time>",
                        args: {
                            "add":  "Add a time to the list",
                            "remove": "Remove a time from the list"
                        }
                    },
                    {
                        action: "language",
                        actionDesc: "Set the bot to use any supported language for the command output.",
                        usage: ";setconf language <lang>",
                        args: {}
                    },
                    {
                        action: "swgohLanguage",
                        actionDesc: "Sets the bot to use any supported language for the game data output.",
                        usage: ";setconf swgohLanguage <lang>",
                        args: {}
                    },
                    {
                        action: "shardtimeVertical",
                        actionDesc: "Set the shardtimes output to show in vertical or horizontal lists.",
                        usage: ";setconf shardtimeVertical <true|false>",
                        args: {}
                    },
                    {
                        action: "changelogWebhook",
                        actionDesc: "Set up a webhook for the bot to send changelogs to. Use with no link to remove the configured link",
                        usage: ";setconf changelogWebhook [link]",
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
            COMMAND_SHARDTIMES_MISSING_USER: "I need a user, please enter \"me\", mention someone here, or input their Discord ID.",
            COMMAND_SHARDTIMES_MISSING_ROLE: "Sorry, but you can only add yourself unless you have an admin role.",
            COMMAND_SHARDTIMES_INVALID_USER: "Invalid user, please enter \"me\", mention someone here, or input their discord ID.",
            COMMAND_SHARDTIMES_MISSING_TIMEZONE: "You need to enter a timezone.",
            COMMAND_SHARDTIMES_INVALID_TIMEZONE: "Invalid timezone, look here https://en.wikipedia.org/wiki/List_of_tz_database_time_zones \nand find the one that you need, then enter what it says in the TZ column",
            COMMAND_SHARDTIMES_INVALID_TIME_TIL: "Invalid time until your payout, it must be in the format of `00:00`, so if you have **13** minutes until your payout, you'd enter `00:13`",
            COMMAND_SHARDTIMES_USER_ADDED: "User successfully added!",
            COMMAND_SHARDTIMES_USER_MOVED: (from, to) => `Updated user from ${from} to ${to}.`,
            COMMAND_SHARDTIMES_USER_NOT_ADDED: "Something went wrong when with adding this user. Please try again.",
            COMMAND_SHARDTIMES_REM_MISSING_PERMS: "Sorry, but you can only remove yourself unless you have an admin role.",
            COMMAND_SHARDTIMES_REM_SUCCESS: "User successfully removed!",
            COMMAND_SHARDTIMES_REM_FAIL: "Something went wrong when removing this user. Please try again.",
            COMMAND_SHARDTIMES_REM_MISSING: "Sorry, but that user does not seem to be here.",
            COMMAND_SHARDTIMES_COPY_NO_SOURCE: "This channel doesn't have any shard times to copy from.",
            COMMAND_SHARDTIMES_COPY_NO_DEST: (input) => `Cannot find a match for \`${input}\``,
            COMMAND_SHARDTIMES_COPY_NO_PERMS: (inChan) => `I don't have permission to view/send messages in <#${inChan}>`,
            COMMAND_SHARDTIMES_COPY_SAME_CHAN: "You can't copy to/from the same channel",
            COMMAND_SHARDTIMES_COPY_DEST_FULL: "Sorry, but the destination channel already has some shard info listed",
            COMMAND_SHARDTIMES_COPY_BROKE: "Something broke while trying to copy your shard settings. Please try again",
            COMMAND_SHARDTIMES_COPY_SUCCESS: (dest) => `Shard info copied to <#${dest}>`,
            COMMAND_SHARDTIMES_SHARD_HEADER: "Shard payouts in:",
            COMMAND_SHARDTIMES_HELP: {
                description: "Lists the time until the payouts of anyone registered.",
                actions: [
                    {
                        action: "Add",
                        actionDesc: "Add a user to the shard tracker",
                        usage: ";shardtimes add <user> <timezone> [flag/emoji]\n;shardtimes add <user> <-timeuntil 00:00> [flag/emoji]",
                        args: {
                            "user": "The person you're adding. (me | userID | mention)",
                            "timezone": "The zone that your account is based in, Use this list:\n https://en.wikipedia.org/wiki/List_of_tz_database_time_zones",
                            "flag/emoji": "An optional emoji if you want it to show by your name",
                            "-timeuntil": "If you want to just list the time remaining until your payout"
                        }
                    },
                    {
                        action: "Remove",
                        actionDesc: "Remove a user from the tracker",
                        usage: ";shardtimes remove <user>",
                        args: {
                            "user": "The person you're removing. (me | userID | mention)"
                        }
                    },
                    {
                        action: "Copy",
                        actionDesc: "Copy the list of times from one channel to another",
                        usage: ";shardtimes copy <newChannel>",
                        args: {
                            "newChannel": "The channel you want to copy the times to"
                        }
                    },
                    {
                        action: "View",
                        actionDesc: "Look at all the tracked times for you and your shardmates",
                        usage: ";shardtimes view",
                        args: {
                            "-ships": "View the times for fleet payout instead (-ship | -s)"
                        }
                    }
                ]
            },

            // Ships Command
            COMMAND_SHIPS_NEED_CHARACTER: "Need a character or ship. Usage is `/ships ship: <ship|pilot>`",
            COMMAND_SHIPS_INVALID_CHARACTER:  "Invalid character or ship. Usage is `/ship ship: <ship|pilot>`",
            COMMAND_SHIPS_TOO_MANY: "I found more than one result from that search. Please try to be more specific.",
            COMMAND_SHIPS_CREW: "Crew",
            COMMAND_SHIPS_FACTIONS: "Factions",
            COMMAND_SHIPS_ABILITIES: (abilities) => `**Ability Type:** ${abilities.type}   **Ability Cooldown:** ${abilities.abilityCooldown} \n${abilities.abilityDesc}`,
            COMMAND_SHIPS_CODE_ABILITES_HEADER: " * Abilities *\n",
            COMMAND_SHIPS_CODE_ABILITIES: (abilityName, abilities) => `### ${abilityName} ###\nAbility Type: ${abilities.type}   Ability Cooldown: ${abilities.abilityCooldown}\n${abilities.abilityDesc}\n\n`,
            COMMAND_SHIPS_HELP: {
                description: "Shows info about the selected ship.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: "ship <ship|pilot>",
                        args: {
                            "ship|pilot": "The ship or pilot for the ship you want info on."
                        }
                    }
                ]
            },

            // Showconf Command
            COMMAND_SHOWCONF_OUTPUT: (configKeys, serverName) => `The following is the current configuration for ${serverName}: \`\`\`asciidoc\n\n${configKeys.replace(/_/g, "＿")}\`\`\``,
            COMMAND_SHOWCONF_HELP: {
                description: "Shows the current configs for your server.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";showconf",
                        args: {}
                    }
                ]
            },

            // Squads Command
            COMMAND_SQUADS_NO_LIST: (list) => `Please select a category from the following list: \n\`${list}\``,
            COMMAND_SQUADS_SHOW_LIST: (name, list) => `Within ${name}, please chose the number corresponding with the phase you want to see: \n${list}`,
            COMMAND_SQUADS_FIELD_HEADER: "Squads/ Characters",
            COMMAND_SQUAD_INVALID_PHASE: (list) => `Invalid phase number, please choose from the following: \n${list}`,
            COMMAND_SQUADS_HELP: {
                description: "Shows characters/ squads that are useful for various events.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";squads [user] <event> <phaseNum>",
                        args: {
                            "user": "The person you're looking up. (me | userID | mention)",
                            "event": "The event that you want to see teams for. (aat|pit|sith|etc.)",
                            "phase": "The number associated with the phase you want to see"
                        }
                    }
                ]
            },

            // Test command (in .gitignore)
            COMMAND_TEST_HELP: {
                description: "A command to test things out.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";test",
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
                        actionDesc: "",
                        usage: ";time [timezone]",
                        args: {
                            "timezone": "Optional if you want to see what time it is elsewhere"
                        }
                    }
                ]
            },

            // Updatechar Command
            COMMAND_UPDATECHAR_INVALID_OPT: (arg, usableArgs) => `Sorry, but ${arg} isn't a valid argument. Try one of these: ${usableArgs}`,
            COMMAND_UPDATECHAR_NEED_CHAR: "You need to specify a character to update.",
            COMMAND_UPDATECHAR_WRONG_CHAR: (charName) => `Sorry, but your search for '${charName}' did not find any results. Please try again.`,
            COMMAND_UPDATECHAR_HELP: {
                description: "Update the info on a specified character.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";updatechar [gear|info|mods] [charater]",
                        args: {
                            "gear": "Update the gear for the character.",
                            "info": "Update the info for the character (Image link, abilities etc.)",
                            "mods": "Update the mods from crouchingrancor.com"
                        }
                    }
                ]
            },

            // UserConf
            COMMAND_USERCONF_CANNOT_VIEW_OTHER: "Sorry, but you cannot view other's configs",
            COMMAND_USERCONF_ALLYCODE_ALREADY_REGISTERED: "You already have this ally code registered",
            COMMAND_USERCONF_ALLYCODE_REMOVED_SUCCESS: (name, ac) => `Removed ${name} (${ac}) from your config`,
            COMMAND_USERCONF_ALLYCODE_TOO_MANY: "Sorry, but you cannot have more than 10 accounts registered.",
            COMMAND_USERCONF_ALLYCODE_NOT_REGISTERED: "You do not have this ally code registered",
            COMMAND_USERCONF_ALLYCODE_ALREADY_PRIMARY: "That ally code is already marked as the primary one.",
            COMMAND_USERCONF_ALLYCODE_NEW_PRIMARY: (oldName, oldAC, newName, newAC) => `Changed your primary from **${oldName}**(${oldAC}) to **${newName}**(${newAC})`,
            COMMAND_USERCONF_DEFAULTS_CMD_NO_FLAGS: (name) => `${name} does not have any flags to set the defaults for.`,
            COMMAND_USERCONF_DEFAULTS_INVALID_CMD: (name) => `Sorry, but ${name} is not currently supported for this.`,
            COMMAND_USERCONF_DEFAULTS_SET_DEFAULTS: (name, flags) => `Set the default flags for ${name} to \`${flags}\``,
            COMMAND_USERCONF_DEFAULTS_NO_DEFAULTS: (name) => `You do not have any defaults set for ${name}.`,
            COMMAND_USERCONF_DEFAULTS_CLEARED: (name) => `Cleared the default flags for ${name}.`,
            COMMAND_USERCONF_VIEW_NO_CONFIG: "Looks like you've not set up any personal config settings yet. Check out the options for `/userconf`",
            COMMAND_USERCONF_VIEW_ALLYCODES_HEADER: "Ally Codes",
            COMMAND_USERCONF_VIEW_ALLYCODES_PRIMARY: "__Primary is **BOLD**__\n",
            COMMAND_USERCONF_VIEW_ALLYCODES_NO_AC: "No linked ally codes.",
            COMMAND_USERCONF_VIEW_DEFAULTS_HEADER: "Defaults",
            COMMAND_USERCONF_VIEW_DEFAULTS_NO_DEF: "Set default flags for your commands.",
            COMMAND_USERCONF_VIEW_ARENA_HEADER: "Arena Rank DMs",
            COMMAND_USERCONF_VIEW_ARENA_DM: "DM for rank drops",
            COMMAND_USERCONF_VIEW_ARENA_SHOW: "Show for Arena",
            COMMAND_USERCONF_VIEW_ARENA_WARNING: "Payout warning",
            COMMAND_USERCONF_VIEW_ARENA_RESULT: "Payout result alert",
            COMMAND_USERCONF_VIEW_LANG_HEADER: "Language Settings",
            COMMAND_USERCONF_ARENA_PATREON_ONLY: "Sorry, but this feature is only available as a thank you to supporters through https://www.patreon.com/swgohbot",
            COMMAND_USERCONF_ARENA_MISSING_DM: "Missing option. Try all/primary/off.",
            COMMAND_USERCONF_ARENA_INVALID_DM: "Invalid option. Try all/primary/off.",
            COMMAND_USERCONF_ARENA_MISSING_ARENA: "Missing arena, you need to chose one of the following: `char, fleet, both`",
            COMMAND_USERCONF_ARENA_INVALID_ARENA: "Invalid arena, you need to chose one of the following: `char, fleet, both`",
            COMMAND_USERCONF_ARENA_MISSING_WARNING: "Missing number, try `0` to turn it off, or a number of minutes that you want it to warn you ahead of time.",
            COMMAND_USERCONF_ARENA_INVALID_WARNING: "Invalid number, try `0` to turn it off, or a number of minutes that you want it to warn you ahead of time.",
            COMMAND_USERCONF_ARENA_INVALID_NUMBER: "Invalid number, your number needs to be between 0 (turns it off), and 1440 (one day).",
            COMMAND_USERCONF_ARENA_INVALID_OPTION: "Try one of these: `enableDMs, arena, payoutResult, payoutWarning`",
            COMMAND_USERCONF_ARENA_INVALID_BOOL: "Invalid option. Try `yes/no`, `true/false` or `on/off`",
            COMMAND_USERCONF_ARENA_UPDATED: "Your settings have been updated.",
            COMMAND_USERCONF_LANG_UPDATED: (type, newLang) => `Your ${type} setting has been updated to ${newLang}`,
            COMMAND_USERCONF_HELP: {
                description: "All the needed utilities to manage your info in the bot.",
                actions: [
                    {
                        action: "View",
                        actionDesc: "Show what your current settings are.",
                        usage: ";userconf view",
                        args: { }
                    },
                    {
                        action: "Ally Code",
                        actionDesc: "Set your ally code(s) to be able to use for the other commands",
                        usage: ";userconf allycode <add|remove|makeprimary> <allycode>",
                        args: {
                            "add": "Add an ally code to your profile",
                            "remove": "Remove an ally code from your profile",
                            "makePrimary": "Make the selected ally code your primary one. (The one that will be used when you use `me` in a command)"
                        }
                    },
                    {
                        action: "Arena Alert",
                        actionDesc: "Set alerts to DM when your rank drops and other arena related stuff.",
                        usage: [
                            ";userconf arenaAlert enableDMs <all|primary|off>",
                            ";userconf arenaAlert arena <both|fleet|char>",
                            ";userconf arenaAlert payoutResult <on|off>",
                            ";userconf arenaAlert payoutWarning <0-1439>"
                        ].join("\n"),
                        args: {
                            "enableDMs": "Turn on DM alerts for just your primary allycode, all allycodes, or none",
                            "arena": "Choose which arena's alerts you want",
                            "payoutResult": "Send you a DM with your final payout result",
                            "payoutWarning": "Send you a DM the set number of min before your payout. 0 to turn it off."
                        }
                    },
                    {
                        action: "Languages",
                        actionDesc: "Set personal localization settings",
                        usage: [
                            ";userconf lang language <langChoice>",
                            ";userconf lang swgohLanguage <langChoice>"
                        ].join("\n"),
                        args: {
                            langChoice: ["The language you want to choose.",
                                `**Language options:** ${langList.join(", ")}`,
                                `**SwgohLanguage options:** ${swgohLangList.join(", ")}`
                            ].join("\n")
                        }
                    }
                ]
            },

            // Versus Command
            COMMAND_VERSUS_HELP: {
                description: "Compare a character from two players",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";versus [user1] [user2] <character>",
                        args: {
                            "user": "The user(s) you want to compare the characters for.",
                            "character": "The character that you want to compare."
                        }
                    }
                ]
            },

            // Whois command
            COMMAND_WHOIS_HELP: {
                description: "Find ally codes from a given name.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";whois <name>",
                        args: {
                            "name": "The name you want to find the ally code for"
                        }
                    }
                ]
            },

            // Zetas Command
            COMMAND_ZETA_NO_USER: "Sorry, but I don't have that user listed anywhere.",
            COMMAND_ZETA_NO_ZETAS: "You don't seem to have any abilities zetad.",
            COMMAND_ZETA_OUT_DESC: `\`${"-".repeat(30)}\`\n\`[L]\` Leader | \`[S]\` Special | \`[U]\` Unique\n\`${"-".repeat(30)}\``,
            COMMAND_ZETA_MORE_INFO: "`;zeta <character>` for more info.",
            COMMAND_ZETA_REC_BAD_FILTER: (filters) => `Invalid filter, please try one of \`${filters}\``,
            COMMAND_ZETA_REC_HEADER: "Available filters:",
            COMMAND_ZETA_REC_AUTH: (zetaLen, pName) => `Top ${zetaLen}zetas for ${pName}`,
            COMMAND_ZETA_CONFLICTING_FLAGS: "Sorry, but you cannot use the -r and -g flags together.",
            COMMAND_ZETA_WAIT_GUILD: "Please wait while I look through your guild's zetas",
            COMMAND_ZETA_ZETAS_HEADER: (name, count) => `${name}'s Zetas (${count})`,
            COMMAND_ZETA_GUILD_HEADER: (name) => `${name}'s Zetas'`,
            COMMAND_ZETA_GUILD_CHAR_HEADER: (name) => `${name}'s Zetas'`,
            COMMAND_ZETAS_HELP: {
                description: "Show the abilities that you have put zetas on.",
                actions: [
                    {
                        action: "",
                        actionDesc: "",
                        usage: ";zeta [user]",
                        args: {
                            "user": "The person you're checking. (me | userID | mention)"
                        }
                    },
                    {
                        action: "Recommend",
                        actionDesc: "See some recommended zetas for various parts of the game",
                        usage: ";zeta -r [-h] [user] [filter]",
                        args: {
                            "-h": "Tell it to only give you 7* characters. (Ex. If you want to only look for characters viable for a heroic raid)",
                            "user": "The person you're checking. (me | userID | mention)",
                            "filter": "See ranked zetas according to one of the filters"
                        }
                    },
                    {
                        action: "Guild",
                        actionDesc: "See overall zetas for your guild, or per-character (WARNING: This can be really spammy)",
                        usage: ";zeta -g [user] [character]",
                        args: {
                            "user": "The person's guild that you're checking. (me | userID | mention)",
                            "character": "The character that you want to see the guild's zetas for"
                        }
                    }
                ]
            }
        };
    }
};
