const { Client, Collection } = require("discord.js");
const { readdirSync, readFileSync } = require("fs");
const { inspect } = require("util");
const SwgohClientStub = require("swgoh-client-stub");

const Bot = {};

// Attach the config to the Bot so we can use it anywhere
Bot.config = require("./config.js");

const client = new Client({
    intents: Bot.config.botIntents,
    partials: Bot.config.partials
});

const Sequelize = require("sequelize");


// Attach the character and team files to the Bot so I don't have to reopen em each time
Bot.abilityCosts = JSON.parse(readFileSync("data/abilityCosts.json"));
Bot.acronyms     = JSON.parse(readFileSync("data/acronyms.json"));
Bot.arenaJumps   = JSON.parse(readFileSync("data/arenaJumps.json"));
Bot.charLocs     = JSON.parse(readFileSync("data/charLocations.json"));
Bot.characters   = JSON.parse(readFileSync("data/characters.json"));
Bot.factions     = [...new Set(Bot.characters.reduce((a, b) => a.concat(b.factions), []))];
Bot.missions     = JSON.parse(readFileSync("data/missions.json"));
Bot.resources    = JSON.parse(readFileSync("data/resources.json"));
Bot.shipLocs     = JSON.parse(readFileSync("data/shipLocations.json"));
Bot.ships        = JSON.parse(readFileSync("data/ships.json"));
Bot.squads       = JSON.parse(readFileSync("data/squads.json"));
Bot.emotes       = {};

const gameData   = JSON.parse(readFileSync("data/gameData.json"));

// Load in various general functions for the bot
require("./modules/functions.js")(Bot, client);

// Load in stuff for the events command
require("./modules/eventFuncs.js")(Bot, client);

// Load in stuff for patrons and such
require("./modules/patreonFuncs.js")(Bot, client);

// Load up js prototypes
require("./modules/prototypes.js");

// Languages
Bot.languages = {};
Bot.swgohLangList = ["ENG_US", "GER_DE", "SPA_XM", "FRE_FR", "RUS_RU", "POR_BR", "KOR_KR", "ITA_IT", "TUR_TR", "CHS_CN", "CHT_CN", "IND_ID", "JPN_JP", "THA_TH"];
client.reloadLanguages();

client.commands  = new Collection();
client.aliases   = new Collection();
client.slashcmds = new Collection();

Bot.evCountdowns = {};

Bot.talkedRecently = new Set();

Bot.seqOps = Sequelize.Op;
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
            }).catch((e) =>  Bot.logger.error("Error in init (Models.spread): " + e, true));
        }
    }).catch((e) => console.error(e));
});

const init = async () => {
    const MongoClient = require("mongodb").MongoClient;
    Bot.mongo = await MongoClient.connect(Bot.config.mongodb.url, { useNewUrlParser: true, useUnifiedTopology: true } );
    // Set up the caching
    Bot.cache   = require("./modules/cache.js")(Bot.mongo);
    Bot.userReg = require("./modules/users.js")(Bot);

    Bot.swgohPlayerCount = await Bot.mongo.db(Bot.config.mongodb.swapidb).collection("playerStats").find({}).count();
    Bot.swgohGuildCount  = await Bot.mongo.db(Bot.config.mongodb.swapidb).collection("guilds").find({}).count();

    Bot.statCalculator = require("swgoh-stat-calc");
    Bot.statCalculator.setGameData(gameData);

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

        // Load up the zeta recommendations
        Bot.zetaRec = await Bot.swgohAPI.zetaRec();
    }

    const Logger = require("./modules/Logger.js"); //(Bot, client);
    Bot.logger = new Logger(Bot, client);

    // Here we load **commands** into memory, as a collection, so they're accessible
    // here and everywhere else.
    const cmdFiles = readdirSync("./commands/");
    const cmdError = [];
    cmdFiles.forEach(file => {
        try {
            if (!file.endsWith(".js")) return;
            const commandName = file.split(".")[0];
            const result = client.loadCommand(commandName);
            if (result) cmdError.push(`Unable to load command: ${commandName}`);
        } catch (e) {
            Bot.logger.warn(`[INIT] Unable to load command ${file}: ${e}`);
        }
    });
    if (cmdError.length) {
        Bot.logger.warn("cmdLoad: " + cmdError.join("\n"));
    }

    const slashFiles = readdirSync("./slash/");
    const slashError = [];
    slashFiles.forEach(file => {
        try {
            if (!file.endsWith(".js")) return;
            const commandName = file.split(".")[0];
            const result = client.loadSlash(commandName);
            if (result) slashError.push(`Unable to load command: ${commandName}`);
        } catch (err) {
            return console.error(err);
        }
    });
    if (slashError.length) {
        Bot.logger.warn("slashLoad: " + slashError.join("\n"));
    }

    // Then we load events, which will include our message and ready event.
    const evtFiles = readdirSync("./events/");
    evtFiles.forEach(file => {
        const eventName = file.split(".")[0];
        const event = require(`./events/${file}`);
        if (["ready", "interactionCreate", "messageCreate", "guildMemberAdd", "guildMemberRemove"].includes(eventName)) {
            client.on(eventName, event.bind(null, Bot, client));
        } else {
            client.on(eventName, event.bind(null, Bot));
        }
        delete require.cache[require.resolve(`./events/${file}`)];
    });

    process.on("uncaughtException", (err) => {
        const errorMsg = err.stack.replace(new RegExp(`${process.cwd()}`, "g"), ".");
        console.error(`[${Bot.myTime()}] Uncaught Exception: ${errorMsg}`);

        // If it's that error, don't bother showing it again
        try {
            if (!errorMsg.startsWith("Error: RSV2 and RSV3 must be clear") && Bot.config.logs.logToChannel) {
                client.channels.cache.get(Bot.config.logs.channel).send("```inspect(errorMsg)```",{split: true});
            }
        } catch (e) {
            // Don't bother doing anything
        }
        // Always best practice to let the code crash on uncaught exceptions.
        // Because you should be catching them anyway.
        process.exit(1);
    });

    process.on("unhandledRejection", (err) => {
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
        try {
            if (Bot.config.logs.logToChannel) {
                client.channels.cache.get(Bot.config.logs.channel).send(`\`\`\`${inspect(errorMsg)}\`\`\``,{split: true});
            }
        } catch (e) {
            // Don't bother doing anything
        }
    });
};
