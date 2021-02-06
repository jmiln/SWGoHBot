const config = {
    // The Discord ID for the bot owner (Gets max perms/ can use Dev commands)
    "ownerid": "YourUserID",

    // The prefix for commands (';' is used as ;help, '+' for +help etc. )
    "prefix": "YourPrefixGoesHere",

    // The bot's token. Get it from https://discordapp.com/developers/applications/me
    "token": "YourTokenGoesHere",

    // The number of shards to spawn with
    "shardCount": 1,

    // The postgres DB for the server configs and such
    "database": {
        "host": "localhost",
        "user": "username",
        "pass": "password",
        "data": "database"
    },

    "mongodb": {
        "url": "mongodb://localhost:27017/",
        "swgohbotdb": "swgohbot",
        "swapidb": "swapi"
    },

    // The port to use for the event manager
    eventServe: {
        port: 3000
    },

    // The default per-guild settings
    "defaultSettings": {
        "prefix": ";",
        "adminRole": ["Administrator"],
        "enableWelcome": false,
        "welcomeMessage": "Say hello to {{user}}, everyone! We all need a warm welcome sometimes :D",
        "enablePart": false,
        "partMessage": "Goodbye {{user}}, thanks for stopping by!",
        "useEmbeds": true,
        "timezone": "America/Los_Angeles",
        "announceChan": "",
        "useEventPages": false,
        "eventCountdown": [2880, 1440, 720, 360, 180, 120, 60, 30, 10, 5],
        "language": "en_US",
        "swgohLanguage": "ENG_US",
        "shardtimeVertical": false
    },

    // Default config for users (Leave these blank)
    "defaultUserConf": {
        // Discord userID
        id: "",
        // Array of allycode/ primary status pairs
        accounts: [],
        // Command specific defaults (guildsearch, ga, etc..)
        defaults:{},
        // Settings for the arena alerts
        arenaAlert: {
            enableRankDMs: false,
            arena: "none",    // both, char, fleet
            payoutWarning: 0,  // If higher than 0, send someone a DM that their payout is in x min
            enablePayoutResult: false
        }
    },

    // If you want to send error/ create/ delete message to a log channel
    "logs": {
        "logToChannel": false,
        "channel": "channel-ID-to-log-to",
        "logComs": false
    },

    // If you want to use the ;changelog command
    "changelog": {
        "changelogChannel": "channel-id-to-send-to",
        "sendChangelogs": false
    },

    // Tell it to send stats to bot list(s)
    "sendStats": true,
    // Massive long token for botsfordiscord
    "b4dToken": "",

    // Need a Patreon account for this
    // "patreon": {
    //     "host"     : "",
    //     "clientID": "",
    //     "clientSecret": "",
    //     "creatorAccessToken": "",
    //     "creatorRefreshToken": ""
    // }

    // api.swgoh.help info
    "api_swgoh_help": {
        "username"     : "",
        "password"     : "",
        "client_id"    : "",     // Your discord user ID
        "client_secret": "YOUR_SECRET",
        "host"         : "api.swgoh.help"
    }
};

module.exports = config;
