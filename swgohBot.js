const { Client, Collection } = require("discord.js");
const { promisify } = require("util");
const { inspect } = require("util");
const readdir = promisify(require("fs").readdir);
const fs = require("fs");

const client = new Client({
    // https://discord.js.org/#/docs/main/stable/typedef/ClientOptions?scrollTo=messageCacheLifetime
    messageCacheLifetime: 300, // How long a message should stay in the cache       (5min)
    messageSweepInterval: 120  // How frequently to remove messages from the cache  (2min)
});

const Sequelize = require("sequelize");

const Bot = {};

// Attach the config to the client so we can use it anywhere
Bot.config = require("./config.js");

// Attach the character and team files to the Bot so I don't have to reopen em each time
Bot.abilityCosts = JSON.parse(fs.readFileSync("data/abilityCosts.json"));
Bot.characters   = JSON.parse(fs.readFileSync("data/characters.json"));
Bot.charLocs     = JSON.parse(fs.readFileSync("data/charLocations.json"));
Bot.factions     = [...new Set(Bot.characters.reduce((a, b) => a.concat(b.factions), []))];
Bot.ships        = JSON.parse(fs.readFileSync("data/ships.json"));
Bot.shipLocs     = JSON.parse(fs.readFileSync("data/shipLocations.json"));
Bot.squads       = JSON.parse(fs.readFileSync("data/squads.json"));
Bot.missions     = JSON.parse(fs.readFileSync("data/missions.json"));
Bot.resources    = JSON.parse(fs.readFileSync("data/resources.json"));
Bot.arenaJumps   = JSON.parse(fs.readFileSync("data/arenaJumps.json"));
Bot.acronyms     = JSON.parse(fs.readFileSync("data/acronyms.json"));
Bot.emotes       = {};

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
client.reloadLanguages();
Bot.swgohLangList = ["ENG_US", "GER_DE", "SPA_XM", "FRE_FR", "RUS_RU", "POR_BR", "KOR_KR", "ITA_IT", "TUR_TR", "CHS_CN", "CHT_CN", "IND_ID", "JPN_JP", "THA_TH"];

client.commands = new Collection();
client.aliases = new Collection();

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
    await require("./modules/models")(Sequelize, Bot.database);

    // Get all the models
    const rawAttr = Bot.database.models.settings.rawAttributes;
    const rawNames = Object.keys(rawAttr);

    // Got through them all
    for (let ix = 0; ix < rawNames.length; ix++) {
        // Try getting each column
        await Bot.database.models.settings.findAll({limit: 1, attributes: [rawNames[ix]]})
        // If it doesn't exist, it'll throw an error, then it will add them
            .catch(async () => {
                console.log("Adding column " + rawNames[ix] + " to settings.");
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
        const guildList = client.guilds.cache.keyArray();
        for (let ix = 0; ix < guildList.length; ix++) {
            Bot.database.models.settings.findOrBuild({
                where: {
                    guildID: guildList[ix]
                }
            }).spread((gModel, initialized) => {
                if (initialized) {
                    return gModel.save();
                }
            }).catch((e) =>  console.log("Error: " + e));
        }
    }).catch((e) => console.error(e));
});

const init = async () => {
    const MongoClient = require("mongodb").MongoClient;
    Bot.mongo = await MongoClient.connect(Bot.config.mongodb.url, { useNewUrlParser: true, useUnifiedTopology: true } );
    // Set up the caching
    Bot.cache = await require("./modules/cache.js")(Bot.mongo);
    Bot.userReg = await require("./modules/users.js")(Bot);

    Bot.swgohPlayerCount = await Bot.mongo.db(Bot.config.mongodb.swapidb).collection("playerStats").find({}).count();
    Bot.swgohGuildCount  = await Bot.mongo.db(Bot.config.mongodb.swapidb).collection("guilds").find({}).count();

    Bot.statCalculator = require("swgoh-stat-calc");
    const gameData  = require("./data/gameData.json");
    Bot.statCalculator.setGameData( gameData );

    if (Bot.config.api_swgoh_help) {
        // Load up the api connector/ helpers
        const ApiSwgohHelp = require("api-swgoh-help");
        // Bot.swgoh = new ApiSwgohHelp(Bot.config.api_swgoh_help);
        Bot.swgoh = (Bot.config.fakeSwapiConfig && Bot.config.fakeSwapiConfig.enabled) ?
            new ApiSwgohHelp(Bot.config.fakeSwapiConfig.options) :
            new ApiSwgohHelp(Bot.config.swapiConfig);
        Bot.swgohAPI = require("./modules/swapi.js")(Bot);

        // Load up the zeta recommendstions
        Bot.zetaRec = await Bot.swgohAPI.zetaRec();
    }

    // Here we load **commands** into memory, as a collection, so they're accessible
    // here and everywhere else.
    const cmdFiles = await readdir("./commands/");
    cmdFiles.forEach(f => {
        try {
            const props = new(require(`./commands/${f}`))(Bot);
            if (f.split(".").slice(-1)[0] !== "js") return;
            if (props.help.category === "SWGoH" && !Bot.swgohAPI) return;
            client.loadCommand(props.help.name);
        } catch (e) {
            Bot.log("Init", `Unable to load command ${f}: ${e}`);
        }
    });

    // Then we load events, which will include our message and ready event.
    const evtFiles = await readdir("./events/");
    evtFiles.forEach(file => {
        const eventName = file.split(".")[0];
        const event = require(`./events/${file}`);
        if (eventName === "ready") {
            client.on(eventName, event.bind(null, Bot, client));
        } else {
            client.on(eventName, event.bind(null, Bot));
        }
        delete require.cache[require.resolve(`./events/${file}`)];
    });
};

client.on("error", (err) => {
    if (err.error.toString().indexOf("ECONNRESET") > -1) {
        console.log("Connection error");
    } else {
        Bot.log("ERROR", inspect(err.error));
    }
});
