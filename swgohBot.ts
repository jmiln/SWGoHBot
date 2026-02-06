import { readFile } from "node:fs/promises";
import { inspect } from "node:util";
import { RESTJSONErrorCodes as APIErrors, Client, Collection, DiscordAPIError, TextChannel } from "discord.js";
import config from "./config.js";
import { characters, ships } from "./data/constants/units.ts";
import { cleanupIntervals } from "./events/clientReady.ts";
import eventHandler from "./handlers/eventHandler.ts";
import slashHandler from "./handlers/slashHandler.ts";
import cache from "./modules/cache.ts";
import database from "./modules/database.ts";
import eventFuncs from "./modules/eventFuncs.ts";
import eventSocket from "./modules/eventSocket.ts";
import { myTime, reloadLanguages } from "./modules/functions.ts";
import logger from "./modules/Logger.ts";
import patreonFuncs from "./modules/patreonFuncs.ts";
import swgohAPI from "./modules/swapi.ts";
import userReg from "./modules/users.ts";
import type { BotClient, BotType, JourneyReqs } from "./types/types.ts";

const Bot = {} as BotType;

const client = new Client({
    intents: config.botIntents,
    partials: config.partials,
    closeTimeout: 30_000,
}) as BotClient;

// Regex to replace absolute paths with relative paths in error messages
const CWD_REGEX = new RegExp(process.cwd(), "g");

const jsonFromFile = async (file: string) => {
    try {
        return await readFile(file, { encoding: "utf-8" }).then(JSON.parse);
    } catch (err) {
        console.error(`[${myTime()}] Failed to load JSON from ${file}: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
    }
};

const logErrorToChannel = (errorMsg: string) => {
    try {
        if (!config.logs.logToChannel) return;
        const thisChannel = client.channels.cache.get(config.logs.channel);
        if (!thisChannel || !(thisChannel instanceof TextChannel) || !thisChannel?.send) return;
        thisChannel.send(`\`\`\`${inspect(errorMsg)}\`\`\``);
    } catch {
        // Silently fail - we're already in error handling
    }
};

function processJourneyNames(journeyReqs: JourneyReqs): void {
    const journeyKeys = Object.keys(journeyReqs);
    Bot.journeyNames = [];
    for (const key of journeyKeys) {
        let unit = characters.find((ch) => ch.uniqueName === key);
        if (!unit) {
            unit = ships.find((sh) => sh.uniqueName === key);
        }
        if (!unit) continue;
        Bot.journeyNames.push({
            defId: key,
            name: unit.name,
            aliases: unit?.aliases?.map((u) => u.toLowerCase()) || [],
        });
    }
}

// Load the journeyReqs and process the names for autocomplete
const journeyReqs = await jsonFromFile("./data/journeyReqs.json");
processJourneyNames(journeyReqs);

client.slashcmds = new Collection();

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

        // Disconnect socket.io connection
        eventSocket.disconnect();

        // Destroy Discord client connection
        await client.destroy();
        console.log(`[${myTime()}] Discord client destroyed`);

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
        await database.connect(config.mongodb.url);
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

    if (config.swapiConfig) {
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

    slashHandler(Bot, client);
    eventHandler(Bot, client);

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
        return client.login(config.token);
    })
    .catch((err) => {
        console.error(`[${myTime()}] Failed to initialize bot: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
