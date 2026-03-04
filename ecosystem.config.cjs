module.exports = {
    apps: [
        {
            name: "swhohBotShard",
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
