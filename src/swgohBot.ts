import { Client, Collection } from "discord.js";
import { readdirSync, readFileSync } from "fs";
import { inspect } from "util";
import SwgohClientStub from "swgoh-client-stub";
import { Sequelize, Op } from "sequelize";
import { BotClient, BotType } from "./modules/types";
import SlashCommand from "./base/slashCommand";
import { readdir } from "fs/promises";
import fs from "fs"

const Bot = {} as BotType;

// Attach the config to the Bot so we can use it anywhere
Bot.config = require(__dirname + "/config.js");

// import Sequelize from "sequelize";
const dataDir = __dirname + "/data/";
const moduleDir = __dirname + "/modules/";

// Attach the character and team files to the Bot so I don't have to reopen em each time
Bot.abilityCosts = JSON.parse(readFileSync(dataDir + "abilityCosts.json").toString());
Bot.acronyms     = JSON.parse(readFileSync(dataDir + "acronyms.json").toString());
Bot.arenaJumps   = JSON.parse(readFileSync(dataDir + "arenaJumps.json").toString());
Bot.charLocs     = JSON.parse(readFileSync(dataDir + "charLocations.json").toString());
Bot.characters   = JSON.parse(readFileSync(dataDir + "characters.json").toString());
Bot.factions     = [...new Set(Bot.characters.reduce((a: string[], b: {factions: string[]}) => a.concat(b.factions), []))];
Bot.missions     = JSON.parse(readFileSync(dataDir + "missions.json").toString());
Bot.resources    = JSON.parse(readFileSync(dataDir + "resources.json").toString());
Bot.shipLocs     = JSON.parse(readFileSync(dataDir + "shipLocations.json").toString());
Bot.ships        = JSON.parse(readFileSync(dataDir + "ships.json").toString());
Bot.squads       = JSON.parse(readFileSync(dataDir + "squads.json").toString());

const gameData   = JSON.parse(readFileSync(dataDir + "gameData.json").toString());

const clientOpts = { intents:  Bot.config.botIntents, partials: Bot.config.partials };
const client = new Client(clientOpts) as BotClient;

// Load in various general functions for the bot
require(moduleDir + "functions.js")(Bot, client);

// Load in stuff for the events command
require(moduleDir + "eventFuncs.js")(Bot, client);

// Load in stuff for patrons and such
require(moduleDir + "patreonFuncs.js")(Bot, client);

// Languages
Bot.languages = {};
Bot.swgohLangList = ["ENG_US", "GER_DE", "SPA_XM", "FRE_FR", "RUS_RU", "POR_BR", "KOR_KR", "ITA_IT", "TUR_TR", "CHS_CN", "CHT_CN", "IND_ID", "JPN_JP", "THA_TH"];

client.slashcmds = new Collection();

Bot.seqOps = Op;
Bot.database = new Sequelize(
    Bot.config.database.data,
    Bot.config.database.user,
    Bot.config.database.pass, {
        host: Bot.config.database.host,
        dialect: "postgres",
        logging: false
    }
);


Bot.database.authenticate().then(async () => {
    require("./modules/models")(Sequelize, Bot.database);

    // Get all the models
    const rawAttr = Bot.database.models.settings.rawAttributes;
    const rawNames = Object.keys(rawAttr);

    // Got through them all
    for (let ix = 0; ix < rawNames.length; ix++) {
        // Try getting each column
        await Bot.database.models.settings.findAll({limit: 1, attributes: [rawNames[ix]]})
        // If it doesn't exist, it'll throw an error, then it will add them
            .catch(async () => {
                Bot.logger.log("Adding column " + rawNames[ix] + " to settings.");
                await Bot.database.queryInterface.addColumn("settings",
                    rawAttr[rawNames[ix]].fieldName,
                    {
                        type: rawAttr[rawNames[ix]].type,
                        defaultValue: rawAttr[rawNames[ix]].defaultValue !== null ? rawAttr[rawNames[ix]].defaultValue : null
                    }
                );
            });
    }

    init();
    client.login(Bot.config.token).then(() => {
        const guildList = [...client.guilds.cache.keys()];
        for (let ix = 0; ix < guildList.length; ix++) {
            Bot.database.models.settings.findOrCreate({
                where: {
                    guildID: guildList[ix]
                }
            }).catch((e: unknown) =>  Bot.logger.error("Error in init (Models.spread): " + e, true));
        }
    }).catch((e) => console.error(e));
});

const init = async () => {
    const MongoClient = require("mongodb").MongoClient;
    Bot.mongo = await MongoClient.connect(Bot.config.mongodb.url, { useNewUrlParser: true, useUnifiedTopology: true } );
    // Set up the caching
    Bot.cache   = require("./modules/cache.js")(Bot.mongo);
    Bot.userReg = require("./modules/users.js")(Bot);

    Bot.swgohPlayerCount = await Bot.mongo.db(Bot.config.mongodb.swapidb).collection("playerStats").estimatedDocumentCount();
    Bot.swgohGuildCount  = await Bot.mongo.db(Bot.config.mongodb.swapidb).collection("guilds").estimatedDocumentCount();

    Bot.statCalculator = require("swgoh-stat-calc");
    Bot.statCalculator.setGameData(gameData);

    await client.reloadLanguages();

    if (Bot.config.swapiConfig) {
        // Load up the api connector/ helpers
        const ApiSwgohHelp = require("api-swgoh-help");
        Bot.swgoh = (Bot.config.fakeSwapiConfig && Bot.config.fakeSwapiConfig.enabled) ?
            new ApiSwgohHelp(Bot.config.fakeSwapiConfig.options) :
            new ApiSwgohHelp(Bot.config.swapiConfig);
        Bot.swgohAPI = require("./modules/swapi.js")(Bot);

        if (Bot.config.fakeSwapiConfig?.clientStub) {
            // Do stuff
            Bot.swapiStub = new SwgohClientStub(Bot.config.fakeSwapiConfig.clientStub);
        }
    }

    const Logger = require("./modules/Logger.js");
    Bot.logger = new Logger(Bot, client);

    const slashFiles = readdirSync(__dirname + "/slash/");
    const slashError = [];
    slashFiles.forEach(async file => {
        try {
            if (!file.endsWith(".js")) return;
            const commandName = file.split(".")[0];
            const result = await client.loadSlash(commandName);
            if (result) slashError.push(`Unable to load command: ${commandName}\n > ${result}`);
        } catch (err) {
            return console.error(err);
        }
    });
    if (slashError.length) {
        Bot.logger.warn("slashLoad: " + slashError.join("\n"));
    }

    // Then we load events, which will include our message and ready event.
    const evtFiles = readdirSync(__dirname + "/events/");
    evtFiles.forEach(file => {
        const eventName = file.split(".")[0];
        const event = require(__dirname + `/events/${file}`);
        if (["ready", "interactionCreate", "messageCreate", "guildMemberAdd", "guildMemberRemove"].includes(eventName)) {
            client.on(eventName, event.bind(null, Bot, client));
        } else {
            client.on(eventName, event.bind(null, Bot));
        }
        delete require.cache[require.resolve(__dirname + `/events/${file}`)];
    });

    process.on("uncaughtException", (err) => {
        const errorMsg = err.stack.replace(new RegExp(`${process.cwd()}`, "g"), ".");
        console.error(`[${Bot.myTime()}] Uncaught Exception: ${errorMsg}`);

        // If it's that error, don't bother showing it again
        try {
            if (!errorMsg.startsWith("Error: RSV2 and RSV3 must be clear") && Bot.config.logs.logToChannel) {
                Bot.logger.error("```" + inspect(errorMsg) + "```");
            }
        } catch (e) {
            // Don't bother doing anything
        }
        // Always best practice to let the code crash on uncaught exceptions.
        // Because you should be catching them anyway.
        process.exit(1);
    });

    process.on("unhandledRejection", (err: Error) => {
        const errorMsg = err.stack.replace(new RegExp(process.cwd(), "g"), ".");

        // If it's something I can't do anything about, ignore it
        const ignoreArr = [
            "Internal Server Error",                // Something on Discord's end
            "Cannot send messages to this user",    // A user probably has the bot blocked or doesn't allow DMs (No way to check for that)
            "Unknown Message"                       // Not sure, but seems to happen when someone deletes a message that the bot is trying to reply to?
        ];
        if (ignoreArr.some(elem => errorMsg.includes(elem))) return;

        if (errorMsg.includes("ShardClientUtil._handleMessage") && errorMsg.includes("client is not defined")) {
            Bot.logger.error("The following error probably has to do with a 'client' inside a broadcastEval");
        }
        // console.log(err);
        console.error(`[${Bot.myTime()}] Uncaught Promise Error: ${errorMsg}`);
    });
};
