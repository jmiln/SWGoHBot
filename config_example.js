const config = {
    // The Discord ID for the bot owner (Gets max perms/ can use Dev commands)
    "ownerid": "YourUserID",

    // Array of discord ID strings
    "vipList": [],

    // The prefix for commands (';' is used as ;help, '+' for +help etc. )
    "prefix": "YourPrefixGoesHere",

    // The bot's token. Get it from https://discordapp.com/developers/applications/me
    "token": "YourTokenGoesHere",

    // The postgres DB for the server configs and such
    "database": {
        "host": "localhost",
        "user": "username",
        "pass": "password",
        "data": "database"
    },

    // The default per-guild settings
    "defaultSettings": {
        "adminRole": ["Administrator"],
        "enableWelcome": false,
        "welcomeMessage": "Say hello to {{user}}, everyone! We all need a warm welcome sometimes :D",
        "useEmbeds": true,
        "timezone": "America/Los_Angeles",
        "announceChan": "",
        "useEventPages": false,
        "language": "en_US"
    },

    // If you want to send error/ create/ delete message to a log channel
    "logs": {
        "logToChannel": false,
        "channel": "channel-ID-to-log-to",
        "logComs": false
    },

    // If you want to use the ;changelog command
    "changelog": {
        "changelogChannel": "channel-to-send-to",
        "sendChangelogs": false
    },

    // Need Bill's magic stuffs for this
    // "swgohLoc": "",
    // "mySqlDB": {
    //     "host"     : "",
    //     "user"     : "",
    //     "password" : "",
    //     "database" : ""
    // },
    //
    // Need a Patreon account for this
    // "patreon": {                                                                 │50     //     "host"     : "",
    //     "clientID": "",
    //     "clientSecret": "",
    //     "creatorAccessToken": "",
    //     "creatorRefreshToken": ""
    // }
};

module.exports = config;

