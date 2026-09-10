import { type Shard, ShardingManager } from "discord.js";
import { env } from "./config/config.ts";
import logger, { shouldUsePretty } from "./modules/Logger.ts";
import { type ShardHeartbeat, ShardRegistry } from "./modules/shardStatus/registry.ts";
import { startShardStatusServer } from "./modules/shardStatus/server.ts";
import { getPackageVersion } from "./modules/utils/version.ts";
import { systemClock } from "./services/swapiServe/clock.ts";

const Manager = new ShardingManager("./swgohBot.ts", {
    // totalShards: config.shardCount, // Tell it how many shards we want (Approx. 1100 servers per shard)
    totalShards: "auto",
    execArgv: ["--trace-warnings"],
    token: env.DISCORD_TOKEN,
});

const registry = new ShardRegistry(systemClock);

function isHeartbeat(message: unknown): message is { type: "shardHeartbeat"; payload: ShardHeartbeat } {
    if (typeof message !== "object" || message === null) return false;
    const candidate = message as { type?: unknown; payload?: unknown };
    return candidate.type === "shardHeartbeat" && typeof candidate.payload === "object" && candidate.payload !== null;
}

Manager.on("shardCreate", (shard: Shard) => {
    // The only lifecycle event the registry takes: it is the sole way to know a shard should exist
    // before it has ever reported. Everything else a handler could record, the next heartbeat says.
    registry.registerShard(shard.id);

    shard.on("message", (message: unknown) => {
        if (isHeartbeat(message)) registry.recordHeartbeat(message.payload);
    });

    shard.on("spawn", () => {
        logger.log("Shard spawned", "log", { shardId: shard.id, event: "spawned" });
    });

    shard.on("ready", () => {
        logger.log("Shard ready", "ready", { shardId: shard.id, event: "ready" });
    });

    shard.on("reconnecting", () => {
        // This seems to happen fairly often without disconnecting a lot, so let's not spam the logs with it
        // - Apparently Discord will reconnect any shards periodically
        logger.debug("Shard reconnecting", { shardId: shard.id, event: "reconnecting" });
    });

    shard.on("disconnect", () => {
        logger.warn("Shard disconnected", { shardId: shard.id, event: "disconnected" });
    });

    shard.on("death", () => {
        logger.error("Shard died", { shardId: shard.id, event: "died" });
    });

    shard.on("error", (err) => {
        logger.error("Shard error", {
            shardId: shard.id,
            event: "error",
            errorMessage: err instanceof Error ? err.message : String(err),
        });
    });
});

async function formatSpawnError(err: unknown): Promise<string> {
    if (err instanceof Response) {
        const retryAfter = err.headers.get("retry-after");
        const scope = err.headers.get("x-ratelimit-scope");
        let detail = `HTTP ${err.status} ${err.statusText}`;
        if (retryAfter) detail += ` - retry after ${retryAfter}s`;
        if (scope) detail += ` (scope: ${scope})`;
        return detail;
    }
    return err instanceof Error ? err.message : String(err);
}

// Diagnostics must never be able to stop the bot: this is awaited before spawn, so an occupied
// port would otherwise mean no shards at all, and `restart: unless-stopped` would make that a
// loop. Losing the endpoint costs visibility; losing the shards costs the service.
try {
    const statusServer = await startShardStatusServer(registry, {
        port: env.SHARD_STATUS_PORT,
        host: env.SHARD_STATUS_HOST,
    });
    logger.log("Shard status endpoint listening", "log", { url: statusServer.url });
} catch (err) {
    logger.error("Shard status endpoint failed to start, continuing without it", {
        errorMessage: err instanceof Error ? err.message : String(err),
    });
}

// Give it a large timeout since it refuses to work otherwise
Manager.spawn({ timeout: 60000 })
    .then(() => {
        // After spawn: totalShards is "auto" until then, so the count is not known earlier.
        logger.log("Service started", "ready", {
            version: getPackageVersion(),
            logLevel: env.LOG_LEVEL,
            pretty: shouldUsePretty(env.LOG_PRETTY, Boolean(process.stdout.isTTY)),
            port: env.SHARD_STATUS_PORT,
            shardCount: Manager.shards.size,
        });
    })
    .catch(async (err) => {
        const message = await formatSpawnError(err);
        logger.error("Failed to spawn shards", { errorMessage: message });
        try {
            // Clean up spawned shards before exiting
            await Manager.broadcastEval(() => {
                process.exit(0);
            });
        } catch (cleanupErr) {
            logger.error("Error during shard cleanup", {
                errorMessage: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
            });
        }
        process.exit(1);
    });
