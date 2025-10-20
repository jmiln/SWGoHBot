import fs from "node:fs";
import { inspect } from "node:util";
import { RESTJSONErrorCodes as APIErrors, Client, Collection, DiscordAPIError, TextChannel } from "discord.js";
import { MongoClient } from "mongodb";
import config from "./config.js";
import eventHandler from "./handlers/eventHandler.ts";
import slashHandler from "./handlers/slashHandler.ts";
import cache from "./modules/cache.ts";
import Logger from "./modules/Logger.ts";
import swgohAPI from "./modules/swapi.ts";
import userReg from "./modules/users.ts";

const Bot = {} as BotType;
Bot.config = config;

const client = new Client({
    intents: Bot.config.botIntents,
    partials: Bot.config.partials,
    closeTimeout: 30_000,
}) as BotClient;

const jsonFromFile = async (file: string) => await fs.promises.readFile(file, "utf-8").then(JSON.parse);

// Attach the character and team files to the Bot so I don't have to reopen em each time
Bot.abilityCosts = await jsonFromFile("./data/abilityCosts.json");
Bot.acronyms     = await jsonFromFile("./data/acronyms.json");
Bot.arenaJumps   = await jsonFromFile("./data/arenaJumps.json");
Bot.charLocs     = await jsonFromFile("./data/charLocations.json");
Bot.characters   = await jsonFromFile("./data/characters.json");
Bot.factions     = [...new Set(Bot.characters.reduce((a, b) => a.concat(b.factions), []))];
Bot.missions     = await jsonFromFile("./data/missions.json");
Bot.raidNames    = await jsonFromFile("./data/raidNames.json");
Bot.resources    = await jsonFromFile("./data/resources.json");
Bot.shipLocs     = await jsonFromFile("./data/shipLocations.json");
Bot.ships        = await jsonFromFile("./data/ships.json");
Bot.timezones    = await jsonFromFile("./data/timezones.json");

import constants from "./data/constants.ts";
import help from "./data/help.ts";

Bot.constants = constants;
Bot.help = help;

// Load the journeyReqs and process the names for autocomplete
Bot.journeyReqs = await jsonFromFile("./data/journeyReqs.json");
processJourneyNames();

// Load in various general functions for the bot
import funct from "./modules/functions.ts";

funct(Bot, client);

// Load in stuff for the events command
import eventFuncs from "./modules/eventFuncs.ts";

eventFuncs(Bot, client);

// Load in stuff for patrons and such
import patreonFuncs from "./modules/patreonFuncs.ts";
import type { SWAPILang } from "./types/swapi_types.ts";
import type { BotClient, BotType } from "./types/types.ts";
import type { UserReg } from "./types/userReg_types.ts";

patreonFuncs(Bot, client);

// Languages
Bot.languages = {};
Bot.swgohLangList = [
    "ENG_US",
    "GER_DE",
    "SPA_XM",
    "FRE_FR",
    "RUS_RU",
    "POR_BR",
    "KOR_KR",
    "ITA_IT",
    "TUR_TR",
    "CHS_CN",
    "CHT_CN",
    "IND_ID",
    "JPN_JP",
    "THA_TH",
] as SWAPILang[];
client.reloadLanguages();

// List of all the unit names to use for autocomplete
Bot.CharacterNames = Bot.characters.map((ch) => {
    let suffix = "";
    if (ch.factions.includes("Galactic Legend")) {
        suffix = "(GL)";
    }
    return { name: `${ch.name} ${suffix}`, defId: ch.uniqueName, aliases: ch.aliases || [] };
});
Bot.ShipNames = Bot.ships.map((sh) => {
    return { name: sh.name, defId: sh.uniqueName, aliases: sh.aliases || [] };
});

client.slashcmds = new Collection();

const init = async () => {
    Bot.mongo = await MongoClient.connect(Bot.config.mongodb.url);

    // Set up the caching
    Bot.cache = cache(Bot.mongo);
    Bot.userReg = userReg(Bot) as UserReg;

    if (Bot.config.swapiConfig || Bot.config.fakeSwapiConfig) {
        // Load up the api connector/ helpers
        Bot.swgohAPI = await swgohAPI(null);
    } else {
        console.log("Couldn't load swapi");
    }

    // Store the list of omicrons to be used later
    Bot.omicrons = await Bot.sortOmicrons();

    Bot.logger = new Logger(Bot, client);

    slashHandler(Bot, client);
    eventHandler(Bot, client);

    process.on("uncaughtException", (err) => {
        const errorMsg = err.stack?.replace(new RegExp(`${process.cwd()}`, "g"), ".");
        console.error(`[${Bot.myTime()}] Uncaught Exception: ${errorMsg}`);

        // If it's that error, don't bother showing it again
        try {
            if (!errorMsg?.startsWith("Error: RSV2 and RSV3 must be clear") && Bot.config.logs.logToChannel) {
                const thisChannel = client.channels.cache.get(Bot.config.logs.channel);
                if (!thisChannel || !(thisChannel instanceof TextChannel) || !thisChannel?.send) return;
                thisChannel?.send("```inspect(errorMsg)```");
            }
        } catch (_) {
            // Don't bother doing anything
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
        const errorMsg = err?.stack.replace(new RegExp(process.cwd(), "g"), ".");

        // If it's something I can't do anything about, ignore it
        if (err instanceof DiscordAPIError && typeof err.code === "number" && IGNORED_ERRORS.includes(err.code)) {
            return;
        }

        if (errorMsg.includes("ShardClientUtil._handleMessage") && errorMsg.includes("client is not defined")) {
            Bot.logger.error("The following error probably has to do with a 'client' inside a broadcastEval");
        }
        // console.log(err);
        console.error(`[${Bot.myTime()}] Uncaught Promise Error: ${errorMsg}`);
        console.error(err.stack);
        console.error(err);
        try {
            if (Bot.config.logs.logToChannel) {
                const thisChannel = client.channels.cache.get(Bot.config.logs.channel);
                if (!thisChannel || !(thisChannel instanceof TextChannel) || !thisChannel?.send) return;
                thisChannel?.send(`\`\`\`${inspect(errorMsg)}\`\`\``);
            }
        } catch (e) {
            console.error("[swgohBot.js unhandledRejection] Error while logging error:", e);
        }
    });
};

function processJourneyNames() {
    const journeyKeys = Object.keys(Bot.journeyReqs);
    Bot.journeyNames = [];
    for (const key of journeyKeys) {
        let unit = Bot.characters.find((ch) => ch.uniqueName === key);
        if (!unit) {
            unit = Bot.ships.find((sh) => sh.uniqueName === key);
        }
        if (!unit) continue;
        Bot.journeyNames.push({
            defId: key,
            name: unit.name,
            aliases: unit?.aliases.map((u) => u.toLowerCase()) || [],
        });
    }
}

init();
client.login(Bot.config.token);
