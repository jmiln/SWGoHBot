module.exports = {
    tiers: {
        0: {    // The default non-subscriber times
            name: "default",
            benefits: null,
            playerTime: 2*60,   // 2hr
            guildTime:  6*60,   // 6hr
        },
        1: {
            name: "Youngling",
            benefits : {
                ArenaAlert  : "Enable the ArenaAlert command to watch your primary registered account for arena drops",
                ArenaWatch  : "Enable ArenaWatch and it's payout monitor for 1 allycode",
                GuildTickets: "Enable the GuildTickets command & monitor",
                GuildUpdate : "Enable the GuildUpdate command & monitors"
            },
            playerTime: 1*60,   // 1hr
            guildTime:  3*60,   // 3hr

            // Share the cooldown from prev tier with guild (The base non-sub tier)
            sharePlayer: 2*60,  // 2hr
            shareGuild:  6*60,  // 6hr

            // Arena watch account slots
            awAccounts: 1,
        },
        5: {
            name: "Padawan",
            benefits: {
                ArenaAlert: "Enable ArenaAlert to watch all registered accounts for arena drops",
                ArenaWatch: "Enable ArenaWatch and it's payout monitor for up to 20 allycodes",
                Cooldowns:  "Enable sharing cooldowns of the previous tier with a selected Discord server"
            },
            playerTime: 5,    // 5min
            guildTime:  10,   // 10min

            // Share the cooldown from prev ($1) tier with guild
            sharePlayer: 1*60,  // 1hr
            shareGuild:  3*60,  // 3hr

            // Arena watch account slots
            awAccounts: 20,
        },
        10: {
            name: "Jedi Knight",
            benefits: {
                ArenaWatch: "Enable ArenaWatch and it's payout monitor for up to 50 allycodes",
                Cooldowns:  "Enable sharing cooldowns of the previous tier with a selected Discord server"
            },
            playerTime: 1,    // 1min
            guildTime:  1,    // 1min

            // Share the cooldown from prev ($5) tier with guild
            sharePlayer: 5,   // 5min
            shareGuild:  10,  // 10min

            // Arena watch account slots
            awAccounts: 50,
        }
    },
    commands: {
        "Arena Alert"  : "Get DMs when your registered accounts' arena rank changes",
        "Arena Watch"  : "Watch up to 50 ally codes for arena rank changes & payouts, and log them to a channel",
        "Guild Updates": "The bot will check every hour and log Gear/ Relic, Level, and Ability changes in each member's roster",
        "Guild Tickets": "Watch each guild member & keep a log of who has not hit the daily 600 tickets",
    }
};
