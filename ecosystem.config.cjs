module.exports = {
    apps: [
        {
            name: "swgohBotShard",
            node_args: ["--env-file=.env"],
            interpreter: "node",
            script: "swgohBotShard.ts",
            env: {
                APP_NAME: "SWGoHBotShard",
            },
        },
        {
            name: "dataUpdater",
            node_args: ["--env-file=.env"],
            interpreter: "node",
            script: "./services/dataUpdater.ts",
            // The heavy update cycle runs once then exits, so the OS reclaims its memory between
            // runs. autorestart:false stops PM2 looping it on clean exit; cron_restart relaunches
            // it daily at 04:00. Patreon supporter sync now runs on the bot's shard 0 instead.
            autorestart: false,
            cron_restart: "0 4 * * *",
            env: {
                APP_NAME: "DataUpdater",
            },
        },
        {
            name: "eventServe",
            node_args: ["--env-file=.env"],
            interpreter: "node",
            script: "./services/eventServe.ts",
            env: {
                APP_NAME: "EventServe",
            },
        },
    ],
};
