// At max, each shard can have 2500 servers
const config = require("./config.js");

const Discord = require("discord.js");
const Manager = new Discord.ShardingManager("./swgohBot.js",{
    totalShards: config.shardCount  // Tell it how many shards we want (Approx. 1100 servers per shard)
});

// Give it a large timeout since it refuses to work otherwise
Manager.spawn({timeout: 60000});

Manager.on("shardCreate", (shard) => {
    shard.on("reconnecting", () => {
        console.log(`Reconnecting shard: [${shard.id}]`);
    });
    shard.on("spawn", () => {
        console.log(`Spawned shard: [${shard.id}]`);
    });
    // shard.on("ready", () => {
    //     console.log(`Shard [${shard.id}] is ready`);
    // });
    shard.on("disconnect", () => {
        console.log(`Shard Disconnected: [${shard.id}]`);
    });
    shard.on("death", () => {
        console.log(`Shard Died: [${shard.id}]`);
    });
    shard.on("error", (err) => {
        console.log("ERROR: Shard had issues starting: \n" + err);
    });
});
