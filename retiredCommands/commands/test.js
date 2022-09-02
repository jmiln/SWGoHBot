const {promisify, inspect} = require("util");      // eslint-disable-line no-unused-vars
const Command = require("../base/Command");
const moment = require("moment-timezone");       // eslint-disable-line no-unused-vars
const { Op } = require("sequelize");    // eslint-disable-line no-unused-vars
const readdir = promisify(require("fs").readdir);       // eslint-disable-line no-unused-vars
const Sequelize = require("sequelize");         // eslint-disable-line no-unused-vars
const npmAsync = require("async");// eslint-disable-line no-unused-vars
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args)); // eslint-disable-line no-unused-vars
const fs = require("fs");  // eslint-disable-line no-unused-vars
const cheerio = require("cheerio");


class Test extends Command {
    constructor(client) {
        super(client, {
            name: "test",
            category: "Dev",
            hidden: true,
            enabled: true,
            aliases: ["t", "tests"],
            permissions: ["EMBED_LINKS"],
            permLevel: 10,
            flags: {
                "min": {
                    aliases: ["minimal", "minimize", "m"]
                }
            }
        });
    }

    // async run(Bot, message, [userID, ...args], options) { // eslint-disable-line no-unused-vars
    async run(Bot, message, args, options) { // eslint-disable-line no-unused-vars
        const allycode = 855211749;    // eslint-disable-line no-unused-vars
        const allycodes = [ 368425861, 284348582, 968324878, 344187439, 125825545, 275189673, 339548435, 139893939, 656645167, 297441316, 497428414, 337919777, 914564765, 279181314, 166275815, 719385689, 999869238, 181178853, 139728567, 886686318];  // eslint-disable-line no-unused-vars
        const statLang = { "0": "None", "1": "Health", "2": "Strength", "3": "Agility", "4": "Tactics", "5": "Speed", "6": "Physical Damage", "7": "Special Damage", "8": "Armor", "9": "Resistance", "10": "Armor Penetration", "11": "Resistance Penetration", "12": "Dodge Chance", "13": "Deflection Chance", "14": "Physical Critical Chance", "15": "Special Critical Chance", "16": "Critical Damage", "17": "Potency", "18": "Tenacity", "19": "Dodge", "20": "Deflection", "21": "Physical Critical Chance", "22": "Special Critical Chance", "23": "Armor", "24": "Resistance", "25": "Armor Penetration", "26": "Resistance Penetration", "27": "Health Steal", "28": "Protection", "29": "Protection Ignore", "30": "Health Regeneration", "31": "Physical Damage", "32": "Special Damage", "33": "Physical Accuracy", "34": "Special Accuracy", "35": "Physical Critical Avoidance", "36": "Special Critical Avoidance", "37": "Physical Accuracy", "38": "Special Accuracy", "39": "Physical Critical Avoidance", "40": "Special Critical Avoidance", "41": "Offense", "42": "Defense", "43": "Defense Penetration", "44": "Evasion", "45": "Critical Chance", "46": "Accuracy", "47": "Critical Avoidance", "48": "Offense", "49": "Defense", "50": "Defense Penetration", "51": "Evasion", "52": "Accuracy", "53": "Critical Chance", "54": "Critical Avoidance", "55": "Health", "56": "Protection", "57": "Speed", "58": "Counter Attack", "59": "UnitStat_Taunt", "61": "Mastery" };// eslint-disable-line no-unused-vars
        const statCalculator = Bot.statCalculator; // eslint-disable-line no-unused-vars
        const supremacyID = "LMbQVurgQACEqvTZFUltMw"; // eslint-disable-line no-unused-vars

        // const response = await fetch("https://swgoh.gg/stats/mod-meta-report/guilds_100_gp/");
        // const ggPage = await response.text();
        // console.log(ggPage);
        //
        // const modSetCounts = {
        //     "Crit Chance":     "Critical Chance x2",
        //     "Crit Damage":     "Critical Damage x4",
        //     "Critical Chance": "Critical Chance x2",
        //     "Critical Damage": "Critical Damage x4",
        //     "Defense":         "Defense x2",
        //     "Health":          "Health x2",
        //     "Offense":         "Offense x4",
        //     "Potency":         "Potency x2",
        //     "Speed":           "Speed x4",
        //     "Tenacity":        "Tenacity x2"
        // };
        //
        // const $ = cheerio.load(ggPage);
        //
        // const charOut = [];
        //
        // // As of Jan 27th, 2022, side and defId seem to have been taken out
        // $("body > div.container.p-t-md > div.content-container > div.content-container-primary.character-list > ul > li:nth-child(3) > table > tbody > tr")
        //     .each((i, elem) => {
        //         let [name, sets, receiver, holo, data, multiplexer] = $(elem).children();
        //         // const defId = $(name).find("img").attr("data-base-id");
        //         const imgUrl =  $(name).find("img").attr("src");
        //         // const side = $(name).find("div").attr("class").indexOf("light-side") > -1 ? "Light Side" : "Dark Side";
        //         const [url, modUrl] = $(name).find("a").toArray().map(link => {
        //             return $(link).attr("href").trim();
        //         });
        //         name = cleanName($(name).text());
        //         sets = $(sets).find("div").toArray().map(div => {
        //             return countSet($(div).attr("data-title").trim());
        //         });
        //         receiver    = cleanModType($(receiver).text());
        //         holo        = cleanModType($(holo).text());
        //         data        = cleanModType($(data).text());
        //         multiplexer = cleanModType($(multiplexer).text());
        //         charOut.push({
        //             name:     name,
        //             // defId:    defId,
        //             charUrl:  "https://swgoh.gg" + url,
        //             image:    imgUrl,
        //             // side:     side,
        //             modsUrl:  "https://swgoh.gg" + modUrl, //+ url + "best-mods/",
        //             mods: {
        //                 sets:     sets,
        //                 square:   "Offense",
        //                 arrow:    receiver,
        //                 diamond:  "Defense",
        //                 triangle: holo,
        //                 circle:   data,
        //                 cross:    multiplexer
        //             }
        //         });
        //     });
        //
        // // Clean up the mod names (Wipe out extra spaces or condense long names)
        // function cleanModType(types) {
        //     if (!types || typeof types !== "string") return null;
        //     return types.trim()
        //         .replace(/\s+\/\s/g, "/ ")
        //         .replace("Critical Damage", "Crit. Damage")
        //         .replace("Critical Chance", "Crit. Chance");
        // }
        //
        // // This is mainly to clean up Padme's name for now
        // function cleanName(name) {
        //     if (!name || typeof name !== "string") return;
        //     return name.trim().replace("é", "e");
        // }
        //
        // // Put the number of mods for each set
        // function countSet(setName) {
        //     return modSetCounts[setName] || setName;
        // }
        // console.log(charOut);


        const rawPlayer = await Bot.swapiStub.getPlayer(allycode.toString());
        // console.log(rawPlayer.rosterUnit[0]);
        fs.writeFileSync("./testOutput/rawPlayer.json", JSON.stringify(rawPlayer, null, 4), (err) => console.log(err));

        const helpPlayer = await Bot.swgoh.fetchPlayer({allycode: allycode});
        // console.log(helpPlayer.result[0]);
        fs.writeFileSync("./testOutput/helpPlayer.json", JSON.stringify(helpPlayer, null, 4), (err) => console.log(err));

        // const player = await Bot.swgohAPI.unitStats(allycode.toString());
        // console.log(player[0].roster.find(char => char.defId === "WAMPA"));

        // let testEmote = await message.client.shard.broadcastEval(async (client) => {
        //     const guild = client.guilds.cache.get("327968689175658496");
        //     if (!guild) return null;
        //     console.log("Found guild: " + guild.name);
        //     return guild?.emojis?.fetch("912084903036874802");
        // });
        // console.log(testEmote);
        // testEmote = testEmote.filter(e => !!e)[0];
        // return message.channel.send(`Emote: '<:${testEmote.identifier}>'`);
        //
        // console.log(message.client.shard.ids[0]);
        // console.log(message.client.slashcmds.keys());

        // console.log(inspect(message.client.shard.id, {depth: 1}));
        // console.log(message.guild.shard);

        // const arenaProfile = await Bot.swapiStub.getPlayerArenaProfile(allycode.toString());
        // console.log(inspect(arenaProfile, {depth: 5}));

        // console.log(Bot.factions);

        // const guildCmds = message.client.slashcmds.filter(c => c.guildOnly).map(c => c.commandData);
        // const currentGuildCommands = await message.client.guilds.cache.get(message.guild.id)?.commands.fetch();
        // console.log(inspect(guildCmds, {depth: 5}), inspect(currentGuildCommands.map(com => {
        //     delete com.guild;
        //     delete com.permissions;
        //     delete com.id;
        //     delete com.applicationId;
        //     delete com.guildId;
        //     delete com.type;
        //     delete com.version;
        //     for (const ix in com.options) {
        //         const opt = com.options[ix];
        //         delete opt.channelTypes;
        //         delete opt.autocomplete;
        //
        //         for (const jx in opt.options) {
        //             const opt2 = com.options[jx];
        //             delete opt2?.channelTypes;
        //             delete opt2?.autocomplete;
        //             opt.options[jx] = opt2;
        //         }
        //         com.options[ix] = opt;
        //     }
        //     return com;
        // }), {depth: 10}));

        // console.log("Running the test command");
        // const testCount = await Bot.mongo.db(Bot.config.mongodb.swapidb).collection("playerStats").estimatedDocumentCount();
        // // const testCount = await Bot.mongo.db(Bot.config.mongodb.swapidb).collection("playerStats").countDocuments();
        // if (testCount) {
        //     console.log(`Mongo countDocs: ${testCount}`);
        // } else {
        //     console.log("Couldn't get testCount");
        // }

        // const memberContTypes = { // eslint-disable-line no-unused-vars
        //     1: "Guild Tokens",
        //     2: "Raid tickets",
        //     3: "Donations"
        // };
        //
        // const guildSlashCommands = await message.client.guilds.cache.get(message.guild.id)?.commands?.fetch();
        // console.log(inspect(guildSlashCommands.find(cmd => cmd.name === "reload"), {depth: 5})) ;

        // const charList = Bot.characters;
        //
        // const search = "sith";
        // const query = new RegExp(`^(?!.*selftag).*${search}.*`, "gi");
        // let factionList = await Bot.cache.get(Bot.config.mongodb.swapidb, "units", {categoryIdList: query, language: message.guildSettings.swgohLanguage.toLowerCase()}, {_id: 0, baseId: 1, nameKey: 1});
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
        // } else if (factionList.length > 40) {
        //     return super.error(message, "Your query came up with too many results, please try and be more specific");
        // } else {
        //     factionList = factionList.sort((a, b) => a.nameKey.toLowerCase() > b.nameKey.toLowerCase() ? 1 : -1);
        // }
        //
        // const fetchBody = [];
        // for (const char of factionList) {
        //     const thisChar = roster.find(ch => ch.defId === char.baseId);
        //     if (!thisChar || !char) {
        //         console.log(char);
        //         continue;
        //     }
        //
        //     fetchBody.push({
        //         defId:   thisChar.defId,
        //         charUrl: char.avatarURL,
        //         rarity:  thisChar.rarity,
        //         level:   thisChar.level,
        //         gear:    thisChar.gear,
        //         zetas:   thisChar.skills.filter(s => s.isZeta && s.tier == s.tiers).length,
        //         relic:   thisChar.relic?.currentTier ? thisChar.relic.currentTier : 0,
        //         side:    char.side
        //     });
        //
        // }
        //
        //
        // let charImg;
        // try {
        //     await fetch(Bot.config.imageServIP_Port + "/multi-char/", {
        //         method: "post",
        //         body: JSON.stringify(fetchBody),
        //         headers: { "Content-Type": "application/json" }
        //     })
        //         .then(response => response.buffer())
        //         .then(image => {
        //             charImg = image;
        //         });
        // } catch (e) {
        //     Bot.logger.error("ImageFetch in myCharacter broke: " + e);
        // }
        //
        // if (!charImg) {
        //     return super.error(message, "Something went wrong, there's no image");
        // } else {
        //     return message.channel.send({
        //         embeds: [{
        //             author: {
        //                 name: player.name+ "'s " + search,
        //             },
        //             // thumbnail: { url: "attachment://image.png" },
        //         }],
        //         files: [{
        //             attachment: charImg,
        //             name: "image.png"
        //         }]
        //     });
        // }

        // const globalSlashCommands = await message.client.application?.commands?.fetch();
        // console.log(inspect(globalSlashCommands.find(cmd => cmd.name === "reload"), {depth: 5})) ;

        // await message.client.guilds.cache.get(message.guild.id)?.commands.set([]);
        // await message.client.application?.commands.set([]);
        //
        // console.log("Reset slash?");


        // await Bot.shardRanks();

        // const testBE = await message.client.shard.broadcastEval(async (client, testin1, testin2) => {
        //     console.log(testin1, testin2)
        // }, {context: {
        //         testin1: "t1",
        //         testin2: "t2"
        //     }});
        // console.log(testBE);

        // await Bot.guildsUpdate();

        // const channel = "329514150105448459";
        // const channels = await message.client.shard.broadcastEval(`
        //     (async () => {
        //         let channel = this.channels.cache.get('${channel}');
        //         if (channel && channel.permissionsFor(this.user.id).has(["VIEW_CHANNEL", "SEND_MESSAGES"])) {
        //             return true;
        //         }
        //         return false;
        //     })();
        // `);
        // return console.log(channels.some(ch => !!ch));


        // const langChar = await Bot.swgohAPI.langChar({defId: "WATTAMBOR"});
        // return message.channel.send(inspect(langChar));

        // const guild = await Bot.swgohAPI.getPlayerUpdates(allycode);
        // console.log(guild);
        // let guildLog;
        // try {
        //     guildLog = await Bot.swgohAPI.getPlayerUpdates(allycode);
        //     console.log(guildLog);
        // } catch (err) {
        //     return message.channel.send(" " + err);
        // }

        // if (!guildLog) return message.channel.send("No guild changes at this time");
        //
        // // Processs the guild changes
        // // TODO Make it so if there are people with too many changes, it will split em up,
        // // and if there are too many people with changes, split them up too, into multiple embed messages
        // const fields = [];
        // for (const memberName of Object.keys(guildLog)) {
        //     const member = guildLog[memberName];
        //     const memberField = {
        //         name: memberName,
        //         value: []
        //     };
        //     for (const cat of Object.keys(member)) {
        //         if (!member[cat].length) continue;
        //         memberField.value.push(...member[cat]);
        //     }
        //     memberField.value = memberField.value.join("\n");
        //     fields.push(memberField);
        // }
        //
        // if (!fields.length) return;
        // console.log(fields);
        // return message.channel.send({embed: {
        //     author: {text: "Test"},
        //     fields: fields
        // }});



        // try {
        //     const guildLog = await Bot.swgohAPI.getPlayerUpdates(allycode);
        //     console.log(guildLog);
        // } catch (err) {
        //     return message.channel.send(err);
        // }

        // console.log(moment().unix(), 1618615800);

        // const rawGuild = await Bot.swapiStub.getGuild(supremacyID, 0, true);
        // const rawGuild = await Bot.swgohAPI.getRawGuild(allycode);
        // console.log(rawGuild);
        // console.log(rawGuild.guild.nextChallengesRefresh);


        // const player = await Bot.swapiStub.getPlayer(allycode.toString());
        // const guild = await Bot.swapiStub.getGuild(supremacyID, 0, true);
        // const guild = await Bot.swapiStub.getGuilds("GoC Supremacy", 0, 1);
        // console.log(inspect(guild, {depth: 5}));
        // fs.writeFileSync("./testOutput/rawGuild.json", JSON.stringify(rawGuild, null, 4), (err) => console.log(err));
        // console.log(player);

        // const user = await Bot.userReg.getUser(message.author.id);
        // console.log(inspect(user));

        // console.log(Bot.config.defaultSettings);

        // const guilds = await message.client.shard.broadcastEval(`
        //     this.guilds.cache.get("${args[0]}");
        // `);
        // console.log(guilds.map(g => g ? `${g.id} - ${g.name}` : null));


        // const events = await Bot.database.models.eventDBs.findAll();
        // console.log(moment().unix() * 1000);
        // console.log(
        //     events
        //         .map(e => e.dataValues)
        //         .filter(e => e.eventDT < moment().unix() * 1000)
        //         .map(e => parseInt(e.eventDT, 10))
        //         .sort()
        //         // .join(" ")
        // );









        // let player = await Bot.swgohAPI.unitStats(allycode);
        // if (Array.isArray(player)) player = player[0];
        // if (!player || !player.roster) return super.error(message, "Broke finding player for ally code `" + allycode + "`");
        // const roster = player.roster; // eslint-disable-line no-unused-vars
        //
        // // Get the count of each rarity character
        // const out = {
        //     1: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        //     2: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
        // };
        // for (const unit of roster) {
        //     const combatType = unit.combatType;
        //     const star = unit.rarity;
        //     if (combatType > 2 || combatType < 1) continue;
        //     out[combatType][star] += 1;
        // }
        // const tableFormat = {
        //     "*": {value: "*", startWith: "`", endWith: "|"},
        //     "Char": {value: "Char", endWith: "|", align: "right"},
        //     "Ship": {value: "Ship", endWith: "`", align: "right"}
        // };
        // const tableOut = [];
        // for (let ix = 1; ix <= 7; ix++) {
        //     tableOut.push({
        //         "*": ix,
        //         "Char": out[1][ix],
        //         "Ship": out[2][ix]
        //     });
        // }
        //
        // // Get the average rarities
        // let charTotal = 0;
        // let charCount = 0;
        // let shipTotal = 0;
        // let shipCount = 0;
        // for (let ix = 1; ix <= 7; ix++) {
        //     charCount = charCount +  out[1][ix];
        //     charTotal = charTotal + (out[1][ix] * ix);
        //     shipCount = shipCount +  out[2][ix];
        //     shipTotal = shipTotal + (out[2][ix] * ix);
        // }
        // const avgStr = `\`AVG| ${(charTotal/charCount).toFixed(2)} | ${(shipTotal/shipCount).toFixed(2)} \``;
        // return message.channel.send(Bot.makeTable(tableFormat, tableOut).join("\n") + "\n" + avgStr);
        // console.log(out);

        // const player = await Bot.swgoh.fetchPlayer({allycode: allycode});
        // console.log(player);

        // const player = await Bot.swgoh.fetchPlayer({
        //     allycode: allycode
        // }).then((p) => p.result);

        // const stats = await fetch("http://localhost:3223/api?flags=gameStyle,calcGP", {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify(player[0].roster)
        // }).then(res => res.json());

        // await statCalculator.calcRosterStats( player[0].roster , {
        //     gameStyle: true,
        //     language: statLang,
        //     calcGP: true
        // });
        // const stats = player[0].roster;

        // console.log(stats);

        // fs.writeFileSync("./PlayerOut.json", JSON.stringify(stats, null, 4));




        // const guildConf = await Bot.getGuildConf(message.guild.id);
        // console.log(guildConf);

        // const player = await Bot.swapiStub.getPlayerArenaProfile(allycode.toString());
        // console.log(player);
        // const players = await Bot.swgohAPI.getPlayersArena(allycodes);
        // console.log(players.length, allycodes.length);

        // const MAX_CONCURRENT = 10;
        // const outArr = [];
        // await npmAsync.eachLimit(allycodes, MAX_CONCURRENT, async function(ac) {
        //     const p = await Bot.swapiStub.getPlayerArenaProfile(ac.toString());
        //     outArr.push(p);
        // });
        // const players = await npmAsync.eachLimit(allycodes, MAX_CONCURRENT, async function(ac) {console.log(ac);});
        // return console.log(inspect(outArr, {depth: 5}));
        // return console.log(inspect(players.find(p => parseInt(p.allyCode, 10, 10)) === 999869238), {depth: 5}));

        // console.log(args);
        // await Bot.shardTimes();

        // const channels = await message.client.shard.broadcastEval(`
        //     this.channels.cache.get('329514150105448459');
        // `);
        // const chan = channels.filter(a => !!a)[0];
        // // console.log(channels.filter(a => !!a).map(a => a.name));
        // console.log(chan.name);
        // const messages = await message.client.shard.broadcastEval(`
        //     (async () => {
        //         let channel = this.channels.cache.get('329514150105448459');
        //         let msg;
        //         if (channel) {
        //             msg = await channel.messages.fetch('762917119288410133');
        //         }
        //         return msg;
        //     })();
        // `);
        // // console.log(messages);
        // const msg = messages.filter(a => !!a)[0];
        // console.log(msg.content ? msg.content : msg.embeds);

        // const channel = await message.client.channels.cache.get("329514150105448459");
        // const msg = await channel.messages.fetch("762827900067643403");
        // const msg = channel.messages.cache.get("762827900067643403");
        // console.log(msg);
        // console.log(msg.content ? msg.content : msg.embeds);

        // const payouts = await Bot.swgohAPI.getPayoutFromAC(allycode);
        // console.log(payouts);
        // const language = "ENG_US";

        // console.log("Dirname: " + __dirname);
        // console.log("Process.cwd: " + process.cwd());

        // 437671976782266369 - 437991997060677632
        // const guild = await message.client.shard.broadcastEval(`
        //     this.guilds.cache.get("437671976782266369")?.channels.cache.get("437991997060677632");
        // `);
        //
        // console.log(guild);
        // console.log(chan.filter(a => !!a));

        // const arena = await Bot.swgoh.fetchAPI("/swgoh/playerArena", {
        //     allycode: [allycode]
        // });
        // console.log(arena);

        // throw new Error("Testing");

        // if (options.flags.min) {
        //     delete require.cache[require.resolve("swgoh-stat-calc")];
        //     Bot.statCalculator = require("swgoh-stat-calc");
        //     const gameData  = require("../data/gameData.json");
        //     Bot.statCalculator.setGameData( gameData );
        // }
        //
        // const calcPlayer = await Bot.swgohAPI.unitStats(allycode);
        // const GG = calcPlayer[0].roster.find(c => c.defId === "GRIEVOUS");
        // return message.channel.send(`Grevious' GP: ${GG.gp}`);

        // console.log(message.client.shards.length);

        // const application = await message.client.fetchApplication();
        // console.log(application);

        // return message.channel.send(">>> This is a test");






        // await Bot.getRanks();
        // return message.channel.send("Checked ranks");
        // if (args.length) {
        //     let out = await message.client.shard.broadcastEval(`
        //         this.guilds.get("${args[0]}")
        //     `);
        //     out = out.filter(a => (a !== undefined && a !== null)).length;
        //     message.channel.send("Result: " + out);
        // } else {
        //     return super.error(message, "You need to input a guild ID");
        // }

        // const testID = userID || message.author.id;
        // const pat = await Bot.getPatronUser(testID);
        // return message.channel.send(`<@${testID}> - ${inspect(pat)}`);

        // const ab = "UNIQUEABILITY_DARTHTRAYA01_NAME";
        // const ab2 = "leaderskill_DARTHTRAYA";
        // const ab2 = "uniqueskill_AMILYNHOLDO01";

        // console.log(Object.keys(Bot.schedule.scheduledJobs));

        // const char = await Bot.swgohAPI.getCharacter("DARTHREVAN");
        // const gearList = char.unitTierList.filter(t => t.tier === 9);
        // // console.log(gearList);
        //
        // let end = [];
        // for (const g of gearList[0].equipmentSetList) {
        //     const gr = await Bot.cache.get(Bot.config.mongodb.swapidb, "gear", {
        //         nameKey: g,
        //         language: message.guildSettings.swgohLanguage
        //     }, {
        //         nameKey: 1,
        //         recipeId: 1,
        //         _id: 0
        //     });
        //
        //     const pieces = await getParts(message, Bot, gr);
        //     end = end.concat(pieces);
        // }
        //
        // const out = {};
        // end = end.sort((a, b) => a.name > b.name ? 1 : -1);
        // end.forEach(g => {
        //     if (out[g.name]) {
        //         out[g.name].count += g.count;
        //     } else {
        //         out[g.name] = {
        //             count: g.count
        //         };
        //     }
        // });
        // console.log(Object.keys(out).map(g => " ".repeat(2 - out[g].count.toString().length) + out[g].count + "x " + g).join("\n"));



        // await client.reloadPatrons();
        // return message.channel.send({embed: {
        //     title: "Current Patrons",
        //     description: client.patrons
        //         .filter(p => p.discordID !== client.config.ownerid)
        //         .map(p => "$" + (p.amount_cents/100) + "<@" + p.discordID + ">: ").join("\n")
        // }});

        // const fetch = await client.users.fetch(message.author.id);
        // console.log(fetch.username);

        // const z = await client.cache.get(client.config.mongodb.swapidb, "zetaRec");
        // const fs = require("fs");
        // await fs.writeFileSync("../zetas.json", JSON.stringify(z, null, 4), "utf8");
        // message.channel.send({files: ["../zetas.json"]});



        // client.getRanks();

        // message.channel.send({files: ["../dashboard/public/images/arenaAlert.png"]});
        // message.channel.send({files: ["../dashboard/public/images/botAvatar.png"]});

        // console.log(client.charLocs.map(c => c.baseId));

        // message.channel.send("s".repeat(2444));
        // message.channel.send({embed: {
        //     fields: [
        //         {
        //             name: "test"
        //         }
        //     ]
        // }});

        // console.log(client.config.defaultUserConf);
        // client.config.defaultUserConf.accounts = {};
        // client.config.defaultUserConf.id = "";

        // const abLang = await client.swgohAPI.abilities(ab2, null, null, {min: true});
        // console.log(abLang);

        // const count = await client.guildCount();
        // console.log(count);
        //     const allycode = 855211749;
        //     const language = 'ENG_US';
        //
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
        //             const setNum = parseInt(set.count / modsetBonuses[s].set, 10, 10));
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
        //                     `\`Lvl ${c.level} | ${c.rarity}* | ${parseInt(c.gp, 10, 10))} gp\``,
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
    //     totalGP += parseInt(p.gpFull, 10, 10));
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





// async function getParts(message, Bot, gr, partList=[], amt=1) {
//     if (Array.isArray(gr)) gr = gr[0];
//     // console.log("New GR");
//     // console.log(gr);
//     if (!gr) return;
//     if (gr.recipeId && gr.recipeId.length) {
//         let rec = await Bot.cache.get(Bot.config.mongodb.swapidb, "recipes", {
//             id: gr.recipeId,
//             language: message.guildSettings.swgohLanguage
//         },
//         {
//             ingredientsList: 1,
//             _id: 0
//         });
//         if (Array.isArray(rec)) rec = rec[0];
//         if (rec.ingredientsList) rec = rec.ingredientsList.filter(r => r.id !== "GRIND");
//         // console.log("Rec:");
//         // console.log(rec);
//         for (const r of rec) {
//             // console.log("Recipe");
//             // console.log(r);
//             const gear = await Bot.cache.get(Bot.config.mongodb.swapidb, "gear", {
//                 id: r.id,
//                 language: message.guildSettings.swgohLanguage
//             }, {
//                 nameKey: 1,
//                 recipeId: 1,
//                 _id: 0
//             });
//             // console.log("newGear");
//             // console.log(gear.id, r.id, r.maxQuantity);
//             await getParts(message, Bot, gear, partList, amt * r.maxQuantity);
//         }
//     } else {
//         const mk = gr.nameKey.split(" ")[1];
//         // console.log(mk);
//         partList.push({name: gr.nameKey, count: amt, mark: mk});
//     }
//
//     // console.log("Parts: " + partList);
//
//     return partList;
// }







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
// const allyCode = parseInt(ally.dataValues.allyCode, 10, 10));
// console.log('Ally Code: ' + allyCode);
