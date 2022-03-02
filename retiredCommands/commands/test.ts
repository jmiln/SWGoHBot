const Command              = require("../base/Command");
const Discord              = require("discord.js");             // eslint-disable-line no-unused-vars
const {promisify, inspect} = require("util");                   // eslint-disable-line no-unused-vars
const moment               = require("moment-timezone");        // eslint-disable-line no-unused-vars
const { Op }               = require("sequelize");              // eslint-disable-line no-unused-vars
const readdir              = promisify(require("fs").readdir);  // eslint-disable-line no-unused-vars
const Sequelize            = require("sequelize");              // eslint-disable-line no-unused-vars
const fs                   = require("fs");                     // eslint-disable-line no-unused-vars
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));  // eslint-disable-line no-unused-vars
const cheerio              = require("cheerio");                // eslint-disable-line no-unused-vars
// const {codeBlock, findChar} = require("../modules/functionsV2.js");       // eslint-disable-line no-unused-vars
// const webshot = require("node-webshot");                     // eslint-disable-line no-unused-vars
// const puppeteer = require("puppeteer");                      // eslint-disable-line no-unused-vars
// const ejs = require("ejs");                                  // eslint-disable-line no-unused-vars

class Test extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "test",
            category: "Misc",
            hidden: true,
            enabled: true,
            aliases: ["t", "tests"],
            permissions: ["EMBED_LINKS"]
        });
    }

    async run(Bot, message, [...args], options) { // eslint-disable-line no-unused-vars
        const baseId = "SITHFIGHTER";             // eslint-disable-line no-unused-vars
        const language = "eng_us";                // eslint-disable-line no-unused-vars
        const allycode = "855211749";             // eslint-disable-line no-unused-vars
        const ac1 = "855211749";                  // eslint-disable-line no-unused-vars
        const ac2 = "999869238";                  // eslint-disable-line no-unused-vars
        const acGesh = "989765367";               // eslint-disable-line no-unused-vars
        const guildConf = await Bot.getGuildConf(message.guild.id); // eslint-disable-line no-unused-vars



        // const player = await Bot.swapiStub.getPlayer(allycode);
        // console.log(inspect(player.rosterUnit.find(b => b.definitionId.includes("MAUL")), {depth: 5}));

        // const response = await fetch("https://swgoh.gg/stats/mod-meta-report/guilds_100_gp/");
        // const ggPage = await response.text();
        //
        // const $ = cheerio.load(ggPage);
        //
        // const charOut = [];
        //
        // $("body > div.container.p-t-md > div.content-container > div.content-container-primary.character-list > ul > li:nth-child(3) > table > tbody > tr").each((i, elem) => {
        //     let [name, sets, receiver, holo, data, multiplexer] = $(elem).children();
        //     const defId = $(name).find("img").attr("data-base-id");
        //     const url = $(name).find("a").toArray().map(link => {
        //         return $(link).attr("href").trim();
        //     })[1];
        //     name = cleanName($(name).text());
        //     sets = $(sets).find("div").toArray().map(div => {
        //         return $(div).attr("data-title").trim();
        //     });
        //     receiver    = cleanModType($(receiver).text());
        //     holo        = cleanModType($(holo).text());
        //     data        = cleanModType($(data).text());
        //     multiplexer = cleanModType($(multiplexer).text());
        //     charOut.push({
        //         name:     name,
        //         defId:    defId,
        //         modsUrl:  "https://swgoh.gg" + url,
        //         sets:     sets,
        //         square:   "Offense",
        //         arrow:    receiver,
        //         diamond:  "Defense",
        //         triangle: holo,
        //         circle:   data,
        //         cross:    multiplexer
        //     });
        // });
        // function cleanModType(types) {
        //     if (!types || typeof types !== "string") return null;
        //     return types.trim().replace(/\s+\/\s/g, "/ ");
        // }
        // // This is mainly to clean up Padme's name for now
        // function cleanName(name) {
        //     if (!name || typeof name !== "string") return;
        //     return name.trim().replace("é", "e");
        // }
        // // console.log(charOut);


        // const charList = Bot.characters;
        //
        // const factionMap = require("../data/factionMap.js");
        // let search = "light side";
        // const mappedFaction = factionMap.find(fact => fact.name === Bot.toProperCase(search));
        // if (mappedFaction) search = mappedFaction.value;
        //
        // let factionList = await Bot.cache.get(Bot.config.mongodb.swapidb, "units", {categoryIdList: search, language: message.guildSettings.swgohLanguage.toLowerCase()}, {_id: 0, baseId: 1, nameKey: 1});
        //
        // // Filter out any ships that show up
        // factionList = factionList.filter(c => charList.find(char => char.uniqueName === c.baseId));
        //
        // const cooldown = await Bot.getPlayerCooldown(message.author.id);
        // let player = await Bot.swgohAPI.unitStats(allycode, cooldown);
        // if (Array.isArray(player)) player = player[0];
        // const roster = player.roster;
        //
        // if (!factionList.length) {
        //     return super.error(message, message.language.get("COMMAND_FACTION_USAGE", message.guildSettings.prefix), {title: message.language.get("COMMAND_FACTION_INVALID_FACTION"), example: "faction sith"});
        // } else {
        //     factionList = factionList.sort((a, b) => a.nameKey.toLowerCase() > b.nameKey.toLowerCase() ? 1 : -1);
        // }
        //
        // const fetchBody = {
        //     header: `${player.name}'s ${Bot.toProperCase(mappedFaction ? mappedFaction.name : search)}`,
        //     characters: [],
        //     lastUpdated: player?.updated ? player.updated : null
        // };
        // for (const char of factionList) {
        //     const thisChar = roster.find(ch => ch.defId === char.baseId);
        //     const thisBaseChar = charList.find(ch => ch.uniqueName === char.baseId);
        //     if (!thisChar) {
        //         continue;
        //     }
        //
        //     fetchBody.characters.push({
        //         defId:   thisChar.defId,
        //         name:    char.nameKey,
        //         charUrl: thisBaseChar.avatarURL,
        //         rarity:  thisChar.rarity,
        //         level:   thisChar.level,
        //         gear:    thisChar.gear,
        //         zetas:   thisChar.skills.filter(s => s.isZeta && s.tier == s.tiers).length,
        //         relic:   thisChar.relic?.currentTier ? thisChar.relic.currentTier : 0,
        //         side:    thisBaseChar.side
        //     });
        //
        // }
        //
        //
        // let charImg;
        // try {
        //     await fetch(Bot.config.imageServIP_Port + "/multi-char", {
        //         method: "post",
        //         body: JSON.stringify(fetchBody),
        //         headers: { "Content-Type": "application/json" }
        //     })
        //         .then(response => response.buffer())
        //         .then(image => {
        //             charImg = image;
        //         });
        // } catch (e) {
        //     Bot.logger.error("ImageFetch in test broke: " + e);
        // }
        //
        // if (!charImg) {
        //     return super.error(message, "Something went wrong, there's no image");
        // } else {
        //     return message.channel.send({
        //         content: `${player.name}'s ${Bot.toProperCase(mappedFaction.name)} results.\nLast updated: <t:${Math.floor(player.updated / 1000)}:R>`,
        //         files: [{
        //             attachment: charImg,
        //             name: "image.png"
        //         }]
        //     });
        // }



        // try {
        //     delete require.cache[require.resolve("../modules/functionsV2.js")];
        //     console.log("Deleted cache");
        // } catch (err) {
        //     return console.log(err);
        // }

        // if (!args.length) {
        //     return message.channel.send("Missing arg[0]");
        // }
        // console.log("Looking for: " + args.join(" "));
        // // const foundChar = findChar(args.join(" "), Bot.characters);
        // const foundChar = findChar(args.join(" "), Bot.ships, true);
        // console.log(foundChar);

        // console.log(inspect(message.member.reference, {depth: 5}));

        // const shardID = `${message.guild.id}-${message.channel.id}`;
        // const exists = await Bot.database.models.shardtimes.findOne({where: {id: shardID}})
        // console.log(exists);
        // console.log(exists.dataValues);


        // const query = "role_attacker";
        //
        // const units = await Bot.cache.get(Bot.config.mongodb.swapidb, "units",
        //     {categoryIdList: query, language: message.guildSettings.swgohLanguage.toLowerCase()},
        //     {_id: 0, baseId: 1, nameKey: 1, categoryIdList: 1}
        // );
        //
        // console.log(units);



        // Wipe out all the guild slash commands for the bot
        // await message.client.guilds.cache.get(message.guild.id)?.commands.set([]);

        // Wipe out all the global slash commands for the bot
        // await message.client.application?.commands.set([]);


        // Grabbing the changed commands to reload/ install or whatever
        // // The commands that are already sent to Discord and available
        // const coms = await message.client.guilds.cache.get(message.guild.id)?.commands.fetch();
        // console.log(coms.find(a => a.name === "need").options);

        // // The commands stored locally
        // const guildCmds = message.client.slashcmds.filter(c => c.guildOnly).map(c => c.commandData);

        // const comsToLoad = [];
        // guildCmds.forEach(cmd => {
        //     const thisCom = coms.find(c => c.name === cmd.name);
        //     let isDiff = false;
        //
        //     // If there's no match, it definitely goes in
        //     if (!thisCom) {
        //         console.log("Need to add " + cmd.name);
        //         return comsToLoad.push(cmd);
        //     } else {
        //         // Fill in various options info, just in case
        //         for (const ix in cmd.options) {
        //             if (!cmd.options[ix].required) cmd.options[ix].required = false;
        //             if (!cmd.options[ix].choices) cmd.options[ix].choices = undefined;
        //             if (!cmd.options[ix].options) cmd.options[ix].options = undefined;
        //
        //             for (const op of Object.keys(cmd.options[ix])) {
        //                 if (cmd.options[op] !== thisCom.options[op]) {
        //                     isDiff = true;
        //                     break;
        //                 }
        //             }
        //         }
        //         if (!cmd.defaultPermission) cmd.defaultPermission = true;
        //
        //         if (cmd?.description !== thisCom?.description) { isDiff = true; }
        //         if (cmd?.defaultPermission !== thisCom?.defaultPermission) { isDiff = true; }
        //     }
        //
        //     // If something has changed, stick it in there
        //     if (isDiff) {
        //         console.log("Need to update " + thisCom.name);
        //         comsToLoad.push(cmd);
        //     }
        // });
        // console.log(inspect(comsToLoad, {depth: 5}));

        // const comsToLoad = [];
        // coms.forEach(com => {
        //     const thisCom = guildCmds.find(c => c.name === com.name);
        //     if (!thisCom)
        // });

        // for (const thisCom of coms) {
        //     // const foundCom
        //     console.log(thisCom[0]);
        // }

        // console.log("Before");
        // console.log(message.client.guilds.cache.size);
        // console.log("After");

        // #### This batch is for remote activation of commands (Old style...)
        // const comObj = {
        //     com: "g",
        //     args: "-tickets -sort ticket",
        //     userId: message.author.id,
        //     chanId: "307413253758386186"
        // };
        // const comStr = `${guildConf.prefix}${comObj.com} ${comObj.args}`;
        //
        // // Testing emulating a command being run
        // const cmd = message.client.commands.get(comObj.com) || message.client.commands.get(message.client.aliases.get(comObj.com));
        // if (!cmd || !cmd.conf.enabled) return;
        //
        // // These will need to use broadcastEval so this can be running on the main shard or something probably
        // const user = await Bot.userReg.getUser(comObj.userId);
        // const chan = message.client.channels.cache.get(comObj.chanId);
        //
        // // TODO This needs to check current patreon status of the given user.
        // // TODO Then if they are not of the correct tier, ignore it.
        // // TODO If they are high enough, go ahead and run it through.
        // // TODO This needs to have a cooldown on it, maybe one pre-set message every 20 min or so, 5min for the higher tier
        //
        // // Limit per tier like this?
        // // $1  - 1  scheduledJob
        // // $5  - 3  scheduledJobs
        // // $10 - 10 scheduledJobs
        //
        // // New command, something like scheduleCommand, given the same sort of time/ date conditions as event?
        // // Or, a fancy flag in the event command/ each event, which if true, it'll run it as a command. This is probably better
        //
        // message.client.emit("messageCreate", {author: user, content: comStr, guild: chan.guild, channel: chan});

        // await Bot.database.models.eventDBs.update({eventMessage: "newTestMsg"}, {where: {eventID: "164183271796768768-test2" }})
        //     .then((up) => { console.log(`Updating repeating event ${up}.`); })
        //     .catch(error => { Bot.logger.error(`Broke trying to replace event: ${error}`); });

        // Bot.socket.emit("checkEvents", (eventsList) => {
        //     if (eventsList.length) {
        //         Bot.manageEvents(eventsList);
        //     }
        // });

        // const tmpEvent = {
        //     eventID: "164183271796768768-test2",
        //     eventDT: "1612318800000",
        //     eventMessage: "",
        //     eventChan: "",
        //     countdown: true,
        //     repeat: { repeatDay: 0, repeatMin: 0, repeatHour: 0 },
        //     repeatDays: [],
        // };
        // await message.client.announceMsg(message.guild, "TEST MESSAGE", message.channel.id, guildConf);
        // event, guildConf, guildID, announceMessage
        // await Bot.sendMsg(tmpEvent, guildConf, message.guild.id, "testingmsg here");


        // await Bot.socket.emit("checkEvents", (events) => {
        //     console.log(events);
        // });

        // await Bot.socket.emit("getEventsByID", "164183271796768768-testEv4", async function(events) {
        //     if (!Array.isArray(events)) events = [events];
        //     for (const event of events) {
        //         message.channel.send(codeBlock(inspect(event)));
        //     }
        // });

        // function shardIDForGuildID (guildID, shardCount) {
        //     const shard = Number(BigInt(guildID) >> 22n) % shardCount;
        //     if (shard < 0) throw new Error("SHARDING_SHARD_MISCALCULATION", shard, guildID, shardCount);
        //     return shard;
        // }

        // const client = message.client;
        // const guildConf   = await Bot.getGuildConf(message.guild.id);
        // const targetGuild = await client.guilds.cache.get(message.guild.id);
        // await message.client.shard.broadcastEval(`
        //     (async () => {
        //         let chan = this.channels.cache.get("${message.channel.id}");
        //         console.log("Here");
        //         await (${Bot.announceMsg})("${targetGuild}", "TESTING MSG HERE", null, ${JSON.stringify(guildConf)});
        //         console.log("Here2");
        //     })();
        // `);

        // const player = await Bot.swgoh.fetchPlayer({
        //     allycode: ac1
        // });

        // const player = await Bot.swgohAPI.getPlayersArena("782116313");
        // const player = await Bot.swgohAPI.getPlayersArena(ac1);
        // const player = await Bot.swgohAPI.unitStats(acGesh, null, {force: true});
        // console.log(`Got ${player.name}`);
        // const player = await Bot.swgoh.fetchPlayer({allycode: ac1});
        // const player = await Bot.swgohAPI.playerByName("rEApEr1395");
        // console.log(player);
        // player = player.result;
        // if (player && player.length) message.channel.send("Got player - Roster size: " + player[0].roster.length);
        // console.log(player);


        // console.log("Jobs before: ");
        // console.log(Bot.schedule.scheduledJobs);
        // const job = Bot.schedule.scheduledJobs["164183271796768768-test"];
        // console.log(job);

        // const event = {
        //     eventID: "test",
        //     eventDT: 1589639040000,
        //     eventMessage: "This is a test event",
        //     eventChan: "",
        //     countdown: "false"
        // };
        //
        //
        // Bot.schedule.scheduleJob(event.eventID, "*/2 * * * *", function() {
        //     Bot.eventAnnounce(event);
        // });
        // console.log("Jobs after: ");
        // console.log(Bot.schedule.scheduledJobs);

        // message.client.shard.broadcastEval("this.loadAllEmotes();");

        // console.log(inspect(message.client.ws.shards.firstKey()));
        // console.log(inspect(message.client.shard.ids[0]));
        // console.log(inspect(message.client.shard.ids[0]));
        // console.log(message.client.shard.count);

        // console.log(Bot.myTime());
        // console.log(Bot.swgohPlayerCount, Bot.swgohGuildCount);

        // const hook= new Discord.WebhookClient("620645965715603456", "cHtFx3DDN3DAHGoV4HePXGFJMSglkLqqQVq51oF5kNIQtWmcijHidhaIjSKmF6-6k0Ue");                          // eslint-disable-line no-unused-vars
        // const hookURL = "https://discordapp.com/api/webhooks/620645965715603456/cHtFx3DDN3DAHGoV4HePXGFJMSglkLqqQVq51oF5kNIQtWmcijHidhaIjSKmF6-6k0Ue";
        // if (args.length) {
        //     console.log(args);
        //     Bot.sendWebhook(hookURL, {
        //         description: args.join(" "),
        //         color: 0xffffff
        //     }) ;
        //     // hook.send(args.join(" "));
        //     // hook.send({embeds: [{
        //     //     // title: "test",
        //     //     description: args.join(" ")
        //     // }]});
        // }

        //// Uncomment here down to 113 for image arena
        // let allyCode = ac1;
        // if (action) {
        //     allyCode = await Bot.getAllyCode(message, action);
        //     if (Array.isArray(allyCode)) allyCode = allyCode[0];
        // }
        //
        // if (!allyCode) allyCode = ac1;
        //
        // const cooldown = await Bot.getPlayerCooldown(message.author.id);
        // const player = await Bot.swgohAPI.player(allyCode, null, cooldown);
        // if (!player) {
        //     return super.error(message, "I couldn't find that player, please make sure you've got the corect ally code.");
        // }
        //
        // const arena = [];
        // player.arena.char.squad.forEach(char => {
        //     const arenaChar = player.roster.find(c => c.defId === char.defId);
        //     if (arenaChar) {
        //         arenaChar.zetas = arenaChar.skills.filter(a => a.tier === 8 && a.isZeta).length;
        //         arena.push(arenaChar);
        //     }
        // });
        //
        // const statChars =  await nodeFetch("http://localhost:3201/char", {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify(arena)
        // }).then(res => res.json());
        //
        // statChars.forEach(c => {
        //     c.unit = arena.find(char => char.defId === c.unit);
        // });

        // console.log(statChars.map(c => c.unit.gear));


        // let out;
        //  --  Show the whole arena team
        // const numChar = arena.length + 1;
        // ejs.renderFile(__dirname + "/../ejsFiles/arena.ejs", {
        //     name: player.name,
        //     allyCode: player.allyCode,
        //     charRank: player.arena.char.rank,
        //     characters: statChars
        // }, (err, result) => {
        //     if (err) {
        //         console.log("info", "error encountered: " + err);
        //     } else {
        //         try {
        //             out = result;
        //         } catch (err) {
        //             if (err) {
        //                 throw err;
        //             }
        //         }
        //
        //     }
        // });

        //  --  Show just a single character
        // ejs.renderFile(__dirname + "/../ejsFiles/char.ejs", {
        //     char: statChars[0]
        // }, (err, result) => {
        //     if (err) {
        //         console.log("info", "error encountered: " + err);
        //     } else {
        //         out = result;
        //     }
        // });


        // console.log(out);

        // const charString = arena.map((c, ix) => `${ix}=${c}`).join("&");

        // console.log("Trying to get arena for " + player.name + "\n" + charString);

        // ss = await nodeFetch("http://localhost:3600/char/DARTHREVAN/7/85/13/3/2", {
        //     // url: "http://localhost:3600/char/DARTHREVAN/7/85/13/3/2",
        //     method: "GET",
        //     headers: { "Content-Type": "image/png" },
        //     encoding: null
        // })

        // const searchChar = args.length ? args.join(" ") : "Darth Sion";
        // const chars = Bot.findChar(searchChar, Bot.characters);
        // if (!searchChar) {
        //     return message.channel.send(message.language.get("BASE_SWGOH_MISSING_CHAR"));
        // }
        //
        // let character;
        // if (chars.length === 0) {
        //     return message.channel.send(message.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
        // } else if (chars.length > 1) {
        //     const charL = [];
        //     const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
        //     charS.forEach(c => {
        //         charL.push(c.name);
        //     });
        //     return message.channel.send(message.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
        // } else {
        //     character = chars[0];
        // }
        //
        // let ss;
        // await nodeFetch(Bot.config.imageServIP_Port + "/char/" + character.uniqueName + "/7/85/13/3/2/" + character.side)
        //     .then(response => response.buffer())
        //     .then(images => {
        //         ss = images;
        //     });
        //
        // return message.channel.send({
        //     embed: {
        //         description: "Some big long description here",
        //         thumbnail: {
        //             url: "attachment://image.png"
        //         }
        //     },
        //     files: [{
        //         attachment: ss,
        //         name: "image.png"
        //     }]
        // });

        // const browser = await puppeteer.launch({args: ["--no-sandbox"]});
        // const page = await browser.newPage();
        // try {
        //     await page.setViewport({width: 200, height: 200});
        //     await page.setContent(out);
        //     const ss = await page.screenshot({type: "png", omitBackground: true});
        //     // return message.channel.send({file: ss});
        //     return message.channel.send({
        //         embed: {
        //             description: "Some big long description here",
        //             thumbnail: {
        //                 url: "attachment://image.png"
        //             }
        //         },
        //         files: [{
        //             attachment: ss,
        //             name: "image.png"
        //         }]
        //     });
        // } catch (e) {
        //     console.log(e);
        // }

        // fs.writeFileSync("./arenaImages/out.html", out);
        // const filePath = "./arenaImages/" + player.allyCode + ".png";
        // webshot(out, filePath, {
        //     screenSize: {
        //         // width: 200 * numChar, height: 300    // Use this for the arena layout
        //         width: 200, height: 200     // Use this for the single character
        //     },
        //     siteType: "html"
        // }, function(err) {
        //     if (!err) {
        //         // It should have saved it successfully, so try and grab it
        //         return message.channel.send({file: filePath});
        //     } else {
        //         console.log("Failed");
        //         console.log(err);
        //     }
        // });

        // console.log(arena);
        // return message.channel.send(codeBlock(JSON.stringify(arena, null, 2), "json"));

        // await message.client.shard.broadcastEval(client => client.loadAllEmotes());
        // await message.client.shard.broadcastEval("this.loadAllEmotes();");
        // console.log(Bot.emotes);
        // message.channel.send({content: "Test: " + Bot.emotes[Object.keys(Bot.emotes)[0]]});

        // console.log("Running TEST");
        // console.log(message.client);

        // Bot.reloadLanguages();

        // if (action) {
        //     if (client.emotes[action]) {
        //         return message.channel.send("Emote: " + client.emotes[action]);
        //     } else {
        //         return super.error(message, "Can't find emote: `" + action + "`");
        //     }
        // } else {
        //     return message.channel.send("Emote: " + client.emotes["starActive"]);
        // }

        // console.log(client.emotes);

        // console.log("Getting Player");
        // const cooldown = client.getPlayerCooldown(message.author.id);
        // const player = await client.swgohAPI.player(ac1, null, cooldown);

        // let barePlayer = await client.swgoh.fetchPlayer({
        //     allyCode: [ac1]
        // });
        // if (Array.isArray(barePlayer.result)) barePlayer = barePlayer.result[0];
        // // console.log(inspect(barePlayer.roster[0], {depth: 5}));
        // const langed = await client.swgohAPI.langChar(barePlayer.roster.find(c => c.defId === baseId));
        //
        // console.log(inspect(langed, {depth: 5}));

        // console.log(inspect(barePlayer.roster[0].mods, {depth: 5}));
        //
        // var localized = await nodeFetch("http://localhost:3203/lang/eng_us", {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify(barePlayer.roster[0])
        // }).then(res => res.json());
        //
        // console.log(inspect(localized.mods, {depth: 5}));

        // if (!barePlayer) return console.log("Broke getting BARE");
        // else console.log("Got Bare Player");

        // console.log(barePlayer.result[0].roster);

        // const charStats = await nodeFetch("http://localhost:3201/char", {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify(barePlayer.result[0].roster)
        // }).then(res => res.json());

        // console.log(charStats);

        // const stats = await client.swgohAPI.unitStats(ac1, {player: 1});
        // // console.log(inspect(stats[0], {depth: 5}));
        // const units = stats[0].stats;
        // const ships = units.filter(u => u.unit.crew.length > 0);
        // console.log(inspect(ships[0], {depth: 5}));

        // message.channel.send("s".repeat(2444));
        // message.channel.send({embed: {
        //     fields: [
        //         {name: "test"}
        //     ]
        // }});

        // console.log(client.patrons);

        // await client.reloadPatrons();
        // console.log(client.patrons.map(p => p.discordID + ": " + p.amount_cents));
        // await client.getRanks();

        // const p = await client.userReg.getUser(client.config.ownerid);
        // console.log(p);

        // const player = await client.swgohAPI.fastPlayer(ac1);
        // console.log(player.arena);

        // const fetch = require("node-fetch");
        // const snek = require("snekfetch");
        // const player = await snek.get("http://localhost:1234/pipe/player/"+ac1);
        // console.log(JSON.parse(player.text));

        // const player = await client.swgohAPI.fastPlayer(ac1);
        // console.log(player);
        // return message.channel.send(client.codeBlock(inspect(player.arena), "json"));

        // console.log(client.config.defaultUserConf);

        // if (action === "remove") {
        //     const user = await client.userReg.getUser(message.author.id);
        //     if (!user) {
        //         return super.error(message, "That user is not registered, so I cannot remove them.");
        //     }
        //     const res = await client.userReg.removeUser(message.author.id);
        //     if (res) {
        //         return message.channel.send("Success!\nUser has been removed.");
        //     }
        //     return super.error(message, "Something went wrong when trying to remove that user");
        // }
        //
        // let user = await client.userReg.getUser(message.author.id);
        //
        // if (!user) {
        //     user = await client.userReg.addUser(message.author.id, ac1);
        // }
        //
        // console.log(inspect(user));
        //
        // if (!user.accounts.find(a => a.allyCode === ac2)) {
        //     user.accounts.push({
        //         allyCode: ac2,
        //         primary: false
        //     });
        //     delete user._id;
        //     client.userReg.updateUser(message.author.id, user);
        // }
        //
        // return message.channel.send(`**${message.author.username}** is linked to:\n${user.accounts.map(a => a.primary ? "**" + a.allyCode + "**" : a.allyCode).join("\n")}`);









        // const unit = await client.swgohAPI.getCharacter(baseId, message.guildSettings.swgohLanguage);
        // console.log(unit);

        // const shardsLeftAtStar = {
        //     0: 330,
        //     1: 320,
        //     2: 305,
        //     3: 280,
        //     4: 250,
        //     5: 185,
        //     6: 100
        // };
        // const {searchChar, allyCode, err} = await super.getUserAndChar(message, args, true);   // eslint-disable-line no-unused-vars
        // if (err) {
        //     return super.error(message, err);
        // }
        // if (!allyCode) {
        //     return super.error(message, "In order to use this command, you must either register or enter an ally code.");
        // }
        // let search = searchChar.replace(/[^\w\s]/g, "").replace(/s$/, "");
        // if (search.toLowerCase() === "galactic republic") search = "affiliation_republic";
        // if (search.toLowerCase() === "galactic war") search = "gw";
        //
        //
        // const cooldown = client.getPlayerCooldown(message.author.id);
        // const player = await client.swgohAPI.player(allyCode, null, cooldown);
        // if (!player) {
        //     // Could not find the player, possible api issue?
        //     return super.error(message, "I couldn't find that player, please make sure you've got the corect ally code.");
        // }
        //
        // let outChars = [];
        // let outShips = [];
        //
        // let units = client.charLocs.filter(c => c.locations.filter(l => l.type.toLowerCase().includes(search)).length);
        // units = units.concat(client.shipLocs.filter(s => s.locations.filter(l => l.type.toLowerCase().includes(search)).length));
        // for (const c of units) {
        //     let char = client.characters.find(char => char.name.toLowerCase() === c.name.toLowerCase());
        //     if (!char) {
        //         char = client.ships.find(char => char.name.toLowerCase() === c.name.toLowerCase());
        //     }
        //     if (!char) continue;
        //     c.baseId = char.uniqueName;
        //     c.nameKey = c.name;
        // }
        //
        // if (!units.length) {
        //     const query = new RegExp(`^(?!.*selftag).*${search}.*`, "gi");
        //     units = await client.cache.get("swapi", "units",
        //         {categoryIdList: query, language: message.guildSettings.swgohLanguage.toLowerCase()},
        //         {_id: 0, baseId: 1, nameKey: 1}
        //     );
        // }
        //
        // const totalShards = units.length * shardsLeftAtStar[0];
        // let shardsLeft = 0;
        // for (const unit of units) {
        //     let u = player.roster.find(c => c.defId === unit.baseId);
        //     if (!u) continue;
        //     if (u.rarity === 7) continue;
        //     shardsLeft += shardsLeftAtStar[u.rarity];
        //     u = await client.swgohAPI.langChar(u, message.guildSettings.swgohLanguage);
        //     if (client.characters.find(c => c.uniqueName === unit.baseId)) {
        //         // It's a character
        //         outChars.push({
        //             rarity: u.rarity,
        //             name: u.nameKey
        //         });
        //     } else if (client.ships.find(s => s.uniqueName === unit.baseId)) {
        //         // It's a ship
        //         outShips.push({
        //             rarity: u.rarity,
        //             name: u.nameKey
        //         });
        //     } else {
        //         // It's neither and shouldn't be there
        //         continue;
        //     }
        // }
        // outChars = outChars.sort((a,b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
        // outShips = outShips.sort((a,b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
        //
        // const fields = [];
        // fields.push({
        //     name: "__Characters:__",
        //     value: outChars.length ? outChars.map(c => `\`${c.rarity}*\` ${c.name}`).join("\n") : "Congrats, you have all the characters at 7*"
        // });
        // fields.push({
        //     name: "__Ships:__",
        //     value: outShips.length ? outShips.map(s => `\`${s.rarity}*\` ${s.name}`).join("\n") : "Congrats, you have all the ships at 7*"
        // });
        //
        // return message.channel.send({embed: {
        //     author: {
        //         name: `${player.name}'s ${searchChar.toProperCase()} needs`
        //     },
        //     description: `You're about **${(((totalShards - shardsLeft)/ totalShards) * 100).toFixed(1)}%** complete`,
        //     fields: fields
        // }});





        // const chars = await client.cache.get("swapi", "units", {categoryIdList: /tank/gi, language: "eng_us"}, {_id: 0, baseId: 1, nameKey: 1});


        // const role = args.join();
        //
        // const foundRole = message.guild.roles.find(r => r.name.toLowerCase() === role.toLowerCase() || r.id === role.replace(/[^\d]/g, ""));
        // if (!foundRole) {
        //     return super.error(message, "Cannot find role `" + role + "`. Make sure you have it spelled correctly.");
        // }
        //
        // const members = foundRole.members.sort((m, n) => m.displayName.toLowerCase() > n.displayName.toLowerCase() ? 1 : -1).map(m => `<@${m.id}>`);
        // const numPer = 3;
        // const fields = [];
        // for (let ix = 0; ix < members.length; ix += numPer) {
        //     fields.push({
        //         name: ix,
        //         value: members.slice(ix, ix+numPer).join("\n")
        //     });
        // }
        // return message.channel.send({embed: {
        //     author: {name: "Showing " + foundRole.name},
        //     fields: fields
        // }});







        // const mats = await client.swgoh.fetchAPI("/swgoh/data", {
        //     collection: "materialList",
        //     enums: true,
        //     match: {
        //         id: "unitshard_DARTHTRAYA"
        //     }
        // });
        // console.log(inspect(mats.result[0], {depth: 5}));

        // const unit = await client.swgoh.fetchAPI("/swgoh/data", {
        //     collection: "unitsList",
        //     language: language,
        //     enums: true,
        //     match: {
        //         "rarity": 7,
        //         "baseId": baseId
        //     },
        //     project: {
        //         baseId: 1,
        //         skillReferenceList: 1,
        //         categoryIdList: 1,
        //         crewList: 1
        //     }
        // });
        // console.log(inspect(unit.result[0].crewList, {depth: 5}));
        // if (!args[0]) {
        //     return message.channel.send("Need an argument");
        // }
        //
        // const [hour, minute] = args[0].split(":");
        //
        // const time = moment.tz("us/pacific").add(hour, "h").add(minute, "m").format("HH:mm");
        // console.log("Time: " + moment.tz("us/pacific").format("hh:mma") + " - " + time + " vs " + moment.tz("us/pacific").format("hh:mma"));
        //
        // const roundTime = (time, minutesToRound) => {
        //
        //     let [hours, minutes] = time.split(":");
        //     hours = parseInt(hours);
        //     minutes = parseInt(minutes);
        //
        //     // Convert hours and minutes to time in minutes
        //     time = (hours * 60) + minutes;
        //
        //     const rounded = Math.round(time / minutesToRound) * minutesToRound;
        //     const rHr = ""+Math.floor(rounded / 60);
        //     const rMin = ""+ rounded % 60;
        //
        //     return rHr.padStart(2, "0")+":"+rMin.padStart(2, "0");
        // };
        //
        // message.channel.send(`The time you specified is closest to ${roundTime(time, 15)}`);


        // const count = super.argCount(args);
        // return message.channel.send(count);

        // message.channel.send("Getting info");

        // const char = await client.swgohAPI.getCharacter("JEDIKNIGHTREVAN");
        // const char = await client.swgohAPI.character("NIGHTSISTERZOMBIE");
        // const char = await client.swgohAPI.character("BISTAN");
        //
        // for (const s of char.skillReferenceList) {
        //     // console.log(s);
        //     let skill = await client.swgohAPI.abilities([s.skillId], language);
        //     if (Array.isArray(skill)) {
        //         skill = skill[0];
        //     }
        //     // console.log(skill);
        //     s.name = skill.nameKey;
        //     s.cooldown = skill.cooldown;
        //     s.desc = skill.descKey
        //         .replace(/\\n/g, " ")
        //         .replace(/(\[\#<{(|c*-*\]|\[[\w\d]{6}\])/g,"");
        //     if (skill.tierList.length) {
        //         s.cost = costs[skill.tierList[skill.tierList.length - 1].recipeId];
        //     }
        // }
        //
        // for (const tier of char.unitTierList) {
        //     const eqList = await client.swgohAPI.gear(tier.equipmentSetList, language);
        //     console.log(eqList);
        //     tier.equipmentSetList.forEach((e, ix) => {
        //         const eq = eqList.find(equipment => equipment.id === e);
        //         tier.equipmentSetList.splice(ix, 1, eq.nameKey);
        //     });
        // }

        // console.log(char);

        // message.channel.send(client.codeBlock(inspect(char, {depth: 5})), {split: true});

        // const skills = await client.swgoh.fetchAPI("/swgoh/data", {
        //     "collection": "skillList",
        //     "language": language,
        //     "enums":true,
        //     "project": {
        //         "id":1,
        //         "abilityReference":1,
        //         "tierList": 1,
        //         "isZeta":1
        //     }
        // });
        // console.log(inspect(skills.filter(s => s.id.toLowerCase().includes("boba")), {depth: 5}));
        //
        // const abilities = await client.swgoh.fetchAPI("/swgoh/data", {
        //     "collection": "abilityList",
        //     "language": language,
        //     "enums":true,
        //     "project": {
        //         "id":1,
        //         "type":1,
        //         "nameKey":1,
        //         "descKey":1,
        //         "cooldown": 1,
        //         "tierList": {
        //             descKey: 1
        //         }
        //     }
        // });
        // console.log(inspect(abilities, {depth: 6}));
        // console.log(inspect(abilities.filter(a => a.id.toLowerCase().includes("bistan")), {depth: 6}));
        //
        // abilities.forEach(a => {
        //     const skill = skills.find(s => s.abilityReference === a.id);
        //     if (skill) {
        //         a.isZeta = skill.isZeta;
        //         a.skillId = skill.id;
        //         a.language = language;
        //     }
        // });
        //
        // console.log(abilities);

        // console.log(abilities.find(s => s.id.toLowerCase().includes("fett")));
        // console.log(inspect(abilities.find(s => s.id === "specialability_bobafett01"), {depth: 5}));


        // Use this for the stuff that's just keys, like abilities and gear
        // const baseCharacters = await client.swgoh.fetchAPI("/swgoh/data", {
        //     "collection": "unitsList",
        //     "match": {
        //         "rarity": 7
        //     },
        //     "project": {
        //         "baseId": 1,
        //         "combatType": 1,
        //         "skillReferenceList": 1,
        //         "categoryIdList": 1,
        //         "unitTierList": {
        //             "tier": 1,
        //             "equipmentSetList": 1
        //         }
        //     }
        // });
        //
        // const fett = baseCharacters.find(c => c.baseId === "BOBAFETT");
        // fett.factions = [];
        // fett.categoryIdList.forEach(c => {
        //     if (c.startsWith("profession_") || c.startsWith("role_")) {
        //         let faction = c.split("_")[1];
        //         if (faction === "bountyhunter") faction = "bounty hunter";
        //         fett.factions.push(faction);
        //     }
        // });
        // delete fett.categoryIdList;
        //
        // fett.skillReferenceList = skills.filter(s => s.id.includes(fett.baseId));
        //
        // const fett = await client.swgohAPI.character("BOBAFETT", true);
        // console.log(inspect(fett, {depth: 5}));
        // console.log(inspect(baseCharacters.filter(c => c.baseId === "BOBAFETT"), {depth: 5}));

        // const abilityList = ["basicskill_BOBAFETT", "specialskill_BOBAFETT01"];
        // const abilities = await client.swgohAPI.skills(abilityList, null, true);
        // console.log(abilities);

        // Use this for the language specific parts, to store per-language
        // const langChar = await client.swgoh.fetchAPI("/swgoh/data", {
        //     "collection": "unitsList",
        //     "language": "eng_us",
        //     "enums":true,
        //     "match": {
        //         "rarity": 7
        //     },
        //     "project": {
        //         "baseId": 1,
        //         "nameKey": 1,
        //         "descKey": 1,
        //     }
        // });
        //
        // console.log(inspect(langChar.filter(c => c.baseId === "BOBAFETT"), {depth: 5}));


        // const gear = await client.swgoh.fetchAPI("/swgoh/data", {
        //     "collection": "equipmentList",
        //     "language": "eng_us",
        //     "enums":true,
        //     "project": {
        //         "id": 1,
        //         "nameKey": 1,
        //         "recipeId": 1,
        //         "mark": 1
        //     }
        // });
        //
        //
        // console.log(inspect(gear.filter(g => g.id === "108"), {depth: 5}));

        // const gear = await client.swgohAPI.gear(["108"], "eng_us", true);
        // console.log(gear);

        // const gear = await client.swgoh.fetchAPI("/swgoh/data", {
        //     "collection": "recipeList",
        //     "language": "eng_us",
        //     "enums":true,
        //     project: {
        //         "id": 1,
        //         "nameKey": 1,
        //         "descKey": 1,
        //         "ingredientsList": 1
        //     }
        // });
        //
        //
        // console.log(inspect(gear.filter(g => g.id === "recipe108"), {depth: 5}));



        // const recipe = await client.swgoh.fetchAPI("/swgoh/data", {
        //     "collection": "recipeList",
        //     "language": language,
        //     "enums":true,
        //     "project": {
        //         "id":1,
        //         "nameKey":1,
        //         "descKey":1,
        //         "result": 1,
        //         "ingredientsList": 1,
        //         "craftRequirement": 1
        //     }
        // });
        // console.log(inspect(recipe.filter(id => id.id === "SKILLRECIPE_SPECIAL_T1"), {depth: 5}));


        // const mat = await client.swgoh.fetchAPI("/swgoh/data", {
        //     "collection": "materialList",
        //     "language": language,
        //     "enums":true,
        //     "project": {
        //         "id":1,
        //         "nameKey":1,
        //         "descKey":1
        //     }
        // });
        // console.log(inspect(mat.filter(id => id.id === "ability_mat_A"), {depth: 5}));


        // await client.swgohAPI.recipes([], null, true);
        // await client.swgohAPI.materials([], null, true);









        //     const modsetBonuses = {
        //         'Health': { setName: 'Health %', set: 2, min: 2.5, max: 5 },
        //         'Defense': { setName: 'Defense %', set: 2, min: 2.5, max: 5 },
        //         'Crit Damage': { setName: 'Critical Damage %', set: 4, min: 15, max: 30 },
        //         'Crit Chance': { setName: 'Critical Chance %', set: 2, min: 2.5, max: 5 },
        //         'Tenacity': { setName: 'Tenacity %', set: 2, min: 5, max: 10 },
        //         'Offense': { setName: 'Offense %', set: 4, min: 5, max: 10 },
        //         'Potency': { setName: 'Potency %', set: 2, min: 5, max: 10 },
        //         'Speed': { setName: 'Speed %', set: 4, min: 5, max: 10 }
        //     };
        //
        //     let player = null;
        //     try {
        //         player = await client.swgohAPI.getPlayer( allycode, language, 6 );
        //     } catch(e) {
        //         console.error(e);
        //     }
        //     // player.roster = player.roster.filter(c => c.name === 'Death Trooper');
        //     // player.roster = player.roster.filter(c => c.name === 'Darth Sion');
        //     // player.roster = player.roster.filter(c => c.name === 'Darth Vader');
        //     player.roster = player.roster.filter(c => c.name === 'Han Solo');
        //
        //     player.roster.forEach(c => {
        //         let gearStr = ['   [0]  [3]', '[1]        [4]', '   [2]  [5]'].join('\n');
        //         let abilities = {
        //             basic: [],
        //             special: [],
        //             leader: [],
        //             unique: []
        //         };
        //         c.equipped.forEach(e => {
        //             gearStr = gearStr.replace(e.slot, 'X');
        //         });
        //         [0,1,2,3,4,5].forEach(n => gearStr = gearStr.replace(n, ' '));
        //         // const longest = c.skills.reduce((long, str) => Math.max(long, str.name.length), 0);
        //         c.skills.forEach(a => {
        //             if (a.tier === 8) {
        //                 if (a.isZeta) {
        //                     a.tier = '✦';
        //                 } else {
        //                     a.tier = '⯂';
        //                 }
        //             }
        //             abilities[`${a.type.toLowerCase()}`].push(`\`Lvl ${a.tier} [${a.type.charAt(0)}]\` ${(a.isZeta && a.tier === 8) ? 'z' : ''}${a.name}`)
        //             // abilities.push(`${a.name}${" ".repeat(longest - a.name.length)}: Level ${a.tier === 8 ? '**Maxed**' : a.tier} (${a.type})`)
        //         })
        //         const abilitiesOut = abilities.basic
        //             .concat(abilities.special)
        //             .concat(abilities.leader)
        //             .concat(abilities.unique)
        //         const mods = {};
        //         const sets = {};
        //         console.log(c.mods)
        //         c.mods.forEach(m => {
        //             if (!sets[m.set]) {
        //                 sets[m.set] = {};
        //                 sets[m.set].count = 1;
        //                 sets[m.set].lvls = [m.level];
        //             } else {
        //                 sets[m.set].count += 1;
        //                 sets[m.set].lvls.push(m.level);
        //             }
        //             if (['Critical Chance', 'Critical Damage'].includes(m.primaryBonusType)) {
        //                 m.primaryBonusType = m.primaryBonusType + ' %'
        //             }
        //             if (!mods[m.primaryBonusType]) {
        //                 mods[m.primaryBonusType] = parseFloat(m.primaryBonusValue);
        //             } else {
        //                 mods[m.primaryBonusType] += parseFloat(m.primaryBonusValue);
        //             }
        //             for (let ix = 1; ix <= 4; ix++) {
        //                 if (!m[`secondaryType_${ix}`].length) break;
        //                 if (m[`secondaryType_${ix}`] === 'Critical Chance') {
        //                     m[`secondaryType_${ix}`] = m[`secondaryType_${ix}`] + ' %';
        //                 }
        //                 if (!mods[m[`secondaryType_${ix}`]]) {
        //                     mods[m[`secondaryType_${ix}`]] = parseFloat(m[`secondaryValue_${ix}`]);
        //                 } else {
        //                     mods[m[`secondaryType_${ix}`]] += parseFloat(m[`secondaryValue_${ix}`]);
        //                 }
        //             }
        //         });
        //         const setBonuses = {};
        //         Object.keys(sets).forEach(s => {
        //             const set = sets[s];
        //
        //             // If there are not enough of the set to form a full set, don't bother
        //             console.log('Count: ' + set.count);
        //             if (set.count < modsetBonuses[s].set) return;
        //
        //             // See how manny sets there are
        //             const setNum = parseInt(set.count / modsetBonuses[s].set);
        //             console.log('SetNum: ' + setNum);
        //
        //             // Count the max lvl ones
        //             for (let ix = setNum; ix > 0; ix--) {
        //                 const maxCount = set.lvls.filter(lvl => lvl === 15).length;
        //                 const underMax = set.lvls.filter(lvl => lvl < 15).length;
        //                 console.log('maxCount: ' + maxCount);
        //                 // If there are not enough maxed ones, just put the min bonus in
        //                 let remCount = 0;
        //                 if (maxCount < modsetBonuses[s].set) {
        //                     if (!setBonuses[s]) {
        //                         setBonuses[s] = modsetBonuses[s].min;
        //                     } else {
        //                         setBonuses[s] += modsetBonuses[s].min;
        //                     }
        //                     if (underMax >= modsetBonuses[s].set) {
        //                         const tmp = set.lvls.filter(lvl => lvl < 15);
        //                         for (let jx = 0; jx < modsetBonuses[s].set; jx++) {
        //                             set.lvls.splice(set.lvls.indexOf(tmp[jx]), 1);
        //                         }
        //                     } else {
        //                         const tmp = set.lvls.filter(lvl => lvl < 15);
        //                         tmp.forEach(t => {
        //                             set.lvls.splice(set.lvls.indexOf(t), 1);
        //                             remCount += 1;
        //                         });
        //                         for (let jx = remCount; jx < modsetBonuses[s].set; jx++) {
        //                             set.lvls.splice(0, 1);
        //                         }
        //                     }
        //                 } else {
        //                     if (!setBonuses[s]) {
        //                         setBonuses[s] = modsetBonuses[s].max;
        //                     } else {
        //                         setBonuses[s] += modsetBonuses[s].max;
        //                     }
        //                     for (let jx = 0; jx < modsetBonuses[s].set; jx++) {
        //                         set.lvls.splice(set.lvls.indexOf(15), 1);
        //                     }
        //                 }
        //                 console.log(set)
        //             }
        //         });
        //         let setOut = [];
        //         for (let s in setBonuses) {
        //             setOut.push(`+${setBonuses[s]}% ${s}`);
        //         }
        //
        //         let modOut = [];
        //         const sMods = Object.keys(mods).sort((p, c) => p > c ? 1 : -1);
        //         sMods.forEach(m => {
        //             if (m.endsWith('%')) {
        //                 modOut.push(`+${mods[m].toFixed(2)}% **${m.split(' ').slice(0, -1).join(' ')}**`);
        //             } else {
        //                 modOut.push(`+${mods[m]}a **${m}**`);
        //             }
        //         })
        //             console.log(mods);
        //         // console.log(setBonuses);
        //         message.channel.send({embed: {
        //             author: {
        //                 name: c.name
        //             },
        //             description:
        //                 [
        //                     `\`Lvl ${c.level} | ${c.rarity}* | ${parseInt(c.gp)} gp\``,
        //                     `Gear: ${c.gear}`,
        //                     `${gearStr}`
        //                 ].join('\n'),
        //             fields: [
        //                 {
        //                     name: 'Abilities',
        //                     value: abilitiesOut.join('\n')
        //                 },
        //                 {
        //                     name: 'Mod set bonuses',
        //                     value: setOut.join('\n')
        //                 },
        //                 {
        //                     name: 'Mod stats',
        //                     value: modOut.join('\n')
        //                 }
        //             ]
        //         }})
        //
        //     });














        // // Get all the models
        // const rawAttr = client.database.models.settings.rawAttributes;
        // // const rawNames = Object.keys(rawAttr);
        //
        // console.log(Object.keys(rawAttr).map(d => {
        //     const t = rawAttr[d].type.toString();
        //     if (t === 'TEXT') {
        //         return `${d} - TEXT`;
        //     } else if (t === 'TEXT[]') {
        //         return `${d} - TEXT ARRAY`;
        //     } else if (t === 'BOOLEAN') {
        //         return `${d} - BOOL`;
        //     } else if (t === 'INTEGER') {
        //         return `${d} - INT`;
        //     } else if (t === 'INTEGER[]') {
        //         return `${d} - INT ARRAY`;
        //     }
        //     return `${d} - t1: ${rawAttr[d].type}`;
        // }));

        // // Got through them all
        // for (let ix = 0; ix < rawNames.length; ix++) {
        //     // Try getting each column
        //     await client.database.models.settings.findAll({limit: 1, attributes: [rawNames[ix]]})
        //         // If it doesn't exist, it'll throw an error, then it will add them
        //         .catch(async () => {
        //             await client.database.queryInterface.addColumn('settings',
        //                 rawNames[ix],
        //                 {
        //                     type: rawAttr[rawNames[ix]].type,
        //                     defaultValue: rawAttr[rawNames[ix]].defaultValue !== null ? rawAttr[rawNames[ix]].defaultValue : null
        //                 }
        //             );
        //         });
        // }


        // client.database.queryInterface.addColumn('settings', 'prefix', {type: Sequelize.TEXT});
        // console.log(inspect(Object.keys(client.database.models.settings.rawAttributes)));
        // console.log(client.database.queryInterface.showAllSchemas());

        // const me = await client.database.models.allyCodes.findOne({where: {id: message.author.id}});
        // client.database.models.commands.findAll({
        //     limit: 1,
        //     order: [ [ 'createdAt', 'DESC' ]]
        // }).then(function(entries) {
        //     message.channel.send('Last: ' + inspect(entries[0].dataValues));
        // });
        // console.log(client.sequelize);
        // console.log(me.dataValues);
        // let searchChar;
        // // Get the user's ally code from the message or psql db
        // if (!userID) {
        //     userID = message.author.id;
        // }
        // if (userID === "me" || client.isUserID(userID) || client.isAllyCode(userID)) {
        //     userID = await client.getAllyCode(message, userID);
        //     if (!userID.length) {
        //         return message.channel.send('I cannot find that user.');
        //     }
        //     userID = userID[0];
        // } else {
        //     searchChar = userID;
        //     searchChar += args.length ? ' ' + args.join(' ') : '';
        //     userID = await client.getAllyCode(message, message.author.id);
        // }
        //
        // try {
        //     const player = await client.swgohAPI.getPlayer(userID, 'ENG_US');
        //     console.log('Player: ' + inspect(player));
        //     // userID = player.guildName;
        // } catch (e) {
        //     console.error(e);
        // }

        // let guild = null;
        // try {
        //     const swData = require('../swgohAPI/swgohService/swgohData');
        //     guild = await swData.query('getGuildRoster', {guildName: userID});
        // } catch (e) {
        //     console.log('ERROR: ' + e);
        // }
        //
        // if (!guild || !guild.length) {
        //     return message.channel.send('I cannot find any users for that guild. \nPlease make sure you have spelled the name correctly, and that the capitalization is correct.');
        // }
        // const sortedGuild = guild.sort((p, c) => p.name.toLowerCase() > c.name.toLowerCase() ? 1 : -1);
        //
        // // Used for guildsearch
        // const chars = {};
        // for (const member of sortedGuild) {
        //     const charL = member.roster.filter(c => c.name === 'NIGHTSISTERZOMBIE');
        //     if (charL.length) {
        //         if (!chars[charL[0].rarity]) {
        //             chars[charL[0].rarity] = [member.name];
        //         } else {
        //             chars[charL[0].rarity].push(member.name);
        //         }
        //     }
        // }
        //
        // const fields = [];
        // Object.keys(chars).forEach(star => {
        //     fields.push({
        //         name: `${star} Star (${chars[star].length})`,
        //         value: chars[star].join('\n')
        //     });
        // });
        //
        // message.channel.send({embed: {
        //     author: {
        //         name: `${userID}'s ____'`
        //     },
        //     fields: fields
        // }});

        // let totalGP = 0;
        // const users = [];
        // sortedGuild.forEach(p => {
        //     totalGP += parseInt(p.gpFull);
        //     users.push(`\`[${' '.repeat(9 - p.gpFull.toLocaleString().length) + p.gpFull.toLocaleString()} GP]\` - **${p.name}**`);
        // });
        // const averageGP = Math.floor(totalGP/users.length);
        // message.channel.send({embed: {
        //     author: {
        //         name: `${users.length} Players in ${userID}`
        //     },
        //     description: options.flags.min ? '' : users.join('\n'),
        //     fields: [
        //         {
        //             name: 'Registered Guild GP',
        //             value: '```Total GP: ' + totalGP.toLocaleString() + '\nAverage : ' + averageGP.toLocaleString() + '```'
        //         }
        //     ]
        // }});
    }
}

module.exports = Test;












// Get character and allyCode from input
// if (searchChar) searchChar = searchChar.join(' ');
//
// // Need to get the allycode from the db, then use that
// if (!userID) {
//     return message.channel.send(message.language.get('BASE_SWGOH_MISSING_CHAR'));
// } else if (userID === "me") {
//     userID = message.author.id;
// } else if (userID.match(/\d{17,18}/)) {
//     userID = userID.replace(/[^\d]|)}>#g, '');
// } else {
//     // If they're just looking for a character for themselves, get the char
//     searchChar = userID + ' ' + searchChar;
//     searchChar = searchChar.trim();
//     userID = message.author.id;
// }
// const chars = client.findChar(searchChar, client.characters);
// let character;
// if (!searchChar) {
//     return message.channel.send(message.language.get('BASE_SWGOH_MISSING_CHAR'));
// }
//
// if (chars.length === 0) {
//     return message.channel.send(message.language.get('BASE_SWGOH_NO_CHAR_FOUND', searchChar));
// } else if (chars.length > 1) {
//     const charL = [];
//     const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
//     charS.forEach(c => {
//         charL.push(c.name);
//     });
//     return message.channel.send(message.language.get('BASE_SWGOH_CHAR_LIST', charL.join('\n')));
// } else {
//     character = chars[0];
// }
//
// if (!client.users.get(userID)) {
//     return message.channel.send(message.language.get('BASE_SWGOH_NO_USER'));
// }
// const ally = await client.allyCodes.findOne({where: {id: userID}});
// if (!ally) {
//     return message.channel.send(message.language.get('BASE_SWGOH_NOT_REG', client.users.get(userID).tag));
// }
// const allyCode = parseInt(ally.dataValues.allyCode);
// console.log('Ally Code: ' + allyCode);
