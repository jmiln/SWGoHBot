module.exports = {
    // The main invite for the support server
    invite: "https://discord.com/invite/FfwGvhr",

    // Time chunks, in milliseconds
    //             ms    sec  min  hr
    dayMS: 1000 * 60 * 60 * 24,
    hrMS:  1000 * 60 * 60,
    minMS: 1000 * 60,
    secMS: 1000,

    // Zero width space
    zws: "\u200B",

    // Some normal color codes
    colors: {
        black:     0,
        blue:      255,
        lightblue: 22015,
        green:     65280,
        red:       16711680,
        brightred: 14685204,
        white:     16777215,
        yellow:    16776960,
    },
    // Permissions mapping
    permMap: {
        // Can do anything, access to the dev commands, etc
        BOT_OWNER: 10,

        // Can help out with the bot as needed, some extra stuff possibly
        HELPER: 8,

        // Owner of the server a command is being run in
        GUILD_OWNER: 7,

        // Has ADMIN or MANAGE_GUILD, or has one of the
        // configured roles from the guild's settings
        GUILD_ADMIN: 6,

        // Base users, anyone that's not included above
        BASE_USER: 0
    },
    OmicronMode: [
        "OmicronMode_DEFAULT",
        "ALLOMICRON",
        "PVEOMICRON",
        "PVPOMICRON",
        "GUILDRAIDOMICRON",
        "TERRITORYSTRIKEOMICRON",       // Huh?
        "TERRITORYCOVERTOMICRON",       // Huh?
        "TERRITORYBATTLEBOTHOMICRON",
        "TERRITORYWAROMICRON",
        "TERRITORYTOURNAMENTOMICRON",   // Huh?
        "WAROMICRON0",                  // Idk
        "CONQUESTOMICRON1",
        "GALACTICCHALLENGEOMICRON2",
        "PVEEVENTOMICRON3",
        "TERRITORYTOURNAMENT3OMICRON4", // Who knows
        "TERRITORYTOURNAMENT5OMICRON5"  // Who knows
    ]
};
