const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");
const unitChecklist = require("../data/unitChecklist.js");

class TerritoryWar extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "territorywar",
            guildOnly: false,
            options: [
                {
                    name: "allycode_1",
                    type: ApplicationCommandOptionType.String,
                    description: "Ally code for player 1",
                    required: true
                },
                {
                    name: "allycode_2",
                    type: ApplicationCommandOptionType.String,
                    description: "Ally code for player 2",
                    required: true
                }
            ]
        });
    }

    async run(Bot, interaction) {
        const problemArr = [];

        await interaction.reply({content: "> Please wait while I look up the info."});
        const cooldown = await Bot.getPlayerCooldown(interaction.user.id);

        // Get the first user's ally code if possible
        const user1str = interaction.options.getString("allycode_1");
        const user1 = await Bot.getAllyCode(interaction, user1str);
        if (!user1) {
            if (user1str === "me") {
                problemArr.push(interaction.language.get("COMMAND_GRANDARENA_UNREGISTERED"));
            } else {
                problemArr.push(interaction.language.get("COMMAND_GRANDARENA_INVALID_USER", 1));
            }
        }

        // Get the second user's ally code if possible
        const user2str = interaction.options.getString("allycode_2");
        const user2 = await Bot.getAllyCode(interaction, user2str);
        if (!user2) {
            if (user2str === "me") {
                problemArr.push(interaction.language.get("COMMAND_GRANDARENA_UNREGISTERED"));
            } else {
                problemArr.push(interaction.language.get("COMMAND_GRANDARENA_INVALID_USER", 2));
            }
        }

        if (problemArr.length) {
            return super.error(interaction, Bot.codeBlock(problemArr.map(p => "* " + p).join("\n")));
        } else {
            interaction.editReply({content: "> Found matching ally codes for both users, getting guilds..."});
        }

        // Get the name & ally code for each player in each of the guilds
        let guild1 = null;
        try {
            guild1 = await Bot.swgohAPI.guild(user1, null, cooldown);
            if (!guild1?.roster?.length) {
                problemArr.push(`The guild for ${user1} did not come back with anyone in it`);
            }
        } catch (err) {
            problemArr.push(`I could not find a guild for "${user1}"`);
        }

        let guild2 = null;
        try {
            guild2 = await Bot.swgohAPI.guild(user2, null, cooldown);
        } catch (err) {
            problemArr.push(`I could not find a guild for "${user2str}"`);
        }

        if (problemArr.length) {
            return super.error(interaction, Bot.codeBlock(problemArr.map(p => "* " + p).join("\n")));
        } else {
            interaction.editReply({content: "> Found guilds for both ally codes, getting stats..."});
        }

        // Run each of the players through to get the stats of each players' roster
        let guild1Stats = null;
        const guild1AbilityStats = {zetas: 0, omicrons: 0, twOmicrons: 0};
        try {
            guild1Stats = await Bot.swgohAPI.unitStats(guild1.roster.map(p => p.allyCode), cooldown);
            for (const player of guild1Stats) {
                if (!player?.roster) continue;
                for (const unit of player.roster) {
                    guild1AbilityStats.zetas      += unit.skills.filter(s => s.isZeta    && s.tier >= s.zetaTier).length;
                    guild1AbilityStats.omicrons   += unit.skills.filter(s => s.isOmicron && s.tier >= s.omicronTier).length;
                    guild1AbilityStats.twOmicrons += unit.skills.filter(s => s.isOmicron && s.tier >= s.omicronTier && Bot.omicrons.tw.includes(s.id)).length;
                }
            }
        } catch (err) {
            problemArr.push(`I could not get stats for ${user1str}'s guild`);
        }

        let guild2Stats = null;
        const guild2AbilityStats = {zetas: 0, omicrons: 0, twOmicrons: 0};
        try {
            guild2Stats = await Bot.swgohAPI.unitStats(guild2.roster.map(p => p.allyCode), cooldown);
            for (const player of guild2Stats) {
                if (!player?.roster) continue;
                for (const unit of player.roster) {
                    guild2AbilityStats.zetas      += unit.skills.filter(s => s.isZeta    && s.tier >= s.zetaTier).length;
                    guild2AbilityStats.omicrons   += unit.skills.filter(s => s.isOmicron && s.tier >= s.omicronTier).length;
                    guild2AbilityStats.twOmicrons += unit.skills.filter(s => s.isOmicron && s.tier >= s.omicronTier && Bot.omicrons.tw.includes(s.id)).length;
                }
            }
        } catch (err) {
            problemArr.push(`I could not get stats for ${user2str}'s guild`);
        }

        if (problemArr.length) {
            return super.error(interaction, Bot.codeBlock(problemArr.map(p => "* " + p).join("\n")));
        } else {
            interaction.editReply({content: "> Got stats for both guilds, processing now..."});
        }

        // Localized labels for each row
        const labels = interaction.language.get("COMMAND_GRANDARENA_COMP_NAMES");

        // An array to stick all the fields in as we go.
        const fields = [];

        // The GP stats
        const gpStats = [];
        const guild1GP = { char: 0, ship: 0, total: guild1.gp };
        const guild2GP = { char: 0, ship: 0, total: guild2.gp };

        for (const member of guild1.roster) {
            guild1GP.char += member.gpChar;
            guild1GP.ship += member.gpShip;
        }
        for (const member of guild2.roster) {
            guild2GP.char += member.gpChar;
            guild2GP.ship += member.gpShip;
        }

        // Overall basic gp stats
        gpStats.push({
            check: labels.charGP,
            user1: Bot.shortenNum(guild1GP.char, 2),
            user2: Bot.shortenNum(guild2GP.char, 2)
        });
        gpStats.push({
            check: labels.shipGP,
            user1: Bot.shortenNum(guild1GP.ship, 2),
            user2: Bot.shortenNum(guild2GP.ship, 2)
        });
        gpStats.push({
            check: "Avg GP",
            user1: Bot.shortenNum(guild1GP.total / guild1.roster.length, 2),
            user2: Bot.shortenNum(guild2GP.total / guild2.roster.length, 2)
        });
        gpStats.push({
            check: "Total GP",
            user1: Bot.shortenNum(guild1GP.total, 2),
            user2: Bot.shortenNum(guild2GP.total, 2)
        });

        fields.push({
            name: "GP Stats Overview",
            value: Bot.codeBlock(Bot.makeTable({
                check: {value: "", align: "left", endWith: "::"},
                user1: {value: "", endWith: "vs", align: "right"},
                user2: {value: "", align: "left"}
            }, gpStats, {useHeader: false}).join("\n"), "asciiDoc")
        });


        // Overall counts for zetas/ omicrons
        const abilityStats = [];
        abilityStats.push({
            check: labels.zetas,
            user1: guild1AbilityStats.zetas,
            user2: guild2AbilityStats.zetas
        });
        abilityStats.push({
            check: labels.twOmicrons,
            user1: guild1AbilityStats.twOmicrons,
            user2: guild2AbilityStats.twOmicrons
        });
        abilityStats.push({
            check: labels.omicrons,
            user1: guild1AbilityStats.omicrons,
            user2: guild2AbilityStats.omicrons
        });

        fields.push({
            name: "Ability Stats Overview",
            value: "*How many abilities with zetas/ omicrons*" + Bot.codeBlock(Bot.makeTable({
                check: {value: "", align: "left", endWith: "::"},
                user1: {value: "", endWith: "vs", align: "right"},
                user2: {value: "", align: "left"}
            }, abilityStats, {useHeader: false}).join("\n"), "asciiDoc")
        });

        // Get the overall gear levels for each user
        let gearOverview = [];
        const [g1GearLvls, g1AvgGear] = Bot.summarizeCharLevels(guild1Stats, "gear");
        const [g2GearLvls, g2AvgGear] = Bot.summarizeCharLevels(guild2Stats, "gear");
        const maxGear = Math.max(Math.max(...Object.keys(g1GearLvls).map(g => parseInt(g, 10))), Math.max(...Object.keys(g2GearLvls).map(g => parseInt(g, 10))));
        for (let ix = maxGear-3; ix <= maxGear; ix++) {
            gearOverview.push({
                check: `G${ix}`,
                user1: g1GearLvls[ix] ? g1GearLvls[ix] : "N/A",
                user2: g2GearLvls[ix] ? g2GearLvls[ix] : "N/A"
            });
        }
        gearOverview.push({
            check: "Avg Gear",
            user1: g1AvgGear,
            user2: g2AvgGear
        });
        gearOverview = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, gearOverview, {useHeader: false}).join("\n"), "asciiDoc");
        fields.push({
            name: "Character Gear Counts",
            value: "*How many characters at each gear level*" + gearOverview
        });


        // Get the overall relic levels for each user
        let relicOverview = [];
        const [g1RelicLvls, g1AvgRelic] = Bot.summarizeCharLevels(guild1Stats, "relic");
        const [g2RelicLvls, g2AvgRelic] = Bot.summarizeCharLevels(guild2Stats, "relic");
        const maxRelic = Math.max(
            Math.max(...Object.keys(g1RelicLvls).map(g => parseInt(g, 10))),
            Math.max(...Object.keys(g2RelicLvls).map(g => parseInt(g, 10)))
        );
        for (let ix = 1; ix <= maxRelic; ix++) {
            relicOverview.push({
                check: `R${ix}`,
                user1: g1RelicLvls[ix] ? g1RelicLvls[ix] : 0,
                user2: g2RelicLvls[ix] ? g2RelicLvls[ix] : 0
            });
        }
        relicOverview.push({
            check: "Avg Relic",
            user1: g1AvgRelic,
            user2: g2AvgRelic
        });
        relicOverview = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, relicOverview, {useHeader: false}).join("\n"), "asciiDoc");
        fields.push({
            name: "Character Relic Counts",
            value: "*How many characters at each relic level*" + relicOverview
        });


        // Get the overall rarity levels for each user
        let rarityOverview = [];
        const [g1RarityLvls, g1AvgRarity] = Bot.summarizeCharLevels(guild1Stats, "rarity");
        const [g2RarityLvls, g2AvgRarity] = Bot.summarizeCharLevels(guild2Stats, "rarity");
        const maxRarity = Math.max(Math.max(...Object.keys(g1RarityLvls).map(g => parseInt(g, 10))), Math.max(...Object.keys(g2RarityLvls).map(g => parseInt(g, 10))));
        for (let ix = maxRarity-3; ix <= maxRarity; ix++) {
            rarityOverview.push({
                check: `${ix}*`,
                user1: g1RarityLvls[ix] ? g1RarityLvls[ix] : 0,
                user2: g2RarityLvls[ix] ? g2RarityLvls[ix] : 0
            });
        }
        rarityOverview.push({
            check: "Avg Rarity",
            user1: g1AvgRarity,
            user2: g2AvgRarity
        });
        rarityOverview = Bot.codeBlock(Bot.makeTable({
            check: {value: "", align: "left", endWith: "::"},
            user1: {value: "", endWith: "vs", align: "right"},
            user2: {value: "", align: "left"}
        }, rarityOverview, {useHeader: false}).join("\n"), "asciiDoc");

        fields.push({
            name: "Character Rarity Counts",
            value: "*How many characters at each rarity level*" + rarityOverview
        });


        // Get some general stats for any available galactic legends
        const legendMap = unitChecklist.charChecklist["Galactic Legends"];

        const guild1GLCount = {};
        const guild1GLUltCount = {};
        const guild2GLCount = {};
        const guild2GLUltCount = {};
        for (const [glDefId,] of legendMap) {
            guild1GLCount[glDefId] = 0;
            guild1GLUltCount[glDefId] = 0;
            guild2GLCount[glDefId] = 0;
            guild2GLUltCount[glDefId] = 0;
        }
        for (const member of guild1Stats) {
            const glList = member.roster.filter(ch => legendMap.map(leg => leg[0]).includes(ch.defId));
            for (const gl of glList) {
                guild1GLCount[gl.defId] += 1;
                if (gl.purchasedAbilityId?.length) {
                    guild1GLUltCount[gl.defId] += 1;
                }
            }
        }
        for (const member of guild2Stats) {
            const glList = member.roster.filter(ch => legendMap.map(leg => leg[0]).includes(ch.defId));
            for (const gl of glList) {
                guild2GLCount[gl.defId] += 1;
                if (gl.purchasedAbilityId?.length) {
                    guild2GLUltCount[gl.defId] += 1;
                }
            }
        }

        const glOverview = [];
        for (const [glDefId, glName] of legendMap) {
            glOverview.push({
                check: glName,
                user1: guild1GLCount[glDefId] + "+" + guild1GLUltCount[glDefId],
                user2: guild2GLCount[glDefId] + "+" + guild1GLUltCount[glDefId]
            });
        }
        fields.push({
            name: "Galactic Legend Overview",
            value: "*How many Galactic Legends each guild has*\nFormat is `Activated Count`**+**`Ult Count`\n" + Bot.codeBlock(Bot.makeTable({
                check: {value: "", align: "left", endWith: "::"},
                user1: {value: "", endWith: "vs", align: "right"},
                user2: {value: "", align: "left"}
            }, glOverview, {useHeader: false}).join("\n"), "asciiDoc")
        });


        // Get the overall counts for capital ships
        const capitalMap = unitChecklist.shipChecklist["Capital Ships"];
        const guild1CapitalCount = {};
        const guild2CapitalCount = {};
        for (const [capitalDefId,] of capitalMap) {
            guild1CapitalCount[capitalDefId] = 0;
            guild2CapitalCount[capitalDefId] = 0;
        }
        for (const member of guild1Stats) {
            const capitalList = member.roster.filter(ch => capitalMap.map(leg => leg[0]).includes(ch.defId));
            for (const capital of capitalList) {
                guild1CapitalCount[capital.defId] += 1;
            }
        }
        for (const member of guild2Stats) {
            const capitalList = member.roster.filter(ch => capitalMap.map(leg => leg[0]).includes(ch.defId));
            for (const capital of capitalList) {
                guild2CapitalCount[capital.defId] += 1;
            }
        }

        const capitalOverview = [];
        for (const [capitalDefId, capitalName] of capitalMap) {
            capitalOverview.push({
                check: capitalName,
                user1: guild1CapitalCount[capitalDefId],
                user2: guild2CapitalCount[capitalDefId]
            });
        }
        fields.push({
            name: "Capital Ship Overview",
            value: "*How many of each Capital Ship each guild has*\n" + Bot.codeBlock(Bot.makeTable({
                check: {value: "", align: "left", endWith: "::"},
                user1: {value: "", endWith: "vs", align: "right"},
                user2: {value: "", align: "left"}
            }, capitalOverview, {useHeader: false}).join("\n"), "asciiDoc")
        });



        const footer = Bot.updatedFooter(Math.min(user1.updated, user2.updated), interaction, "player", cooldown);
        return interaction.editReply({
            content: null,
            embeds: [{
                author: {
                    // name: interaction.language.get("COMMAND_GRANDARENA_OUT_HEADER", guild1.name, guild2.name)
                    name: `Territory War, ${guild1.name} (${guild1.roster.length}) vs ${guild2.name} (${guild2.roster.length})`
                },
                fields: fields,
                footer: footer
            }]
        });
    }
}

module.exports = TerritoryWar;