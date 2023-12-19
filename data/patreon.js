module.exports = {
    tiers: {
        1: {
            name: "Youngling",
            benefits : {
                ArenaAlert: "Enable the ArenaAlert command to watch your primary registered account for arena drops",
                ArenaWatch: "Enable ArenaWatch and it's payout monitor for 1 allycode",
                GuildTickets: "Enable the GuildTickets command & monitor",
                GuildUpdate: "Enable the GuildUpdate command & monitors"
            },
            playerTime: 1*60,   // 1hr
            guildTime:  6*60,   // 6hr
            awAccounts: 1,
        },
        5: {
            name: "Padawan",
            benefits: {
                ArenaAlert: "Enable ArenaAlert to watch all registered accounts for arena drops",
                ArenaWatch: "Enable ArenaWatch and it's payout monitor for up to 20 allycodes"
            },
            playerTime: 1*60,   // 1hr
            guildTime:  3*60,   // 3hr
            awAccounts: 20,
        },
        10: {
            name: "Jedi Knight",
            benefits: {
                ArenaWatch: "Enable ArenaWatch and it's payout monitor for up to 50 allycodes"
            },
            playerTime: 10,   // 10min
            guildTime:  30,   // 30min
            awAccounts: 50,
        }
    },
    commands: {
        "Arena Alert"  : "Get DMs when your registered accounts' arena rank changes",
        "Arena Watch"  : "Watch up to 50 ally codes for arena rank changes & payouts, and log them to a channel",
        "Guild Updates": "The bot will check every hour and log any changes in each member's roster",
        "Guild Tickets": "Watch each guild member & keep a log of who has not hit the daily 600 tickets",
    }
};
