// At max, each shard can have 2500 servers
const config = require("./config.js");

const Discord = require("discord.js");
const Manager = new Discord.ShardingManager("./swgohBot.js", {
    totalShards: config.shardCount, // Tell it how many shards we want (Approx. 1100 servers per shard)
});

// Give it a large timeout since it refuses to work otherwise
Manager.spawn({ timeout: 60000 });

Manager.on("shardCreate", (shard) => {
    // shard.on("reconnecting", () => {
    //     console.log(`  [${shard.id}] Reconnecting shard`);
    // });
    shard.on("spawn", () => {
        console.log(`  [${shard.id}] Spawned shard`);
    });
    // shard.on("ready", () => {
    //     console.log(`  [${shard.id}] Shard is ready`);
    // });
    shard.on("death", () => {
        console.log(`  [${shard.id}] Shard died`);
    });
    shard.on("disconnect", () => {
        console.log(`  [${shard.id}] Shard Disconnected`);
    });
    shard.on("death", () => {
        console.log(`  [${shard.id}] Shard Died`);
    });
    shard.on("error", (err) => {
        console.log(`ERROR: Shard had issues starting: \n${err}`);
    });
});
