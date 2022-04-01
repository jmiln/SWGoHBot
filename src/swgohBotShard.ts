// At max, each shard can have 2500 servers
import config from "./config.js";
import Discord from "discord.js";

const Manager = new Discord.ShardingManager(__dirname + "/swgohBot.js",{
    totalShards: config.shardCount  // Tell it how many shards we want (Approx. 1100 servers per shard)
});
Manager.spawn();

Manager.on("shardCreate", (shard) => {
    console.log(`Creating Shard ${shard.id + 1}/${Manager.totalShards}`);
});
