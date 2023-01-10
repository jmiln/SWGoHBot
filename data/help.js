module.exports = {
    // Administrative commands
    Admin: {
        description: "Commands with limited access",
        commands: {
            event: {
                desc: "Manage scheduled messages (Events)."
            },
            setconf: {
                desc: "Change bot settings for this server."
            },
            showconf: {
                desc: "Display bot settings for this server."
            },
        }
    },
    // Commands that use in-game data
    Gamedata: {
        description: "Commands that pull data from the game",
        commands: {
            charactergear: {
                desc: "Display the gear needed for a character."
            },
            grandarena: {
                desc: "Display a comparison some general stats between two allycodes."
            },
            guilds: {
                desc: "Display a guild's stats/ roster based on an allycode."
            },
            guildsearch: {
                desc: "Display counts of a guild's character roster-wide."
            },
            guildtickets: {
                desc: "Display how many people still have less than 600 tickets."
            },
            myarena: {
                desc: "Display your current arena rank & your arena rosters."
            },
            mycharacter: {
                desc: "Display info about a selected character in your roster."
            },
            mymods: {
                desc: "Display the mods equipped to a certain character/ general mod stats for your roster."
            },
            myprofile: {
                desc: "Display an overview of your in-game profile's stats."
            },
            need: {
                desc: "Display which units you still need to work on based on a shop or location."
            },
            randomchar: {
                desc: "Pick random characters out of your roster."
            },
            register: {
                desc: "Link your Discord account to an allycode. (First allycode only)"
            },
            territorywar: {
                desc: "Display stats comparing 2 guilds."
            },
            versus: {
                desc: "Compare stats of a character between two user's rosters."
            },
            zetas: {
                desc: "Display the zetas that a user has."
            }
        }
    },
    // General commands that aren't linked to anything special
    General: {
        description: "General commands",
        commands: {
            acronyms: {
                desc: "Display the meaning of a selected acronym if available."
            },
            activities: {
                desc: "Display the guild activities for a selected day."
            },
            arenarank: {
                desc: "Check how far you can get from your starting rank."
            },
            botshards: {
                desc: "Display info on the Bot's shards (Ping, servers, status)"
            },
            challenges: {
                desc: "Display the day's challenges."
            },
            character: {
                desc: "Show the abilities for a character, and the resources needed to max out each one."
            },
            faction: {
                desc: "Display a list of everyone in a selected faction."
            },
            farm: {
                desc: "Display the locations you are able to farm the selected character."
            },
            help: {
                desc: "Display this list of the available commands."
            },
            info: {
                desc: "Display some basic info about the bot."
            },
            mods: {
                desc: "Display a suggested mod loadout for a selected character. Based on swgoh.gg top 100."
            },
            modsets: {
                desc: "Display how many mods you need for each set type."
            },
            poll: {
                desc: "Set up or interact with a poll."
            },
            raiddamage: {
                desc: "Display how much damage you have to do per % of health for raid bosses."
            },
            shardtimes: {
                desc: "Display how long you have until each linked user's payout."
            },
            ships: {
                desc: "Display abilities for the selected ship."
            },
            time: {
                desc: "Display what time it is for the server's configured timezone, or any other."
            },
            userconf: {
                desc: "Change your personal settings."
            },
            whois: {
                desc: "Search for a user's allycode by name. (Only checks users registered with the bot)"
            },
        }
    },
    // Patreon only Commands
    Patreon: {
        description: "Patreon commands *https://www.patreon.com/swgohbot*",
        commands: {
            arenaalert: {
                desc: "Set up the bot to DM you when your fleet and/ or character arena ranks change."
            },
            arenawatch: {
                desc: "Set up the bot to send a message to a channel any time someone in your list of selected allycodes changes rank"
            },
            guildupdate: {
                desc: "Set up the bot to send messages every hour to a channel, showing changes in guild member's rosters."
            },
        }
    },
};
