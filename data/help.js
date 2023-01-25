module.exports = {
    // Administrative commands
    Admin: {
        description: "Commands with limited access",
        commands: {
            event: {
                desc: "Manage scheduled messages (Events).",
                usage: [
                    "**create** <name> <day> <time> [message]",
                    "  [repeat] [repeatday] [channel] [countdown]",
                    "**createjson** <json>",
                    "**delete** <name>",
                    "**edit** <event_name> [name] [day] [time] ",
                    "  [message] [repeat] [repeatday]",
                    "  [channel] [countdown]",
                    "**trigger** <name>",
                    "**view** [name] [filter] [page]",
                ]
            },
            setconf: {
                desc: "Change bot settings for this server.",
                usage: [
                    "**add** [admin_role] [event_countdown]",
                    "**remove** [admin_role] [event_countdown]",
                    "**set** [enable_welcome] [welcome_message]",
                    "  [enable_part] [part_message] [timezone]",
                    "  [announce_chan] [use_event_pages]",
                    "  [language] [swgoh_language]",
                    "  [shardtime_vertical]"
                ]
            },
            showconf: {
                desc: "Display bot settings for this server.",
                usage: [
                    "**/showconf**"
                ]
            },
        }
    },
    // Commands that use in-game data
    Gamedata: {
        description: "Commands that pull data from the game",
        commands: {
            charactergear: {
                desc: "Display the gear needed for a character.",
                usage: [
                    "**/charactergear** <character>"
                ]
            },
            grandarena: {
                desc: "Display a comparison some general stats between two allycodes.",
                usage: [
                    "**/grandarena** <allycode_1> <allycode_2>",
                    "  [characters] [faction]"
                ]
            },
            guilds: {
                desc: "Display a guild's stats/ roster based on an allycode.",
                usage: [
                    "**gear** [allycode] [sort]",
                    "**mods** [allycode] [sort]",
                    "**relics** [allycode]",
                    "**roster** [allycode] [registered]",
                    "  [show_allycode] [sort] [show_side]",
                    "  [split_types]",
                    "**tickets** [allycode] [sort]",
                    "**twsummary** [allycode] [expand]",
                    "**view** [allycode]"
                ]
            },
            guildsearch: {
                desc: "Display counts of a guild's character roster-wide.",
                usage: [
                    "**character** <character> [allycode]",
                    "  [sort] [stat] [top] [rarity] [reverse]",
                    "  [omicrons] [zetas]",
                    "**ship** <ship> [allycode] [sort]",
                    "  [top] [rarity] [reverse]",
                ]
            },
            myarena: {
                desc: "Display your current arena rank & your arena rosters.",
                usage: [
                    "**/myarena** [allycode] [stats]"
                ]
            },
            mycharacter: {
                desc: "Display info about a selected character in your roster.",
                usage: [
                    "**character** <character>",
                    "**ship** <ship>",
                ]
            },
            mymods: {
                desc: "Display the mods equipped to a certain character/ general mod stats for your roster.",
                usage: [
                    "**best** <stat> [allycode]",
                    "**bestmods** <stat> [allycode] [totale]",
                    "**character** <character> [allycode]",
                ]
            },
            myprofile: {
                desc: "Display an overview of your in-game profile's stats.",
                usage: [
                    "**/myprofile**"
                ]
            },
            need: {
                desc: "Display which units you still need to work on based on a shop or location.",
                usage: [
                    "**/need** [allycode] [battle]",
                    "  [keyword] [shop] [faction]"
                ]
            },
            randomchar: {
                desc: "Pick random characters out of your roster.",
                usage: [
                    "**/randomchar** [allycode] [rarity] [count]"
                ]
            },
            register: {
                desc: "Link your Discord account to an allycode. (First allycode only)",
                usage: [
                    "**/register** <allycode> [user]"
                ]
            },
            territorywar: {
                desc: "Display stats comparing 2 guilds.",
                usage: [
                    "**/territorywar** <allycode_1> <allycode_2>"
                ]
            },
            versus: {
                desc: "Compare stats of a character between two user's rosters.",
                usage: [
                    "**/versus** <allycode_1> <allycode_2> <character>"
                ]
            },
            zetas: {
                desc: "Display the zetas that a user has.",
                usage: [
                    "**guild** <allycode> [character]",
                    "**player** <allycode> [character]",
                ]
            }
        }
    },
    // General commands that aren't linked to anything special
    General: {
        description: "General commands",
        commands: {
            acronyms: {
                desc: "Display the meaning of a selected acronym if available.",
                usage: [
                    "**acronyms** <acronym>"
                ]
            },
            activities: {
                desc: "Display the guild activities for a selected day.",
                usage: [
                    "**activities** [day]"
                ]
            },
            arenarank: {
                desc: "Check how far you can get from your starting rank.",
                usage: [
                    "**/arenarank** <rank>"
                ]
            },
            botshards: {
                desc: "Display info on the Bot's shards (Ping, servers, status)",
                usage: [
                    "**/botshards**"
                ]
            },
            challenges: {
                desc: "Display the day's challenges.",
                usage: [
                    "**challenges** [day]"
                ]
            },
            character: {
                desc: "Show the abilities for a character, and the resources needed to max out each one.",
                usage: [
                    "**/character** <character>"
                ]
            },
            faction: {
                desc: "Display a list of everyone in a selected faction.",
                usage: [
                    "**/faction** <faction> [allycode] [leader] [zeta]"
                ]
            },
            farm: {
                desc: "Display the locations you are able to farm the selected character.",
                usage: [
                    "**/farm** <character>"
                ]
            },
            help: {
                desc: "Display this list of the available commands.",
                usage: [
                    "**/help**"
                ]
            },
            info: {
                desc: "Display some basic info about the bot.",
                usage: [
                    "**/info**"
                ]
            },
            mods: {
                desc: "Display a suggested mod loadout for a selected character. Based on swgoh.gg top 100.",
                usage: [
                    "**/mods** <character>"
                ]
            },
            modsets: {
                desc: "Display how many mods you need for each set type.",
                usage: [
                    "**/modsets**"
                ]
            },
            poll: {
                desc: "Set up or interact with a poll.",
                usage: [
                    "**cancel**",
                    "**create** <question> <options> [anonymous]",
                    "**end**",
                    "**view**",
                    "**vote** <option>",
                ]
            },
            raiddamage: {
                desc: "Display how much damage you have to do per % of health for raid bosses.",
                usage: [
                    "**/raiddamage** <raid> <phase> <amount>"
                ]
            },
            shardtimes: {
                desc: "Display how long you have until each linked user's payout.",
                usage: [
                    "**add** <user> [timezone]",
                    "  [time_until] [flag]",
                    "**copy** <dest_channel>",
                    "**remove** <user>",
                    "**view** [ships]"
                ]
            },
            ships: {
                desc: "Display abilities for the selected ship.",
                usage: [
                    "**/ships** <ship>"
                ]
            },
            time: {
                desc: "Display what time it is for the server's configured timezone, or any other.",
                usage: [
                    "**/time** [timezone]"
                ]
            },
            userconf: {
                desc: "Change your personal settings.",
                usage: [
                    "**allycodes add** <allycode>",
                    "**allycodes make_primary** <allycode>",
                    "**allycodes remove** <allycode>",
                    "**arenaalert** [enable_dms] [arena]",
                    "  [payout_result] [payout_warning]",
                    "**lang** [bot_language] [swgoh_language]",
                    "**view**"
                ]
            },
            whois: {
                desc: "Search for a user's allycode by name. (Only checks users registered with the bot)",
                usage: [
                    "**/whois** <name>"
                ]
            },
        }
    },
    // Patreon only Commands
    Patreon: {
        description: "Patreon commands *https://www.patreon.com/swgohbot*",
        commands: {
            arenaalert: {
                desc: "Set up the bot to DM you when your fleet and/ or character arena ranks change.",
                usage: [
                    "**/arenaalert** [enable_dms] [arena]",
                    "  [payout_result] [payout_warning]",
                ]
            },
            arenawatch: {
                desc: "Set up the bot to send a message to a channel whenever someone in your list of allycodes moves up or down in rank",
                usage: [
                    "**allycodes add** <allycode>",
                    "**allycodes edit** <allycode>",
                    "**allycodes remove** <allycode>",
                    "**arena** <enabled> <arena>",
                    "**channel** <target_channel> <arena>",
                    "**enabled** <toggle>",
                    "**payout channel** <target_channel> <arena>",
                    "**payout enable** <enabled> <arena>",
                    "**payout mark** <allycode> <mark>",
                    "**report** <arena>",
                    "**result** <allycode> <arena>",
                    "**showvs** <enable>",
                    "**use_marks_in_log** <enable>",
                    "**view** [allycode]",
                    "**warn** <allycode> <mins> <arena>",
                ]
            },
            guildtickets: {
                desc: "Set up the bot to send an updated list of who doesn't have the daily 600 tickets",
                usage: [
                    "**set** [enabled] [channel] [sortby] [allycode]",
                    "**view**",
                ]
            },
            guildupdate: {
                desc: "Set up the bot to send messages every hour to a channel, showing changes in guild member's rosters.",
                usage: [
                    "**set** [enabled] [channel] [allycode]",
                    "**view**",
                ]
            },
            patreon: {
                desc: "See benefits/ commands available via Patreon, or check on your current tier info",
                usage: [
                    "**/patreon**",
                    "**/patreon** details <Commands|Benefits|my_info>"
                ]
            },
        }
    },
};
