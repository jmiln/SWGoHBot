import { readFile } from "node:fs/promises";
import { inspect } from "node:util";
import { RESTJSONErrorCodes as APIErrors, Client, Collection, DiscordAPIError, TextChannel } from "discord.js";
import { MongoClient } from "mongodb";
import Language from "./base/Language.ts";
import config from "./config.js";
import { characters, ships } from "./data/constants/units.ts";
import help from "./data/help.ts";
import eventHandler from "./handlers/eventHandler.ts";
import slashHandler from "./handlers/slashHandler.ts";
import cache from "./modules/cache.ts";
import eventFuncs from "./modules/eventFuncs.ts";
import funct, { myTime, reloadLanguages, sortOmicrons } from "./modules/functions.ts";
import logger from "./modules/Logger.ts";
import patreonFuncs from "./modules/patreonFuncs.ts";
import swgohAPI from "./modules/swapi.ts";
import userReg from "./modules/users.ts";
import type { BotClient, BotType, BotUnit } from "./types/types.ts";

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

const mapUnitNames = (units: BotUnit[], addGLSuffix = false) => {
    return units.map((unit) => {
        let suffix = "";
        if (addGLSuffix && unit.factions?.includes("Galactic Legend")) {
            suffix = "(GL)";
        }
        return {
            name: `${unit.name} ${suffix}`.trim(),
            defId: unit.uniqueName,
            aliases: unit.aliases || [],
        };
    });
};

function processJourneyNames() {
    const journeyKeys = Object.keys(Bot.journeyReqs);
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

Bot.help = help;

// Load the journeyReqs and process the names for autocomplete
Bot.journeyReqs = await jsonFromFile("./data/journeyReqs.json");
processJourneyNames();

// Load in various general functions for the bot
funct(Bot, client);

// Load in stuff for the events command
eventFuncs(Bot, client);

// Load in stuff for patrons and such
patreonFuncs(Bot, client);

// List of all the unit names to use for autocomplete
Bot.CharacterNames = mapUnitNames(characters, true);
Bot.ShipNames = mapUnitNames(ships);

client.slashcmds = new Collection();

const init = async () => {
    try {
        Bot.mongo = await MongoClient.connect(config.mongodb.url);
        console.log(`[${myTime()}] Connected to MongoDB`);
    } catch (err) {
        console.error(`[${myTime()}] Failed to connect to MongoDB: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }

    // Load the language files
    try {
        await reloadLanguages();
        // Reference the static language registry in Bot for compatibility
        Bot.languages = Language.getLanguages();
    } catch (err) {
        console.error(`[${myTime()}] Failed to load languages: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    }

    // Set up the caching
    cache.init(Bot.mongo);
    userReg.init(cache);

    if (config.swapiConfig) {
        // Load up the api connector/ helpers
        try {
            Bot.swgohAPI = await swgohAPI(null);
        } catch (err) {
            console.error(`[${myTime()}] Failed to initialize swgohAPI: ${err instanceof Error ? err.message : String(err)}`);
        }
    } else {
        console.error(`[${myTime()}] Failed to load swapi: No swapiConfig found`);
    }

    // Store the list of omicrons to be used later
    Bot.omicrons = await sortOmicrons(cache);

    slashHandler(Bot, client);
    eventHandler(Bot, client);

    process.on("uncaughtException", (err) => {
        const errorMsg = err.stack?.replace(CWD_REGEX, ".") || String(err);
        console.error(`[${myTime()}] Uncaught Exception: ${errorMsg}`);

        // If it's that error, don't bother showing it again
        if (!errorMsg.includes("RSV2 and RSV3 must be clear")) {
            logErrorToChannel(errorMsg);
        }
        if (Bot.mongo) {
            Bot.mongo.close();
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
