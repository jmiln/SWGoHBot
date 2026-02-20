import { inspect } from "node:util";
import { RESTJSONErrorCodes as APIErrors, Client, DiscordAPIError, TextChannel } from "discord.js";
import { env } from "./config/config.ts";
import constants from "./data/constants/constants.ts";
import { cleanupIntervals } from "./events/clientReady.ts";
import eventHandler from "./handlers/eventHandler.ts";
import slashHandler from "./handlers/slashHandler.ts";
import cache from "./modules/cache.ts";
import commandStats from "./modules/commandStats.ts";
import database from "./modules/database.ts";
import databaseCleanup from "./modules/databaseCleanup.ts";
import eventFuncs from "./modules/eventFuncs.ts";
import { myTime, reloadLanguages } from "./modules/functions.ts";
import logger from "./modules/Logger.ts";
import patreonFuncs from "./modules/patreonFuncs.ts";
import swgohAPI from "./modules/swapi.ts";
import userReg from "./modules/users.ts";

const client = new Client({
    intents: constants.botIntents,
    partials: constants.partials,
    closeTimeout: 30_000,
}) as Client<true>;

// Regex to replace absolute paths with relative paths in error messages
const CWD_REGEX = new RegExp(process.cwd(), "g");

const logErrorToChannel = (errorMsg: string) => {
    try {
        if (!env.LOG_TO_CHANNEL) return;
        const thisChannel = client.channels.cache.get(env.LOG_CHANNEL_ID);
        if (!thisChannel || !(thisChannel instanceof TextChannel) || !thisChannel?.send) return;
        thisChannel.send(`\`\`\`${inspect(errorMsg)}\`\`\``);
    } catch {
        // Silently fail - we're already in error handling
    }
};

// Prevent multiple simultaneous shutdown attempts
let isShuttingDown = false;

/**
 * Gracefully shuts down the bot, cleaning up resources
 */
async function gracefulShutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[${myTime()}] Received ${signal}, starting graceful shutdown...`);

    try {
        // Stop accepting new interactions
        client.removeAllListeners();

        // Clean up intervals from clientReady
        cleanupIntervals();

        // Clean up SWAPI reload interval
        swgohAPI.cleanup();

        // Flush any pending command stats
        await commandStats.shutdown();

        // Destroy Discord client connection
        await client.destroy();
        console.log(`[${myTime()}] Discord client destroyed`);

        // Stop database cleanup scheduler
        databaseCleanup.stop();

        // Close MongoDB connection
        if (database.isConnected()) {
            await database.close();
        }

        console.log(`[${myTime()}] Graceful shutdown complete`);
        process.exit(0);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[${myTime()}] Error during shutdown: ${errorMsg}`);
        process.exit(1);
    }
}

const init = async () => {
    try {
        await database.connect(env.MONGODB_URL);
    } catch (err) {
        console.error(`[${myTime()}] Failed to connect to MongoDB: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }

    // Load the language files
    try {
        await reloadLanguages();
    } catch (err) {
        console.error(`[${myTime()}] Failed to load languages: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }

    // Set up the caching
    cache.init(database.getClient());
    userReg.init(cache);

    if (env.SWAPI_CLIENT_URL) {
        // Load up the api connector/ helpers
        try {
            swgohAPI.init();
        } catch (err) {
            console.error(`[${myTime()}] Failed to initialize swgohAPI: ${err instanceof Error ? err.message : String(err)}`);
        }
    } else {
        console.error(`[${myTime()}] Failed to load swapi: No swapiConfig found`);
    }

    // Initialize patreon functions
    patreonFuncs.init(client);

    // Initialize event functions
    eventFuncs.init(client);

    slashHandler();
    eventHandler(client);

    // Register graceful shutdown handlers
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    process.on("uncaughtException", (err) => {
        const errorMsg = err.stack?.replace(CWD_REGEX, ".") || String(err);
        console.error(`[${myTime()}] Uncaught Exception: ${errorMsg}`);

        // If it's that error, don't bother showing it again
        if (!errorMsg.includes("RSV2 and RSV3 must be clear")) {
            logErrorToChannel(errorMsg);
        }
        if (database.isConnected()) {
            database.close();
        }
        process.exit(1);
    });

    const IGNORED_ERRORS = [
        APIErrors.UnknownMessage,
        APIErrors.UnknownChannel,
        APIErrors.UnknownGuild,
        APIErrors.UnknownMember,
        APIErrors.UnknownUser,
        APIErrors.UnknownInteraction,
        APIErrors.MissingAccess,
    ];

    process.on("unhandledRejection", (err: Error) => {
        // If it's something I can't do anything about, ignore it
        if (err instanceof DiscordAPIError && typeof err.code === "number" && IGNORED_ERRORS.includes(err.code)) {
            return;
        }

        const errorMsg = err?.stack?.replace(CWD_REGEX, ".") || String(err);

        if (errorMsg.includes("ShardClientUtil._handleMessage") && errorMsg.includes("client is not defined")) {
            logger.error("The following error probably has to do with a 'client' inside a broadcastEval");
        }
        console.error(`[${myTime()}] Uncaught Promise Error: ${errorMsg}`);
        logErrorToChannel(errorMsg);
    });
};

init()
    .then(() => {
        console.log(`[${myTime()}] Bot initialization complete`);
        return client.login();
    })
    .catch((err) => {
        console.error(`[${myTime()}] Failed to initialize bot: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
