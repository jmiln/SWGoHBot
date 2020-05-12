// At max, each shard can have 2500 servers
const config = require("./config.js");

const Discord = require("discord.js");
const Manager = new Discord.ShardingManager("./swgohBot.js",{
    totalShards: config.shardCount  // Tell it how many shards we want (Approx. 1100 servers per shard)
});
Manager.spawn();

Manager.on("shardCreate", (shard) => {
    console.log(`Creating Shard ${shard.id + 1}/${Manager.totalShards}`);
});
