import { type Shard, ShardingManager } from "discord.js";
import config from "./config.ts";

const Manager = new ShardingManager("./swgohBot.ts", {
    totalShards: config.shardCount, // Tell it how many shards we want (Approx. 1100 servers per shard)
    execArgv: ["--trace-warnings"],
});

// Give it a large timeout since it refuses to work otherwise
Manager.spawn({ timeout: 60000 }).catch(async (err) => {
    console.error(`Failed to spawn shards: ${err instanceof Error ? err.message : String(err)}`);
    try {
        // Clean up spawned shards before exiting
        await Manager.broadcastEval(() => {
            process.exit(0);
        });
    } catch (cleanupErr) {
        console.error(`Error during cleanup: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`);
    }
    process.exit(1);
});

Manager.on("shardCreate", (shard: Shard) => {
    shard.on("spawn", () => {
        console.log(`  [${shard.id}] Spawned shard`);
    });

    shard.on("ready", () => {
        console.log(`  [${shard.id}] Shard is ready`);
    });

    shard.on("reconnecting", () => {
        console.log(`  [${shard.id}] Reconnecting shard`);
    });

    shard.on("disconnect", () => {
        console.log(`  [${shard.id}] Shard disconnected`);
    });

    shard.on("death", () => {
        console.log(`  [${shard.id}] Shard died`);
    });

    shard.on("error", (err) => {
        console.error(`  [${shard.id}] Shard error: ${err instanceof Error ? err.message : String(err)}`);
    });
});
