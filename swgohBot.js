const { Client, Collection } = require("discord.js");
const { readFileSync } = require("fs");
const { inspect } = require("util");

const Bot = {};

// Attach the config to the Bot so we can use it anywhere
Bot.config = require("./config.js");

const client = new Client({
    intents: Bot.config.botIntents,
    partials: Bot.config.partials,
    closeTimeout: 30_000
});

// Attach the character and team files to the Bot so I don't have to reopen em each time
Bot.abilityCosts = JSON.parse(readFileSync("./data/abilityCosts.json", "utf-8"));
Bot.acronyms     = JSON.parse(readFileSync("./data/acronyms.json", "utf-8"));
Bot.arenaJumps   = JSON.parse(readFileSync("./data/arenaJumps.json", "utf-8"));
Bot.charLocs     = JSON.parse(readFileSync("./data/charLocations.json", "utf-8"));
Bot.characters   = JSON.parse(readFileSync("./data/characters.json", "utf-8"));
Bot.factions     = [...new Set(Bot.characters.reduce((a, b) => a.concat(b.factions), []))];
Bot.missions     = JSON.parse(readFileSync("./data/missions.json", "utf-8"));
Bot.resources    = JSON.parse(readFileSync("./data/resources.json", "utf-8"));
Bot.shipLocs     = JSON.parse(readFileSync("./data/shipLocations.json", "utf-8"));
Bot.ships        = JSON.parse(readFileSync("./data/ships.json", "utf-8"));
Bot.timezones    = JSON.parse(readFileSync("./data/timezones.json", "utf-8"));

Bot.constants    = require("./data/cosntants.js");
Bot.help         = require("./data/help.js");

const gameData   = JSON.parse(readFileSync("./data/gameData.json", "utf-8"));

// Load in various general functions for the bot
require("./modules/functions.js")(Bot, client);

// Load in stuff for the events command
require("./modules/eventFuncs.js")(Bot, client);

// Load in stuff for patrons and such
require("./modules/patreonFuncs.js")(Bot, client);

// Languages
Bot.languages = {};
Bot.swgohLangList = ["ENG_US", "GER_DE", "SPA_XM", "FRE_FR", "RUS_RU", "POR_BR", "KOR_KR", "ITA_IT", "TUR_TR", "CHS_CN", "CHT_CN", "IND_ID", "JPN_JP", "THA_TH"];
client.reloadLanguages();

// List of all the unit names to use for autocomplete
Bot.CharacterNames = Bot.characters.map(ch => ch.name);
Bot.ShipNames = Bot.ships.map(ch => ch.name);

client.slashcmds = new Collection();

const init = async () => {
    const { MongoClient } = require("mongodb");
    Bot.mongo = await MongoClient.connect(Bot.config.mongodb.url);
    // Set up the caching
    Bot.cache   = require("./modules/cache.js")(Bot.mongo);
    Bot.userReg = require("./modules/users.js")(Bot);

    Bot.statCalculator = require("swgoh-stat-calc");
    Bot.statCalculator.setGameData(gameData);

    if (Bot.config.swapiConfig || Bot.config.fakeSwapiConfig) {
        // Load up the api connector/ helpers
        Bot.swgohAPI = require("./modules/swapi.js")(null);
    } else {
        console.log("Couldn't load swapi");
    }

    // Store the list of omicrons to be used later
    Bot.omicrons = await Bot.sortOmicrons();

    const Logger = require("./modules/Logger.js");
    Bot.logger = new Logger(Bot, client);

    require("./handlers/slashHandler.js")(Bot, client);
    require("./handlers/eventHandler.js")(Bot, client);

    process.on("uncaughtException", (err) => {
        const errorMsg = err.stack?.replace(new RegExp(`${process.cwd()}`, "g"), ".");
        console.error(`[${Bot.myTime()}] Uncaught Exception: ${errorMsg}`);

        // If it's that error, don't bother showing it again
        try {
            if (!errorMsg?.startsWith("Error: RSV2 and RSV3 must be clear") && Bot.config.logs.logToChannel) {
                client.channels.cache.get(Bot.config.logs.channel)?.send("```inspect(errorMsg)```",{split: true});
            }
        } catch (e) {
            // Don't bother doing anything
        }
        process.exit(1);
    });

    process.on("unhandledRejection", (err) => {
        const errorMsg = err?.stack.replace(new RegExp(process.cwd(), "g"), ".");

        // If it's something I can't do anything about, ignore it
        const ignoreArr = [
            "Internal Server Error",                // Something on Discord's end
            "The user aborted a request",           // Pretty sure this is also on Discord's end
            "Cannot send messages to this user",    // A user probably has the bot blocked or doesn't allow DMs (No way to check for that)
            "Unknown Message"                       // Not sure, but seems to happen when someone deletes a message that the bot is trying to reply to?
        ];
        const errStr = ignoreArr.find(elem => errorMsg.includes(elem));
        if (errStr) {
            return console.error(`[${Bot.myTime()}] Uncaught Promise Error: ${errStr}`);
        }

        if (errorMsg.includes("ShardClientUtil._handleMessage") && errorMsg.includes("client is not defined")) {
            Bot.logger.error("The following error probably has to do with a 'client' inside a broadcastEval");
        }
        // console.log(err);
        console.error(`[${Bot.myTime()}] Uncaught Promise Error: ${errorMsg}`);
        try {
            if (Bot.config.logs.logToChannel) {
                client.channels.cache.get(Bot.config.logs.channel)?.send(`\`\`\`${inspect(errorMsg)}\`\`\``,{split: true});
            }
        } catch (e) {
            // Don't bother doing anything
        }
    });
};

init();
client.login(Bot.config.token);
