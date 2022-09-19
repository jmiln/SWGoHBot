const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class Versus extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "versus",
            guildOnly: false,
            enabled: true,
            options: [
                {
                    name: "allycode_1",
                    description: "The ally code of the first user you want to compare",
                    type: ApplicationCommandOptionType.String,
                    required: true
                },
                {
                    name: "allycode_2",
                    description: "The ally code of the second user you want to compare",
                    type: ApplicationCommandOptionType.String,
                    required: true
                },
                {
                    name: "character",
                    description: "A character you want to compare the stats of",
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        });
    }

    async run(Bot, interaction) {
        const statList = [
            {stat: "Health",                   short: "Health"},
            {stat: "Protection",               short: "Prot"  },
            {stat: "Speed",                    short: "Speed" },
            {stat: "Armor",                    short: "Armor" },
            {stat: "Physical Damage",          short: "P Dmg" },
            {stat: "Physical Critical Chance", short: "P Crit"},
            {stat: "Special Damage",           short: "S Dmg" },
            {stat: "Special Critical Chance",  short: "S Crit"},
            {stat: "Critical Damage",          short: "Crit D"},
            {stat: "Potency",                  short: "Pot"   },
            {stat: "Tenacity",                 short: "Ten"   }
        ];
        const user1str = interaction.options.getString("allycode_1");
        const user2str = interaction.options.getString("allycode_2");
        const character = interaction.options.getString("character");
        /*
         * If user1str AND user2str are both valid users, use both
         *
         * If only user2str is valid, spit out an error
         *
         * If only user1str is valid, set it up for user2 and grab the primary code if available
         *  -- If there is no valid primary/ linked allycode for author, spit out an error
         *  -- In this case, tack whatever user2str is onto the beginning of the character array
         *
         * Once both users are validated in some way, check against the character, get a valid baseId and go from there.
         *  -- If character is invalid, spit out an error
         */

        await interaction.reply({content: "Please wait while I process your data."});

        let user1 = await Bot.getAllyCode(interaction, user1str, false);
        let user2 = await Bot.getAllyCode(interaction, user2str, false);

        if (!user1 && !user2) {
            return super.error(interaction, "Both ally codes were invalid");
        } else if (!user1) {
            // Spit out an error because the interaction author is not registered
            return super.error(interaction, "Ally code #1 was invalid");
        } else if (!user2) {
            // Something went wrong with user2, let's spit out an error
            return super.error(interaction, "Ally code #2 was invalid");
        }

        // If it got this far, it has 2 users and a character that needs checking.
        let char = Bot.findChar(character, Bot.characters);
        if (!char.length) {
            char = Bot.findChar(character, Bot.ships, true);
        }
        if (!char.length) {
            return super.error(interaction, interaction.language.get("COMMAND_GRANDARENA_INVALID_CHAR", character));
        } else if (char.length > 1) {
            // If found more than 1 match
            return super.error(interaction, interaction.language.get("COMMAND_GUILDSEARCH_CHAR_LIST", char.map(c => c.name).join("\n")));
        } else {
            // It only found one match
            if (Array.isArray(char)) char = char[0];
        }

        const cooldown = await Bot.getPlayerCooldown(interaction.user.id);
        try {
            user1 = await Bot.swgohAPI.unitStats(user1, cooldown);
            if (Array.isArray(user1)) user1 = user1[0];
        } catch (e) {
            return super.error(interaction, "Something broke when getting user 1");
        }
        try {
            user2 = await Bot.swgohAPI.unitStats(user2, cooldown);
            if (Array.isArray(user2)) user2 = user2[0];
        } catch (e) {
            return super.error(interaction, "Something broke when getting user 2");
        }
        const errArr = [];
        if (!user1?.roster?.length) {
            errArr.push("User 1 is missing pieces, please try again later.");
        }
        if (!user2?.roster?.length) {
            errArr.push("User 2 is missing pieces, please try again later.");
        }
        if (errArr.length) {
            return super.error(interaction, errArr.join("\n"));
        }

        // From here, we should have both user's rosters, so grab the characters and make the table
        const char1 = user1.roster.find(c => c.defId === char.uniqueName);
        const char2 = user2.roster.find(c => c.defId === char.uniqueName);

        if (!char1 && !char2) {
            return super.error(interaction, "Neither user seems to have that character unlocked!") ;
        }

        const isShip = (char1 ? char1.combatType : char2.combatType) === 1 ? false : true;

        const genOut = [];

        // Stick the level in
        genOut.push({
            stat: "Lvl",
            user1: char1?.level,
            user2: char2?.level
        });

        // Add in the Star level / rarity
        genOut.push({
            stat: "Rarity",
            user1: char1?.rarity,
            user2: char2?.rarity
        });

        if (!isShip) {
            // Add in the zeta count
            const user1Zetas = char1?.skills.filter(sk => sk.isZeta && sk.tiers === sk.tier).length;
            const user2Zetas = char2?.skills.filter(sk => sk.isZeta && sk.tiers === sk.tier).length;
            if (user1Zetas || user2Zetas) {
                genOut.push({
                    stat: "Zetas",
                    user1: user1Zetas,
                    user2: user2Zetas
                });
            }

            // Add in the gear level
            genOut.push({
                stat: "Gear",
                user1: char1?.gear,
                user2: char2?.gear
            });

            const user1Relic = char1?.relic?.currentTier - 2;
            const user2Relic = char2?.relic?.currentTier - 2;
            if (user1Relic || user2Relic) {
                genOut.push({
                    stat: "Relic",
                    user1: user1Relic > 0 ? user1Relic : "N/A",
                    user2: user2Relic > 0 ? user2Relic : "N/A",
                });
            }

            const user1Ult = char1?.purchasedAbilityId?.length;
            const user2Ult = char2?.purchasedAbilityId?.length;
            if (user1Ult || user2Ult) {
                genOut.push({
                    stat: "Ultimate",
                    user1: user1Ult > 0 ? "✓" : "N/A",
                    user2: user2Ult > 0 ? "✓" : "N/A",
                });
            }
        }

        const generalTable = Bot.makeTable({
            stat:  {value: "Stat", align: "right", endWith: "::"},
            user1: {value: user1.name, align: "right", endWith: "vs"},
            user2: {value: user2.name, align: "left"}
        }, genOut, {boldHeader: false, useHeader: false});

        // For each stat in a list, add onto the statOut array
        const statOut = [];
        statList.forEach(stat => {
            const s1 = char1?.stats?.final[stat.stat];
            const s2 = char2?.stats?.final[stat.stat];
            statOut.push({
                stat: stat.short,
                user1: s1 ? (s1 % 1 === 0 ? s1.toLocaleString() : (s1 * 100).toFixed(2)+"%") : "N/A",
                user2: s2 ? (s2 % 1 === 0 ? s2.toLocaleString() : (s2 * 100).toFixed(2)+"%") : "N/A",
            });
        });

        const langChar = await Bot.swgohAPI.langChar({defId: char1 ? char1.defId : char2.defId});
        const charName = langChar.nameKey;
        const statTable = Bot.makeTable({
            stat:  {value: "Stat", align: "right", endWith: "::"},
            user1: {value: user1.name, align: "right", endWith: "vs"},
            user2: {value: user2.name, align: "left"}
        }, statOut, {boldHeader: false, useHeader: false});

        const footer = Bot.updatedFooter(Math.min(user1.updated, user2.updated), interaction, "player", cooldown);
        return interaction.editReply({content: null, embeds: [{
            title: `${user1.name} vs. ${user2.name} (${charName})`,
            fields: [
                {
                    name: "General Info",
                    value: Bot.codeBlock(generalTable.join("\n"), "asciidoc")
                },
                {
                    name: "Stats",
                    value: Bot.codeBlock(statTable.join("\n"), "asciidoc")
                }
            ],
            footer: footer
        }]});
    }
}

module.exports = Versus;

