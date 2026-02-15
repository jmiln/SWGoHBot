module.exports = {
    apps: [
        {
            name: "swhohBotShard",
            interpreter: "node",
            script: "swgohBotShard.ts",
        },
        {
            name: "dataUpdater",
            interpreter: "node",
            script: "./services/dataUpdater.ts",
        },
        {
            name: "eventServe",
            interpreter: "node",
            script: "./services/eventServe.ts",
        },
    ],
};
