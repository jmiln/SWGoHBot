import { readFileSync } from "node:fs";
import { inspect } from "node:util";
import { Client, Collection, DiscordAPIError } from "discord.js";
import { MongoClient } from "mongodb";
import config from "./config.js";
import eventHandler from "./handlers/eventHandler.js";
import slashHandler from "./handlers/slashHandler.js";
import cache from "./modules/cache.js";
import Logger from "./modules/Logger.js";
import swgohAPI from "./modules/swapi.js";
import userReg from "./modules/users.js";

const Bot = {};
Bot.config = config;

const client = new Client({
    intents: Bot.config.botIntents,
    partials: Bot.config.partials,
    closeTimeout: 30_000,
});

// Attach the character and team files to the Bot so I don't have to reopen em each time
Bot.abilityCosts = JSON.parse(readFileSync("./data/abilityCosts.json", "utf-8"));
Bot.acronyms = JSON.parse(readFileSync("./data/acronyms.json", "utf-8"));
Bot.arenaJumps = JSON.parse(readFileSync("./data/arenaJumps.json", "utf-8"));
Bot.charLocs = JSON.parse(readFileSync("./data/charLocations.json", "utf-8"));
Bot.characters = JSON.parse(readFileSync("./data/characters.json", "utf-8"));
Bot.factions = [...new Set(Bot.characters.reduce((a, b) => a.concat(b.factions), []))];
Bot.missions = JSON.parse(readFileSync("./data/missions.json", "utf-8"));
Bot.raidNames = JSON.parse(readFileSync("./data/raidNames.json", "utf-8"));
Bot.resources = JSON.parse(readFileSync("./data/resources.json", "utf-8"));
Bot.shipLocs = JSON.parse(readFileSync("./data/shipLocations.json", "utf-8"));
Bot.ships = JSON.parse(readFileSync("./data/ships.json", "utf-8"));
Bot.timezones = JSON.parse(readFileSync("./data/timezones.json", "utf-8"));

import constants from "./data/constants.js";
import help from "./data/help.js";

Bot.constants = constants;
Bot.help = help;

// Load the journeyReqs and process the names for autocomplete
Bot.journeyReqs = JSON.parse(readFileSync("./data/journeyReqs.json", "utf-8"));
processJourneyNames();

// Load in various general functions for the bot
import funct from "./modules/functions.js";

funct(Bot, client);

// Load in stuff for the events command
import eventFuncs from "./modules/eventFuncs.js";

eventFuncs(Bot, client);

// Load in stuff for patrons and such
import patreonFuncs from "./modules/patreonFuncs.js";

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
];
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
    Bot.userReg = userReg(Bot);

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
                client.channels.cache.get(Bot.config.logs.channel)?.send("```inspect(errorMsg)```", { split: true });
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
        DiscordAPIError.UnknownMessage,
        DiscordAPIError.UnknownChannel,
        DiscordAPIError.UnknownGuild,
        DiscordAPIError.UnknownMember,
        DiscordAPIError.UnknownUser,
        DiscordAPIError.UnknownInteraction,
        DiscordAPIError.MissingAccess,
    ];

    process.on("unhandledRejection", (err) => {
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
                client.channels.cache.get(Bot.config.logs.channel)?.send(`\`\`\`${inspect(errorMsg)}\`\`\``, { split: true });
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
