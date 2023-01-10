module.exports = {
    // Administrative commands
    Admin: {
        description: "Commands with limited access",
        commands: {
            event:         "Manage scheduled messages (Events).",
            setconf:       "Change bot settings for this server.",
            showconf:      "Display bot settings for this server.",
        }
    },
    // Commands that use in-game data
    Gamedata: {
        description: "Commands that pull data from the game",
        commands: {
            charactergear: "Display the gear needed for a character.",
            grandarena:    "Display a comparison some general stats between two allycodes.",
            guilds:        "Display a guild's stats/ roster based on an allycode.",
            guildsearch:   "Display counts of a guild's character roster-wide.",
            guildtickets:  "Display how many people still have less than 600 tickets.",
            myarena:       "Display your current arena rank & your arena rosters.",
            mycharacter:   "Display info about a selected character in your roster.",
            mymods:        "Display the mods equipped to a certain character/ general mod stats for your roster.",
            myprofile:     "Display an overview of your in-game profile's stats.",
            need:          "Display which units you still need to work on based on a shop or location.",
            randomchar:    "Pick random characters out of your roster.",
            register:      "Link your Discord account to an allycode. (First allycode only)",
            territorywar:  "Display stats comparing 2 guilds.",
            versus:        "Compare stats of a character between two user's rosters.",
            zetas:         "Display the zetas that a user has."
        }
    },
    // General commands that aren't linked to anything special
    General: {
        description: "General commands",
        commands: {
            acronyms:      "Display the meaning of a selected acronym if available.",
            activities:    "Display the guild activities for a selected day.",
            arenarank:     "Check how far you can get from your starting rank.",
            botshards:     "Display info on the Bot's shards (Ping, servers, status)",
            challenges:    "Display the day's challenges.",
            character:     "Show the abilities for a character, and the resources needed to max out each one.",
            faction:       "Display a list of everyone in a selected faction.",
            farm:          "Display the locations you are able to farm the selected character.",
            help:          "Display this list of the available commands.",
            info:          "Display some basic info about the bot.",
            mods:          "Display a suggested mod loadout for a selected character. Based on swgoh.gg top 100.",
            modsets:       "Display how many mods you need for each set type.",
            poll:          "Set up or interact with a poll.",
            raiddamage:    "Display how much damage you have to do per % of health for raid bosses.",
            shardtimes:    "Display how long you have until each linked user's payout.",
            ships:         "Display abilities for the selected ship.",
            time:          "Display what time it is for the server's configured timezone, or any other.",
            userconf:      "Change your personal settings.",
            whois:         "Search for a user's allycode by name. (Only checks users registered with the bot)",
        }
    },
    // Patreon only Commands
    Patreon: {
        description: "Patreon commands *https://www.patreon.com/swgohbot*",
        commands: {
            arenaalert:    "Set up the bot to DM you when your fleet and/ or character arena ranks change.",
            arenawatch:    "Set up the bot to send a message to a channel any time someone in your list of selected allycodes changes rank",
            guildupdate:   "Set up the bot to send messages every hour to a channel, showing changes in guild member's rosters.",
        }
    },
};
