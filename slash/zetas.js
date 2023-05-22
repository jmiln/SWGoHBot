const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class Zetas extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "zetas",
            guildOnly: false,
            options: [
                {
                    name: "guild",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "See a list of zetas for your whole guild",
                    options: [
                        {
                            name: "allycode",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            description: "The ally code of a player in the guild you want to see"
                        },
                        {
                            name: "character",
                            autocomplete: true,
                            type: ApplicationCommandOptionType.String,
                            description: "Just show the zeta'd abilities for a specific character"
                        },
                    ]
                },
                {
                    name: "player",
                    type: ApplicationCommandOptionType.Subcommand,
                    description: "See a player's zetas",
                    options: [
                        {
                            name: "allycode",
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            description: "The ally code of the player you want to see."
                        },
                        {
                            name: "character",
                            autocomplete: true,
                            type: ApplicationCommandOptionType.String,
                            description: "Just show the zeta'd abilities for a specific character"
                        },
                    ]
                }
            ]
        });
    }

    async run(Bot, interaction) {
        let allycode = interaction.options.getString("allycode");
        allycode = await Bot.getAllyCode(interaction, allycode);
        if (!allycode) {
            return super.error(interaction, "I could not find a match for the provided ally code.");
        }

        const subCommand = interaction.options.getSubcommand(true);

        let character = null;
        const searchChar = interaction.options.getString("character");
        // If a character was entered, see if it can find a match to display later
        if (searchChar) {
            const chars = Bot.findChar(searchChar, Bot.characters);

            if (chars.length > 1) {
                const charL = [];
                const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
                charS.forEach(c => {
                    charL.push(c.name);
                });
                return super.error(interaction, interaction.language.get("COMMAND_GUILDSEARCH_CHAR_LIST", charL.join("\n")));
            } else if (chars.length === 1) {
                character = chars[0];
            } else {
                // No character found
                return super.error(interaction, interaction.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchChar));
            }
        }

        const cooldown = await Bot.getPlayerCooldown(interaction.user.id);

        let player;
        try {
            player = await Bot.swgohAPI.unitStats(allycode, cooldown);
            if (Array.isArray(player)) player = player[0];
        } catch (e) {
            Bot.logger.error("Error: Broke while trying to get player data in zetas: " + e);
            return super.error(interaction, (interaction.language.get("BASE_SWGOH_NO_ACCT")), {edit: true});
        }

        if (!player?.roster) return super.error(interaction, "I cannot get this player's info right now. Please try again later");

        // Filter out all the ships, so it only has to check through characters
        player.roster = player.roster.filter(ch => ch.combatType === 1);

        if (subCommand === "player") {
            // Display zetas for a single player
            const zetas = {};
            let count = 0;
            const character = null;

            // This will grab the character info for any entered character
            const getCharInfo = async (thisChar) => {
                thisChar = await Bot.swgohAPI.langChar(thisChar, interaction.guildSettings.swgohLanguage);
                if (!thisChar.nameKey) {
                    const tmp = Bot.characters.filter(c => c.uniqueName === thisChar.defId);
                    if (tmp.length) {
                        thisChar.nameKey = tmp[0].name;
                    }
                }
                thisChar.skills.forEach(skill => {
                    if ((skill.isOmicron && skill.isZeta && skill.tier >= skill.tiers-1) || (!skill.isOmicron && skill.isZeta && skill.tier === skill.tiers)) {
                        count++;
                        // If the character is not already listed, add it
                        if (!zetas[thisChar.nameKey]) {
                            zetas[thisChar.nameKey] = ["`[" + skill.id.charAt(0).toUpperCase() + "]` " + skill.nameKey];
                        } else {
                            zetas[thisChar.nameKey].push("`[" + skill.id.charAt(0).toUpperCase() + "]` " + skill.nameKey);
                        }
                    }
                });
            };

            await interaction.reply({ content: interaction.language.get("BASE_SWGOH_PLS_WAIT_FETCH", "zetas") });

            const desc = [], author = {}, fields = [];
            if (character) {
                // Grab just the one character from the roster
                const char = player.roster.find(c => c.defId === character.uniqueName);
                await getCharInfo(char);
                const sorted = Object.keys(zetas).sort((p, c) => p > c ? 1 : -1);

                author.name = `${player.name}'s ${character.name} (${count})`;
                author.icon_url = character.avatarURL;
                if (!zetas[sorted[0]] || zetas[sorted[0]].length === 0) {
                    desc.push(interaction.language.get("COMMAND_ZETA_NO_ZETAS"));
                } else {
                    desc.push(zetas[sorted[0]].join("\n"));
                }
            } else {
                // Loop through and get all of the applicable ones
                for (const char of player.roster) {
                    await getCharInfo(char);
                }
                const sorted = Object.keys(zetas).sort((p, c) => p > c ? 1 : -1);
                const formatted = sorted.map(character => `\`(${zetas[character].length})\` ${character}`);
                const chunked = Bot.chunkArray(formatted, 45);

                author.name = interaction.language.get("COMMAND_ZETA_ZETAS_HEADER", player.name, count);
                desc.push("`------------------------------`");
                chunked.forEach(chunk => {
                    fields.push({
                        name: "-",
                        value: chunk.join("\n")
                    });
                });
                fields.push({name: "-", value: interaction.language.get("COMMAND_ZETA_MORE_INFO")});
            }

            if (player.warnings) {
                fields.push({
                    name: "Warnings",
                    value: player.warnings.join("\n")
                });
            }

            const footer = Bot.updatedFooter(player.updated, interaction, "player", cooldown);
            return interaction.editReply({content: null, embeds: [{
                color: Bot.constants.colors.black,
                author: author,
                description: desc.join("\n"),
                fields: fields,
                footer: footer
            }]});
        } else if (subCommand === "guild") {
            // Display the zetas for the whole guild (Takes a while)
            await interaction.reply({content: interaction.language.get("COMMAND_ZETA_WAIT_GUILD")});

            let guild = null;
            let guildGG = null;

            try {
                guild = await Bot.swgohAPI.guild(player.allyCode, cooldown);
                // TODO  Lang this
                if (!guild) return super.error(interaction, "Cannot find guild");
                if (!guild.roster) return super.error(interaction, "Cannot find your guild's roster");
            } catch (e) {
                return super.error(interaction, e.message);
            }
            try {
                guildGG = await Bot.swgohAPI.unitStats(guild.roster.map(p => p.allyCode), cooldown);
            } catch (e) {
                super.error(interaction, e.message, {edit: true});
            }

            const zetas = {};

            for (const player of guildGG) {
                for (const char of player.roster) {
                    char.zetas = char.skills.filter(s => (s.isOmicron && s.isZeta && s.tier >= s.tiers-1) || (!s.isOmicron && s.isZeta && s.tier === s.tiers));
                    if (char.zetas.length) {
                        char.zetas.forEach(s => {
                            if (!zetas[char.defId]) {
                                zetas[char.defId] = {};
                            }

                            zetas[char.defId][s.id] ? zetas[char.defId][s.id].push(player.name) : zetas[char.defId][s.id] = [player.name];
                        });
                    }
                }
            }


            const zOut = [];
            const fields = [];
            if (!character) {
                // They want to see all zetas for the guild
                for (const char of Object.keys(zetas)) {
                    const outObj = {};
                    outObj.name = "**" + Bot.characters.find(c => c.uniqueName === char).name + "**";
                    outObj.abilities = "";
                    for (const skill of Object.keys(zetas[char])) {
                        const s = await Bot.swgohAPI.abilities(skill, null, {min: true});
                        outObj.abilities += `\`${zetas[char][skill].length}\`: ${s[0].nameKey}\n`;
                    }
                    zOut.push(outObj);
                }
                const sortedChars = zOut
                    .sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1)
                    .map(c => c.name + "\n" + c.abilities);
                const MAX_FIELDS = 5;
                const msgArr = Bot.msgArray(sortedChars, "", 1000);
                msgArr.forEach(m => {
                    fields.push({
                        name: "____",
                        value: m,
                        inline: true
                    });
                });
                const fieldArrChunks = Bot.chunkArray(fields, MAX_FIELDS);
                const footer = Bot.updatedFooter(guild.updated, interaction, "guild", cooldown);

                for (const [index, fieldChunk] of fieldArrChunks.entries()) {
                    if (index === 0) {
                        interaction.editReply({content: null, embeds: [{
                            author: {
                                name: interaction.language.get("COMMAND_ZETA_ZETAS_HEADER", guild.name)
                            },
                            fields: fieldChunk,
                            footer: footer
                        }]});
                    } else {
                        interaction.followUp({embeds: [{
                            fields: fieldChunk,
                            footer: footer
                        }]});
                    }
                }
            } else {
                for (const skill of Object.keys(zetas[character.uniqueName])) {
                    const name = await Bot.swgohAPI.abilities(skill, null, {min: true});
                    fields.push({
                        name: name[0].nameKey,
                        value: zetas[character.uniqueName][skill].join("\n")
                    });
                }
                const footer = Bot.updatedFooter(guild.updated, interaction, "guild", cooldown);
                return interaction.editReply({embeds: [{
                    author: {
                        name: interaction.language.get("COMMAND_ZETA_ZETAS_HEADER", guild.name)
                    },
                    fields: fields,
                    footer: footer
                }]});
            }

        }
    }
}

module.exports = Zetas;
