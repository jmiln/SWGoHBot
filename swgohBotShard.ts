import { type Shard, ShardingManager } from "discord.js";
import { env } from "./config/config.ts";

const Manager = new ShardingManager("./swgohBot.ts", {
    // totalShards: config.shardCount, // Tell it how many shards we want (Approx. 1100 servers per shard)
    totalShards: "auto",
    execArgv: ["--trace-warnings"],
    token: env.DISCORD_TOKEN,
});

Manager.on("shardCreate", (shard: Shard) => {
    shard.on("spawn", () => {
        console.log(`  [${shard.id}] Spawned shard`);
    });

    shard.on("ready", () => {
        console.log(`  [${shard.id}] Shard is ready`);
    });

    shard.on("reconnecting", () => {
        // This seems to happen fairly often without disconnecting a lot, so let's not spam the logs with it
        // - Apparently Discord will reconnect any shards periodically
        // console.log(`  [${shard.id}] Reconnecting shard`);
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

async function formatSpawnError(err: unknown): Promise<string> {
    if (err instanceof Response) {
        const retryAfter = err.headers.get("retry-after");
        const scope = err.headers.get("x-ratelimit-scope");
        let detail = `HTTP ${err.status} ${err.statusText}`;
        if (retryAfter) detail += ` — retry after ${retryAfter}s`;
        if (scope) detail += ` (scope: ${scope})`;
        return detail;
    }
    return err instanceof Error ? err.message : String(err);
}

// Give it a large timeout since it refuses to work otherwise
Manager.spawn({ timeout: 60000 }).catch(async (err) => {
    const message = await formatSpawnError(err);
    console.error(`Failed to spawn shards: ${message}`);
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
