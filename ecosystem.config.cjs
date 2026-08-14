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
            name: "eventServe",
            node_args: ["--env-file=.env"],
            interpreter: "node",
            script: "./services/eventServe.ts",
            env: {
                APP_NAME: "EventServe",
            },
        },
        {
            name: "swapiServe",
            node_args: ["--env-file=.env"],
            interpreter: "node",
            script: "./services/swapiServe/index.ts",
            // Past SHUTDOWN_GRACE_MS in services/swapiServe/index.ts, so the service finishes its
            // own shutdown rather than being SIGKILLed partway through it. pm2 defaults to 1600ms,
            // which lands in the middle of the in-flight wait.
            kill_timeout: 8000,
            env: {
                APP_NAME: "SwapiServe",
            },
        },
    ],
};
