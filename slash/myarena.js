const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");
const {inspect} = require("util"); // eslint-disable-line no-unused-vars

// To get the player's arena info (Adapted from shittybill#3024's Scorpio)
class MyArena extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "myarena",
            guildOnly: false,
            description: "Show your current ranking in the character & fleet arenas",
            options: [
                {
                    name: "allycode",
                    description: "The ally code of the user you want to see",
                    type: ApplicationCommandOptionType.String
                },
                {
                    name: "stats",
                    type: ApplicationCommandOptionType.Boolean,
                    description: "Show some general stats for your arena team"
                }
            ]
        });
    }

    async run(Bot, interaction) { // eslint-disable-line no-unused-vars
        let allycode = interaction.options.getString("allycode");
        const showStats    = interaction.options.getBoolean("stats");

        allycode = await Bot.getAllyCode(interaction, allycode);

        if (!allycode) {
            return super.error(interaction, "Invalid user ID, you need to use either the `me` keyword if you have a registered ally code, an ally code, or mention a Discord user");
        }

        const cooldown = await Bot.getPlayerCooldown(interaction.user.id);
        let player;
        try {
            player = await Bot.swgohAPI.unitStats(allycode, cooldown);
            if (Array.isArray(player)) player = player[0];
        } catch (e) {
            Bot.logger.error("Broke getting player in myarena: " + e);
            return super.error(interaction, "Something broke, please try again in a bit");
        }

        if (!player || !player.arena) {
            return super.error(interaction, "Something broke when getting your info, please try again in a bit.");
        }

        const fields = [];
        const positions = [ "L|", "2|", "3|", "4|", "5|" ];
        const sPositions = [ "L|", "2|", "3|", "4|", "B|", "B|", "B|", "B|" ];

        let desc = "";
        if (!showStats) {
            // Grab the arena info
            const shipArena = await getArenaStrings(player, "ship");
            if (shipArena) fields.push(shipArena);

            const charArena = await getArenaStrings(player, "char");
            if (charArena) fields.push(charArena);
        } else {
            // If it's set to show stats, grab all the stats for each unit in the character arena team
            let playerStats = null;
            try {
                playerStats = await Bot.swgohAPI.unitStats(allycode, cooldown);
                if (Array.isArray(playerStats)) playerStats = playerStats[0];
            } catch (e) {
                console.log("[ERROR MyArena]");
                console.error(e);
                return super.error(interaction, Bot.codeBlock(e.interaction), {
                    title: interaction.language.get("BASE_SOMETHING_BROKE"),
                    footer: "Please try again in a bit."
                });
            }

            const chars = [];
            for (let ix = 0; ix < player.arena.char.squad.length; ix++) {
                const charId = player.arena.char.squad[ix].defId;
                const unitName = await getUnitName(player, charId);

                const thisChar = playerStats.roster.find(c => c.defId === charId);
                const speed    = thisChar.stats.final.Speed.toLocaleString();
                const health   = thisChar.stats.final.Health.toLocaleString();
                const prot     = thisChar.stats.final.Protection.toLocaleString();
                chars.push({
                    pos: positions[ix],
                    speed: speed,
                    health: health,
                    prot: prot,
                    name: unitName
                });
            }
            desc = Bot.makeTable({
                pos:    {value: "",    startWith: "`"},
                speed:  {value: "Spd", startWith: "[",  endWith: "|"},
                health: {value: "HP",                    endWith: "|"},
                prot:   {value: "Prot",                  endWith: "]`"},
                name:   {value: "",    align: "left"}
            }, chars).join("\n");
        }

        if (player.warnings) {
            fields.push({
                name: "Warnings",
                value: player.warnings.join("\n")
            });
        }

        const footer = Bot.updatedFooter(player.updated, interaction, "player", cooldown);
        return interaction.reply({
            embeds: [{
                author: {
                    name: interaction.language.get("COMMAND_MYARENA_EMBED_HEADER", player.name)
                },
                description: desc,
                fields: fields,
                footer: footer
            }]
        });

        async function getArenaStrings(player, type="char") {
            if (!player.arena?.[type]?.squad?.length) return null;
            const arenaArr = [];
            for (let ix = 0; ix < player.arena[type].squad.length; ix++) {
                const unitId = player.arena[type].squad[ix].defId;
                const unitName = await getUnitName(player, unitId);
                arenaArr.push(`\`${type === "char" ? positions[ix] : sPositions[ix]}\` ${unitName}`);
            }
            return {
                name: interaction.language.get(`COMMAND_MYARENA_${type === "char" ? "ARENA": "FLEET"}`, player.arena[type].rank),
                value: arenaArr.join("\n") + "\n`------------------------------`",
                inline: true
            };
        }

        async function getUnitName(player, defId) {
            const thisChar = player.roster.find(c => c.defId === defId);
            const thisLangChar = await Bot.swgohAPI.langChar(thisChar, interaction.guildSettings.swgohLanguage);
            const thisZ = thisLangChar.skills.filter(s => (s.isZeta && s.tier === s.tiers) || (s.isOmicron && s.tier >= s.tiers-1));
            if (thisLangChar.name && !thisLangChar.nameKey) thisLangChar.nameKey = thisLangChar.name;
            return `${"z".repeat(thisZ.length)}${thisLangChar.nameKey}`;
        }
    }
}

module.exports = MyArena;
