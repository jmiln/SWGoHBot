const Command = require("../base/Command");
// const {inspect} = require('util');

class GuildSearch extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "guildsearch",
            category: "SWGoH",
            aliases: ["search", "gs"],
            permissions: ["EMBED_LINKS"],
            flags: {
                "ships": { aliases: ["s", "ship"] },
                reverse: { aliases: ["rev"] },
                mods: { aliases: ["mod", "m"] },
                stars: { aliases: ["*", "star", "rarity"] },
                gear: { aliases: ["g"] },
                zetas: { aliases: ["zeta", "z"] }
            },
            subArgs: {
                sort: { aliases: [] },
                stat: { aliases: ["stats"] },
                top: { aliases: [] }
            }
        });
    }

    async run(Bot, message, args, options) { // eslint-disable-line no-unused-vars
        let starLvl = 0;
        const reverse = options.flags.reverse;
        const gears = [9,10,11,12,13];
        const rarityMap = {
            "ONESTAR": 1,
            "TWOSTAR": 2,
            "THREESTAR": 3,
            "FOURSTAR": 4,
            "FIVESTAR": 5,
            "SIXSTAR": 6,
            "SEVENSTAR": 7
        };
        let top = null;
        if (options.subArgs.top !== null) {
            const t = parseInt(options.subArgs.top);
            if (!isNaN(t) && t > 0 && t <= 50) {
                top = t;
            } else {
                return super.error(message, "Invalid argument for -top. Must be between 1 and 50");
            }
        }

        // If there's enough elements in args, and it's in the format of a number*
        if (!options.flags.mods && args.length && !isNaN(parseInt(args[args.length-1])) && /^\d+$/.test(args[args.length-1].toString())) {
            starLvl = parseInt(args.pop());
            if (starLvl < 0 || starLvl > 7) {
                return super.error(message, message.language.get("COMMAND_GUILDSEARCH_BAD_STAR"), {example: "guildsearch c3po 7\n;guildsearch falcon -s 7"});
            }
        }

        let tmp;
        let character;
        let allyCode, searchChar, err;
        if (!options.flags.mods && !options.flags.stars && !options.flags.gear) {
            tmp = await super.getUserAndChar(message, args);
            allyCode = tmp.allyCode;
            searchChar = tmp.searchChar;
            err = tmp.err;

            if (options.flags.ships && options.flags.stats) {
                return super.error(message, message.language.get("COMMAND_GUILDSEARCH_SHIP_STATS"));
            } else if (!searchChar) {
                return super.error(message, "Missing character to search for.", {example: "guildsearch c3po\n;guildsearch falcon -s"});
            }

            const chars = !options.flags.ships ? Bot.findChar(searchChar, Bot.characters) : Bot.findChar(searchChar, Bot.ships, true);

            if (chars.length === 0) {
                return super.error(message, message.language.get("COMMAND_GUILDSEARCH_NO_RESULTS", searchChar), {example: "guildsearch c3po\n;guildsearch falcon -s"});
            } else if (chars.length > 1) {
                const charL = [];
                const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
                charS.forEach(c => {
                    charL.push(c.name);
                });
                return super.error(message, message.language.get("COMMAND_GUILDSEARCH_CHAR_LIST", charL.join("\n")));
            } else {
                character = chars[0];
            }

        } else {
            tmp = await super.getUserAndChar(message, args, false);
            allyCode = tmp.allyCode;
            searchChar = tmp.searchChar;
            err = tmp.err;
        }

        if (err) {
            return super.error(message, err);
        }

        // Check for conflicting flags/ subArgs
        const checkArr = ["ships", "mods", "stat", "gear"];
        const checkRes = Object.keys(options.flags).map(k => checkArr.includes(k) ? options.flags[k] : null).concat(Object.keys(options.subArgs).map(k => checkArr.includes(k) ? options.subArgs[k] : null));
        if (checkRes.filter(c => c).length > 1) {
            return super.error(message, message.language.get("COMMAND_GUILDSEARCH_CONFLICTING", Bot.codeBlock(checkArr.map(c => "-" + c).join("\n"))));
        }
        // Then check with stars instead of ships since those work together
        const checkArr2 = ["stars", "mods", "stat", "gear"];
        const checkRes2 = Object.keys(options.flags).map(k => checkArr.includes(k) ? options.flags[k] : null).concat(Object.keys(options.subArgs).map(k => checkArr.includes(k) ? options.subArgs[k] : null));
        if (checkRes2.filter(c => c).length > 1) {
            return super.error(message, message.language.get("COMMAND_GUILDSEARCH_CONFLICTING", Bot.codeBlock(checkArr2.map(c => "-" + c).join("\n"))));
        }

        const msg = await message.channel.send(message.language.get("COMMAND_GUILDSEARCH_PLEASE_WAIT"));

        const cooldown = await Bot.getPlayerCooldown(message.author.id);

        if (options.flags.gear) {
            // List an overview of the guild's upper geared characters
            let sortBy = null;
            if (options.subArgs.sort) {
                sortBy = options.subArgs.sort.toString();
                if (isNaN(sortBy) || !gears.includes(parseInt(sortBy))) {
                    return super.error(message, message.language.get("COMMAND_GUILDSEARCH_INVALID_SORT", gears.join(",")));
                }
            }
            let guild = null;
            try {
                guild = await Bot.swgohAPI.guild(allyCode, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS) getting guild: " + e);
                return message.channel.send({embed: {
                    author: { name: "Something Broke getting your guild's roster" },
                    description: Bot.codeBlock(e) + "Please try again in a bit."
                }});
            }
            let gRoster;
            if (!guild || !guild.roster || !guild.roster.length) {
                return msg.edit(message.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                const oldLen = guild.roster.length;
                guild.roster = guild.roster.filter(m => m.allyCode !== null);
                if (guild.roster.length !== oldLen) {
                    guild.warnings = guild.warnings || [];
                    guild.warnings.push(`Could not get info for ${oldLen - guild.roster.length} players`);
                }
                gRoster = guild.roster.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1).map(m => m.allyCode);
            }

            if (!gRoster.length) {
                return msg.edit("I can't find any players in the requested guild.");
            }
            let guildGG;
            try {
                guildGG = await Bot.swgohAPI.guildGG(gRoster, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS_GEAR) getting guild: " + e);
                // Spit out the gId so I can go check on why it's breaking
                console.log("GuildID: " + guild.id);
                return super.error(msg, Bot.codeBlock(e), {title: "Something Broke while getting your guild's characters", footer: "Please try again in a bit", edit: true});
            }
            const starOut = {};

            Object.keys(guildGG.roster).forEach(char => {
                guildGG.roster[char].forEach(p => {
                    starOut[p.player] = starOut[p.player] || {};
                    if (starOut[p.player][p.gearLevel]) {
                        starOut[p.player][p.gearLevel] += 1;
                    } else {
                        starOut[p.player][p.gearLevel] = 1;
                    }
                });
            });

            let tableIn = Object.keys(starOut).map(k => {
                return {
                    "9": starOut[k]["9"] || 0,
                    "10": starOut[k]["10"] || 0,
                    "11":  starOut[k]["11"] || 0,
                    "12": starOut[k]["12"] || 0,
                    "13": starOut[k]["13"] || 0,
                    name: k
                };
            });

            if (gears.indexOf(parseInt(sortBy)) > -1) {
                tableIn = tableIn.sort((a, b) => a[sortBy] < b[sortBy] ? 1 : -1);
            } else {
                tableIn = tableIn.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
            }

            let tableFormat;
            if (sortBy.toString() === "13") {
                tableFormat = {
                    "10": {value: "g10", startWith: "`[", endWith: "|",  align: "right"},
                    "11": {value: "g11",                  endWith: "|",  align: "right"},
                    "12": {value: "g12",                  endWith: "|",  align: "right"},
                    "13": {value: "g13",                  endWith: "]`", align: "right"},
                    name: {value: "",                                    align: "left"}
                };
            } else {
                tableFormat = {
                    "9":  {value: "g9", startWith: "`[", endWith: "|",  align: "right"},
                    "10": {value: "g10",                 endWith: "|",  align: "right"},
                    "11": {value: "g11",                 endWith: "|",  align: "right"},
                    "12": {value: "g12",                 endWith: "]`", align: "right"},
                    name: {value: "",                                   align: "left"}
                };
            }

            const tableOut = Bot.makeTable(tableFormat, tableIn);

            const outMsgArr = Bot.msgArray(tableOut, "\n", 700);
            const fields = [];
            outMsgArr.forEach(m => {
                fields.push({
                    name: "-",
                    value: m
                });
            });

            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }

            const footer = Bot.updatedFooter(guild.updated, message, "guild", cooldown);
            return msg.edit({embed: {
                author: {
                    name: `${guild.name} ${message.language.get("COMMAND_GUILDSEARCH_GEAR_SUM")}`
                },
                fields: fields,
                footer: footer
            }});
        } else if (options.flags.stars) {
            // List an overview of the guild's upper starred characters
            let sortBy = null;
            if (options.subArgs.sort) {
                sortBy = options.subArgs.sort;
                if (isNaN(sortBy) || ![4,5,6,7].includes(parseInt(sortBy))) {
                    return super.error(message, message.language.get("COMMAND_GUILDSEARCH_INVALID_SORT", "4,5,6,7"));
                }
            }
            let guild = null;
            try {
                guild = await Bot.swgohAPI.guild(allyCode, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS) getting guild: " + e);
                return message.channel.send({embed: {
                    author: { name: "Something Broke getting your guild's roster" },
                    description: Bot.codeBlock(e) + "Please try again in a bit."
                }});
            }
            let gRoster;
            if (!guild || !guild.roster || !guild.roster.length) {
                return msg.edit(message.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                const oldLen = guild.roster.length;
                guild.roster = guild.roster.filter(m => m.allyCode !== null);
                if (guild.roster.length !== oldLen) {
                    guild.warnings = guild.warnings || [];
                    guild.warnings.push(`Could not get info for ${oldLen - guild.roster.length} players`);
                }
                gRoster = guild.roster.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1).map(m => m.allyCode);
            }

            if (!gRoster.length) {
                return msg.edit("I can't find any players in the requested guild.");
            }
            let guildGG;
            try {
                guildGG = await Bot.swgohAPI.guildGG(gRoster, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS) getting guild: " + e);
                // Spit out the gId so I can go check on why it's breaking
                console.log("GuildID: " + guild.id);
                return super.error(msg, Bot.codeBlock(e), {title: "Something Broke while getting your guild's characters", footer: "Please try again in a bit", edit: true});
            }
            const starOut = {};
            for (const char of Object.keys(guildGG.roster)) {
                if (options.flags.ships && guildGG.roster[char][0].type === "CHARACTER") {
                    continue;
                } else if (!options.flags.ships && guildGG.roster[char][0].type === "SHIP") {
                    continue;
                }
                guildGG.roster[char].forEach(p => {
                    starOut[p.player] = starOut[p.player] || {};
                    if (starOut[p.player][p.starLevel]) {
                        starOut[p.player][p.starLevel] += 1;
                    } else {
                        starOut[p.player][p.starLevel] = 1;
                    }
                });
            }

            let tableIn = Object.keys(starOut).map(k => {
                return {
                    four: starOut[k]["4"] || 0,
                    five: starOut[k]["5"] || 0,
                    six:  starOut[k]["6"] || 0,
                    seven: starOut[k]["7"] || 0,
                    name: k
                };
            });

            switch (sortBy) {
                case "4":
                    tableIn = tableIn.sort((a, b) => a.four < b.four ? 1 : -1);
                    break;
                case "5":
                    tableIn = tableIn.sort((a, b) => a.five < b.five ? 1 : -1);
                    break;
                case "6":
                    tableIn = tableIn.sort((a, b) => a.six < b.six ? 1 : -1);
                    break;
                case "7":
                    tableIn = tableIn.sort((a, b) => a.seven < b.seven ? 1 : -1);
                    break;
                default:
                    tableIn = tableIn.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);
            }

            const tableOut = Bot.makeTable({
                four:  {value: "4*", startWith: "`[", endWith: "|", align: "right"},
                five:  {value: "5*", endWith: "|", align: "right"},
                six:   {value: "6*", endWith: "|", align: "right"},
                seven: {value: "7*", endWith: "]`", align: "right"},
                name:  {value: "", align: "left"}
            }, tableIn);

            const outMsgArr = Bot.msgArray(tableOut, "\n", 700);
            const fields = [];
            outMsgArr.forEach(m => {
                fields.push({
                    name: "-",
                    value: m
                });
            });

            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }

            const footer = Bot.updatedFooter(guild.updated, message, "guild", cooldown);
            const header = options.flags.ships ? message.language.get("COMMAND_GUILDSEARCH_SHIP_STAR_SUM") : message.language.get("COMMAND_GUILDSEARCH_CHAR_STAR_SUM");
            return msg.edit({embed: {
                author: {
                    name: guild.name + "'s " + header
                },
                fields: fields,
                footer: footer
            }});
        } else if (options.subArgs.stat !== null) {
            // Looking for a stat
            const outArr = [];

            const checkableStats = {
                "Health": {
                    aliases: ["HP"],
                    short: "HP"
                },
                "Protection": {
                    aliases: ["Prot"],
                    short: "Prot"
                },
                "Speed": {
                    aliases: ["spd"],
                    short: "Spd"
                },
                "Potency": {
                    aliases: ["Pot"],
                    short: "Pot"
                },
                "Physical Critical Chance": {
                    aliases: ["PCC", "CC", "Crit Chance", "Critical Chance", "Physical Crit Chance"],
                    short: "CC"
                },
                "Physical Damage": {
                    aliases: ["PD", "Physical Dmg", "Offense"],
                    short: "PD"
                },
                "Special Critical Chance": {
                    aliases: ["SCC", "Special Crit Chance"],
                    short: "CC"
                },
                "Special Damage": {
                    aliases: ["SD", "Special Dmg"],
                    short: "SD"
                },
                "Critical Damage": {
                    aliases: ["CD", "Crit Damage"],
                    short: "CD"
                },
                "Tenacity": {
                    aliases: ["Ten"],
                    short: "Ten"
                },
                "Accuracy": {
                    aliases: ["Acc"],
                    short: "Acc"
                },
                "Armor": {
                    aliases: ["arm"],
                    short: "Arm"
                },
                "Resistance": {
                    aliases: ["Res", "Resist"],
                    short: "Res"
                }
            };


            let found = false;
            let sortBy = options.subArgs.stat;
            const stat = Object.keys(checkableStats).filter(s => s.toLowerCase().replace(/\s/gi, "") === sortBy.toLowerCase());
            if (stat && stat.length) {
                sortBy = stat[0];
                found = true;
            } else {
                Object.keys(checkableStats).forEach(s => {
                    if (checkableStats[s].aliases.find(c => c.toLowerCase().replace(" ", "") === sortBy.toLowerCase())) {
                        sortBy = s;
                        found = true;
                        return;
                    }
                });
            }

            if (!found) {
                return super.error(msg, "Not an acceptable stat to sort by. Try one of the following:" + Bot.codeBlock(Object.keys(checkableStats).map(s => s.replace(/\s/gi, "")).join(", ")), {edit: true, example: "guildsearch c3po -sort gp"});
            }

            let guild = null;
            try {
                guild = await Bot.swgohAPI.guild(allyCode, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS) getting guild: " + e);
                return super.error(msg, Bot.codeBlock(e) + message.language.get("BASE_PLEASE_TRY_AGAIN"), {title: message.language.get("BASE_SOMETHING_BROKE_GUILD_ROSTER"), edit: true});
            }
            let gRoster;
            if (!guild || !guild.roster || !guild.roster.length) {
                return super.error(msg, message.language.get("BASE_SWGOH_NO_GUILD"), {edit: true});
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                gRoster = guild.roster.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1).map(m => m.allyCode);
            }

            if (!gRoster.length) {
                return super.error(msg, "I can't find any players in the requested guild.", {edit: true});
            }
            const gStats = await Bot.swgohAPI.guildStats(gRoster, character.uniqueName, cooldown);

            let pct = false;

            const sortedMembers = gStats.sort((a, b) => {
                if (!a.stats[sortBy]) {
                    a.stats[sortBy] = {
                        gear: 0,
                        mods: 0,
                        final: 0,
                        pct: false
                    };
                } else {
                    pct = a.stats[sortBy].pct;
                }
                return a.stats[sortBy].final < b.stats[sortBy].final ? 1 : -1;
            });

            sortedMembers.forEach( member => {
                const stats = member.stats;
                Object.keys(stats).forEach(s => {
                    if (pct) {
                        stats[s] = (stats[s].final * 100).toFixed(2) + "%";
                    } else {
                        stats[s] = stats[s].final ? stats[s].final.toLocaleString() : "N/A";
                    }
                });
                stats.player = guild.roster.find(m => m.allyCode === member.allyCode).name;
                stats.gp = member.unit.gp ? member.unit.gp.toLocaleString() : 0;
                stats.gear = member.unit.gear;
                if (!stats.Protection) stats.Protection = 0;
                outArr.push(stats);
            });

            const fields = [];
            if (!outArr.length) {
                fields.push({
                    name: character.name,
                    value: message.language.get("COMMAND_GUILDSEARCH_NO_CHARACTER")
                });
            } else {
                const header = {
                    gear: {value: "⚙", startWith: "`[", endWith: "|", align: "right"},
                    gp: {value: "GP", endWith: "|", align: "right"}
                };
                header[sortBy] = {value: checkableStats[sortBy].short, endWith: "]`", align: "right"};
                header.player = {value:"", align: "left"};

                const outTable = Bot.makeTable(header, outArr);

                if (outTable.length) {
                    const outMsgArr = Bot.msgArray(outTable, "\n", 700);
                    outMsgArr.forEach((m, ix) => {
                        const name = (ix === 0) ? message.language.get("COMMAND_GUILDSEARCH_SORTED_BY", character.name, sortBy) : message.language.get("BASE_CONT_STRING");
                        fields.push({
                            name: name,
                            value: m
                        });
                    });
                } else {
                    fields.push({
                        name: "-",
                        value: message.language.get("BASE_SWGOH_GUILD_LOCKED_CHAR")
                    });
                }
            }
            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }

            const footer = Bot.updatedFooter(guild.updated, message, "guild", cooldown);
            return msg.edit({embed: {
                author: {
                    name: guild.name
                },
                fields: fields,
                footer: footer
            }});
        } else if (options.flags.mods) {
            // Give a general overview of important mods (6*, +15, +20 speed, +100 offense?)
            const availableSorts = ["speed", "offense", "6", "name"];
            const sortType = options.subArgs.sort ? options.subArgs.sort.toLowerCase() : "name";
            if (!availableSorts.includes(sortType)) {
                return super.error(message, message.language.get("COMMAND_GUILDSEARCH_BAD_SORT", sortType, availableSorts), {example: "guildsearch c3po -sort gp"});
            }
            let guild = null;
            try {
                guild = await Bot.swgohAPI.guild(allyCode, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS) getting guild: " + e);
                return super.error(message, Bot.codeBlock(e), {title: "Something Broke while getting your guild's roster", footer: "Please try again later"});
            }
            let gRoster;
            if (!guild || !guild.roster || !guild.roster.length) {
                return super.error(msg, message.language.get("BASE_SWGOH_NO_GUILD"), {edit: true});
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                gRoster = guild.roster.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1).map(m => m.allyCode);
            }

            if (!gRoster.length) {
                return super.error(msg, "I can't find any players in the requested guild.", {edit: true});
            }

            let output = [];
            for (let player of gRoster) {
                try {
                    player = await Bot.swgohAPI.player(player);
                } catch (e) {
                    return super.error(message, e.message);
                }
                const mods = {
                    sixPip: 0,
                    spd15: 0,
                    spd20: 0,
                    off100: 0,
                    name: player.name
                };

                player.roster.forEach(c => {
                    if (c.mods) {
                        const six = c.mods.filter(p => p.pips === 6);
                        if (six.length) {
                            mods.sixPip += six.length;
                        }
                        c.mods.forEach(m => {
                            const spd = m.secondaryStat.find(s => (s.unitStat === 5  || s.unitStat === "UNITSTATSPEED")  && s.value >= 15);
                            const off = m.secondaryStat.find(o => (o.unitStat === 41 || o.unitStat === "UNITSTATOFFENSE") && o.value >= 100);

                            if (spd) {
                                if (spd.value >= 20) {
                                    mods.spd20 += 1;
                                } else {
                                    mods.spd15 += 1;
                                }                             }
                            if (off) mods.off100 += 1;
                        });
                    }
                });
                Object.keys(mods).forEach(k => {
                    if (mods[k] === 0) mods[k] = "0";
                });
                output.push(mods);
            }

            // Sort by speed mods, offense mods, or 6* mods
            if (options.subArgs.sort) {
                const sortBy = options.subArgs.sort.toLowerCase();
                if (sortBy === "offense") {
                    // Sort by # of good offense mods
                    output = output.sort((m, n) => parseInt(m.off100) - parseInt(n.off100));
                } else if (sortBy === "speed") {
                    // Sort by # of good speed mods
                    output = output.sort((m, n) => parseInt(m.spd20) - parseInt(n.spd20));
                } else if (sortBy === "6") {
                    // Sort by # of 6* mods
                    output = output.sort((m, n) => parseInt(m.sixPip) - parseInt(n.sixPip));
                }
            }

            const table = Bot.makeTable({
                sixPip:{value: "6*", startWith: "`"},
                spd15: {value: "15+"},
                spd20: {value: "20+"},
                off100:{value: "100+", endWith: "`"},
                name:  {value: "", align: "left"}
            }, output);
            const header = [Bot.expandSpaces("`     ┏╸ Spd ┓  Off ​`")];

            const fields = Bot.msgArray(header.concat(table), "\n", 700).map(m => {
                return {name: "-", value: m};
            });
            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }

            return msg.edit({embed: {
                author: {name: message.language.get("COMMAND_GUILDSEARCH_MODS_HEADER", guild.name)},
                fields: fields
            }});
        } else {
            let guild = null;
            const availableSorts = ["gp", "gear", "name"];
            const sortType = options.subArgs.sort ? options.subArgs.sort.toLowerCase() : "name";
            if (!availableSorts.includes(sortType)) {
                return super.error(message, message.language.get("COMMAND_GUILDSEARCH_BAD_SORT", sortType, availableSorts), {example: "guildsearch c3po -sort gp"});
            }
            try {
                guild = await Bot.swgohAPI.guild(allyCode, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS) getting guild: " + e);
                return message.channel.send({embed: {
                    author: {
                        name: "Something Broke getting your guild's roster"
                    },
                    description: Bot.codeBlock(e) + "Please try again in a bit."
                }});
            }
            let gRoster;
            if (!guild || !guild.roster || !guild.roster.length) {
                return msg.edit(message.language.get("BASE_SWGOH_NO_GUILD"));
            } else {
                msg.edit("Found guild `" + guild.name + "`!");
                const oldLen = guild.roster.length;
                guild.roster = guild.roster.filter(m => m.allyCode !== null);
                if (guild.roster.length !== oldLen) {
                    guild.warnings = guild.warnings || [];
                    guild.warnings.push(`Could not get info for ${oldLen - guild.roster.length} players`);
                }
                gRoster = guild.roster.sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1).map(m => m.allyCode);
            }

            if (!gRoster.length) {
                return msg.edit("I can't find any players in the requested guild.");
            }
            let guildGG;
            try {
                guildGG = await Bot.swgohAPI.guildGG(gRoster, null, cooldown);
            } catch (e) {
                console.log("ERROR(GS) getting guild: " + e);
                // Spit out the gId so I can go check on why it's breaking
                console.log("GuildID: " + guild.id);
                return super.error(msg, Bot.codeBlock(e), {title: "Something Broke while getting your guild's characters", footer: "Please try again in a bit", edit: true});
            }

            // Get the list of people with that character
            const guildChar = guildGG.roster[character.uniqueName];

            if (!guildChar || guildChar.length === 0 || (starLvl > 0 && !guildChar.filter(c => c.starLevel >= starLvl).length) || (options.flags.zetas && !guildChar.filter(c => c.zetas.length > 0).length)) {
                let desc = "";
                if (options.flags.zetas && !guildChar.filter(c => c.zetas.length > 0).length) {
                    desc = message.language.get("COMMAND_GUILDSEARCH_NO_ZETAS");
                } else if (options.flags.ships && starLvl > 0) {
                    desc = message.language.get("COMMAND_GUILDSEARCH_NO_SHIP_STAR", starLvl);
                } else if (starLvl > 0) {
                    desc = message.language.get("COMMAND_GUILDSEARCH_NO_CHARACTER_STAR", starLvl);
                } else if (options.flags.ships) {
                    desc = message.language.get("COMMAND_GUILDSEARCH_NO_SHIP");
                } else {
                    desc = message.language.get("COMMAND_GUILDSEARCH_NO_CHARACTER");
                }
                return super.error(msg, desc, {
                    title: message.language.get("BASE_SWGOH_NAMECHAR_HEADER", guild.name, character.name),
                    footer: message.language.get("BASE_SWGOH_LAST_UPDATED", Bot.duration(guild.updated, message)),
                    edit: true
                });
            }

            const totalUnlocked = guildChar.length;

            // Fill in everyone that does not have it since everyone is guaranteed to have jedi consular
            guildGG.roster["JEDIKNIGHTCONSULAR"].forEach(j => {
                // If they have both the targeted character and consular, ignore them
                const filtered = guildChar.filter(p => p.player === j.player);

                // If they don't, it'll be a 0 length array, so fill it in with 0 stats
                if (!filtered.length) {
                    guildChar.push({
                        player: j.player,       // Player name
                        allyCode: j.allyCode,   // Ally code
                        gearLevel: 0,
                        gp: 0,
                        level: 0,
                        starLevel: 0,
                        zetas: [],
                        gear: [],
                        type: j.type
                    });
                }
            });

            // Can get the order from abilities table => skillReferenceList
            let maxZ = 0;
            const zetas = [];
            const apiChar = await Bot.swgohAPI.getCharacter(character.uniqueName);
            for (const ab of apiChar.skillReferenceList) {
                if (ab.cost && ab.cost.AbilityMatZeta > 0) {
                    maxZ = maxZ + 1;
                    zetas.push(ab.skillId);
                }
            }

            let sortedGuild = [];
            if (sortType === "name") {
                // Sort by name
                if (!reverse) {
                    sortedGuild = guildChar.sort((p, c) => p.player.toLowerCase() > c.player.toLowerCase() ? 1 : -1);
                } else {
                    sortedGuild = guildChar.sort((p, c) => p.player.toLowerCase() < c.player.toLowerCase() ? 1 : -1);
                }
            } else if (sortType === "gp") {
                // Sort by gp
                if (!reverse) {
                    sortedGuild = guildChar.sort((p, c) => p.gp - c.gp);
                } else {
                    sortedGuild = guildChar.sort((p, c) => c.gp - p.gp);
                }
            } else if (sortType === "gear") {
                // Sort by gear
                if (!reverse) {
                    sortedGuild = guildChar.sort((p, c) => p.gearLevel - c.gearLevel);
                } else {
                    sortedGuild = guildChar.sort((p, c) => c.gearLevel - p.gearLevel);
                }
            } else {
                return super.error(msg, message.language.get("COMMAND_GUILDSEARCH_BAD_SORT", sortType, ["name", "gp", "gear"]), {edit: true, example: "guildsearch c3po -sort gp"});
            }

            if (top) {
                if (!reverse) sortedGuild = sortedGuild.reverse();
                const start = reverse ? sortedGuild.length - top : 0;
                const end   = reverse ? sortedGuild.length       : top;
                sortedGuild = sortedGuild.slice(start, end);
                if (reverse) {
                    sortedGuild = sortedGuild.reverse();
                }
            }

            const charOut = {};
            for (const member of sortedGuild) {
                if (options.flags.zetas && !member.zetas.length) continue;

                if (isNaN(parseInt(member.starLevel))) member.starLevel = rarityMap[member.starLevel];
                const gearStr = "⚙" + member.gearLevel + " ".repeat(2 - member.gearLevel.toString().length);
                let z = " | ";
                zetas.forEach((zeta, ix) => {
                    const pZeta = member.zetas.find(pz => pz.id === zeta);
                    if (!pZeta) {
                        z += " ";
                    } else {
                        z += (ix + 1).toString();
                    }
                });
                const gpStr = parseInt(member.gp).toLocaleString();

                let uStr;
                if (member.starLevel > 0) {
                    if (options.flags.ships) {
                        uStr = `**\`[Lvl ${member.level} | ${gpStr + " ".repeat(6 - gpStr.length)}${maxZ > 0 ? z : ""}]\`** ${member.player}`;
                    } else {
                        uStr = `**\`[${gearStr} | ${gpStr + " ".repeat(6 - gpStr.length)}${maxZ > 0 ? z : ""}]\`** ${member.player}`;
                    }
                } else {
                    uStr = member.player;
                }

                uStr = Bot.expandSpaces(uStr);

                if (!charOut[member.starLevel]) {
                    charOut[member.starLevel] = [uStr];
                } else {
                    charOut[member.starLevel].push(uStr);
                }
            }

            const fields = [];
            let outArr;

            if (top) {
                outArr = Object.keys(charOut);
            } else {
                if (reverse) {
                    outArr = Object.keys(charOut).reverse();
                } else {
                    outArr = Object.keys(charOut);
                }
            }

            outArr.forEach(star => {
                if (star >= starLvl) {
                    const msgArr = Bot.msgArray(charOut[star], "\n", 700);
                    msgArr.forEach((msg, ix) => {
                        const name = star === 0 ? message.language.get("COMMAND_GUILDSEARCH_NOT_ACTIVATED", charOut[star].length) : message.language.get("COMMAND_GUILDSEARCH_STAR_HEADER", star, charOut[star].length);
                        fields.push({
                            name: msgArr.length > 1 ? name + ` (${ix+1}/${msgArr.length})` : name,
                            value: msgArr[ix]
                        });
                    });
                }
            });
            if (options.defaults) {
                fields.push({
                    name: "Default flags used:",
                    value: Bot.codeBlock(options.defaults)
                });
            }
            if (guild.warnings) {
                let warn = guild.warnings.join("\n");
                if (warn.length < 1024) {
                    warn = warn.slice(0,1000) + "...";
                }
                fields.push({
                    name: "Guild Roster Warnings",
                    value: warn
                });
            }
            if (guildGG.warnings) {
                let warn = guildGG.warnings.join("\n");
                if (warn.length < 1024) {
                    warn = warn.slice(0,1000) + "...";
                }
                fields.push({
                    name: "Guild Character Warnings",
                    value: warn
                });
            }

            fields.forEach(f => {
                if (f.value.length > 1000) {
                    f.value = f.value.slice(0,1000) +  "...";
                }
            });

            const footer = Bot.updatedFooter(guildGG.updated, message, "guild", cooldown);
            try {
                msg.edit({embed: {
                    author: {
                        name: message.language.get("BASE_SWGOH_NAMECHAR_HEADER_NUM", guild.name, character.name, totalUnlocked)
                    },
                    fields: fields,
                    footer: footer
                }});
            } catch (e) {
                Bot.log("ERROR", "Error sending message in guildsearch - " + e, {color: Bot.colors.red});
                console.log(fields);
            }
        }
    }
}

module.exports = GuildSearch;

