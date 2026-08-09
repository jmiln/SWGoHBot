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
            env: {
                APP_NAME: "SwapiServe",
            },
        },
    ],
};
