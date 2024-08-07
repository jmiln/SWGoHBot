const { GatewayIntentBits, Partials, ApplicationCommandOptionType } = require("discord.js");
const config = {
    // The Discord ID for the bot owner (Gets max perms/ can use Dev commands)
    ownerid: "",

    // Default server to deploy dev / guild_only commands to
    dev_server: null,

    // The bot's token. Get it from https://discordapp.com/developers/applications/me
    token: "",

    // The number of shards to spawn with
    shardCount: 1,

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

    // Unit locations google sheet links
    locations: {
        char: "",
        ship: "",
    },

    // Mongo DB, url for login & db name in mongo
    mongodb: {
        url: "",
        swapidb: "",
    },
    // The event manager's port
    eventServe: {
        port: 0,
    },

    // Default guild config settings, leave these as-is
    typedDefaultSettings: {
        // Settings in a way that the bot can parse em out into slash command args
        //
        // Removed the prefix now that it should all be slash commands
        //
        adminRole: {
            value: ["Administrator"],
            type: ApplicationCommandOptionType.Role,
            isArray: true,
            description: "A list of the roles that are allowed to mess with settings/ events.",
        },
        enableWelcome: {
            value: false,
            type: ApplicationCommandOptionType.Boolean,
            description: "Toggle the welcome message",
        },
        welcomeMessage: {
            value: "Say hello to {{user}}, everyone! We all need a warm welcome sometimes :D",
            type: ApplicationCommandOptionType.String,
            description: "Set the welcome message text",
        },
        enablePart: {
            value: false,
            type: ApplicationCommandOptionType.Boolean,
            description: "Toggle the parting/ leaving message",
        },
        partMessage: {
            value: "Goodbye {{user}}, thanks for stopping by!",
            type: ApplicationCommandOptionType.String,
            description: "Set the part message text",
        },
        timezone: {
            value: "America/Los_Angeles",
            type: ApplicationCommandOptionType.String,
            description: "Set the timezone to be referenced for events and such in the guild",
        },
        announceChan: {
            value: "",
            type: ApplicationCommandOptionType.Channel,
            description: "Set the default channel for events to announce to",
        },
        useEventPages: {
            value: false,
            type: ApplicationCommandOptionType.Boolean,
            description: "Set it to show your events list in pages",
        },
        eventCountdown: {
            value: [2880, 1440, 720, 360, 180, 120, 60, 30, 10, 5],
            type: ApplicationCommandOptionType.Integer,
            isArray: true,
            description: "Set how long before events is should warn you.",
        },
        language: {
            value: "en_US",
            type: ApplicationCommandOptionType.String,
            description: "Change the language (Limited options outside of English)",
            choices: ["en_US", "de_DE", "es_SP", "ko_KR", "pt_BR"],
        },
        swgohLanguage: {
            value: "ENG_US",
            type: ApplicationCommandOptionType.String,
            choices: [
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
            description: "Change the language of the data from in-game",
        },
        shardtimeVertical: {
            value: false,
            type: ApplicationCommandOptionType.Boolean,
            description: "Display the shardtimes info vertically",
        },
    },
    // The default per-guild settings
    defaultSettings: {
        adminRole: ["Administrator"],
        enableWelcome: false,
        welcomeMessage: "Say hello to {{user}}, everyone! We all need a warm welcome sometimes :D",
        enablePart: false,
        partMessage: "Goodbye {{user}}, thanks for stopping by!",
        useEmbeds: true,
        timezone: "America/Los_Angeles",
        announceChan: "",
        useEventPages: false,
        eventCountdown: [2880, 1440, 720, 360, 180, 120, 60, 30, 10, 5],
        language: "en_US",
        swgohLanguage: "ENG_US",
        shardtimeVertical: false,
    },

    // Default config for users (Leave these blank)
    defaultUserConf: {
        // Discord userID
        id: "",
        // Array of allycode/ primary status pairs
        accounts: [],
        // Settings for the arena alerts
        arenaAlert: {
            enableRankDMs: false,
            arena: "none", // both, char, fleet
            payoutWarning: 0, // If higher than 0, send someone a DM that their payout is in x min
            enablePayoutResult: false,
        },
        lang: {
            language: null,
            swgohLanguage: null,
        },
    },

    // The webhook URL to send the logs to
    webhookURL: "",
    debugLogs: false,

    // If you want to send error/ create/ delete message to a log channel
    logs: {
        logToChannel: false,
        channel: "",
        logComs: false,
    },

    // If it should use the premium client
    premium: false,

    // The premium IP/ port for it to use (localhost if local, external IP/port if not)
    // premiumIP_Port:   "http://localhost:PORT",

    // The IP/ Port for the bot to use for the image server if available
    imageServIP_Port: "http://localhost:PORT",

    // Some VIPs that can use patreon perks, put their Discord IDs in the array
    patrons: [],
    // Need a Patreon account for this
    // patreon: {
    //     clientID: "",
    //     clientSecret: "",
    //     creatorAccessToken: "",
    //     creatorRefreshToken: ""
    // },

    // Default counts for arenawatch accounts per-tier
    arenaWatchConfig: {
        tier1: 1,
        tier2: 20,
        tier3: 50,
    },
    // SWGoH.help config
    swapiConfig: {
        username: "",
        password: "",
        client_id: "",
        client_secret: "YOUR_SECRET",
        host: "api.swgoh.help",
    },
    // Alternative source
    fakeSwapiConfig: {
        enabled: false,
        options: {
            username: "",
            password: "",
            host: "",
            port: "",
            protocol: "",
        },
        statCalc: {
            url: "",
        },
        clientStub: {
            url: "",
            accessKey: "",
            secretKey: "",
        },
    },
};

module.exports = config;
