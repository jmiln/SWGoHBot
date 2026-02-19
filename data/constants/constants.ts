import { GatewayIntentBits, Partials } from "discord.js";

export default {
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

    emotes: {
        check: "✅",
        error: "❗",
        info: "ℹ️",
        loading: "🕑",
        question: "❓",
        warning: "⚠️",
        x: "❌",
    },

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
    rarityMap: {
        ONESTAR: 1,
        TWOSTAR: 2,
        THREESTAR: 3,
        FOURSTAR: 4,
        FIVESTAR: 5,
        SIXSTAR: 6,
        SEVENSTAR: 7,
    } as Record<string, number>,
    OmicronMode: [
        "OmicronMode_DEFAULT",
        "ALLOMICRON",
        "PVEOMICRON",
        "PVPOMICRON",
        "GUILDRAIDOMICRON",             // Boushh  (Guild raids)
        "TERRITORYSTRIKEOMICRON",
        "TERRITORYCOVERTOMICRON",
        "TERRITORYBATTLEBOTHOMICRON",   // Cassian, Finn, Gammorean (TB)
        "TERRITORYWAROMICRON",          // Nebit, Sid, Sana Starros, Cal, Trench (TW)
        "TERRITORYTOURNAMENTOMICRON",   // Hondo, 3rd sister,  (GAC)
        "WAROMICRON0",
        "CONQUESTOMICRON1",
        "GALACTICCHALLENGEOMICRON2",
        "PVEEVENTOMICRON3",
        "TERRITORYTOURNAMENT3OMICRON4",
        "TERRITORYTOURNAMENT5OMICRON5"
    ],
    swgohLangList: [
        "ENG_US",
        "GER_DE",
        "SPA_XM",
        "FRE_FR",
        "RUS_RU",
        "POR_BR",
        "KOR_KR",
        "ITA_IT",
        "TUR_TR",
        "CHS_CN",
        "CHT_CN",
        "IND_ID",
        "JPN_JP",
        "THA_TH",
    ],

    // The timezone that the bot will mark any logs in
    timezone: "America/Los_Angeles",

    // Enable the various intents that are needed
    botIntents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
    ],

    // Partials your bot may need should go here, CHANNEL is required for DM's
    partials: [Partials.Channel],

    // Let it register global commands or not
    enableGlobalCmds: true,

    // Default config for users (Leave these blank)
    // Note: This is a partial config that gets extended with additional fields
    defaultUserConf: {
        // Discord userID
        id: "",
        // Array of allycode/ primary status pairs
        accounts: [],
        // Settings for the arena alerts
        arenaAlert: {
            enableRankDMs: "off", // all, primary, off
            arena: "none", // both, char, fleet
            payoutWarning: 0, // If higher than 0, send someone a DM that their payout is in x min
            enablePayoutResult: false,
        },
        lang: {
            language: null,
            swgohLanguage: null,
        },
    },

    // Default counts for arenawatch accounts per-tier
    arenaWatchConfig: {
        tier1: 1,
        tier2: 20,
        tier3: 50,
    },
};
