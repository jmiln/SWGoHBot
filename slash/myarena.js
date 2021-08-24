const Command = require("../base/slashCommand");
const {inspect} = require("util"); // eslint-disable-line no-unused-vars

// To get the player's arena info (Adapted from shittybill#3024's Scorpio)
class MyArena extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "myarena",
            category: "SWGoH",
            aliases: ["ma", "userarena", "ua"],
            permissions: ["EMBED_LINKS"],
            flags: {
                stats: {
                    aliases: ["s"]
                }
            },
            options: [
                {
                    name: "allycode",
                    description: "The ally code of the user you want to see",
                    type: "STRING"
                },
                {
                    name: "stats",
                    type: "BOOLEAN",
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

        if (!showStats && player.arena.ship.squad && player.arena.ship.squad.length) {
            const sArena = [];
            for (let ix = 0; ix < player.arena.ship.squad.length; ix++) {
                const ship = player.arena.ship.squad[ix];
                let thisShip = player.roster.find(s => s.defId === ship.defId);
                thisShip = await Bot.swgohAPI.langChar(thisShip, interaction.guildSettings.swgohLanguage);
                if (thisShip.name && !thisShip.nameKey) thisShip.nameKey = thisShip.name;
                sArena.push(`\`${sPositions[ix]}\` ${thisShip.nameKey}`);
            }
            fields.push({
                name: interaction.language.get("COMMAND_MYARENA_FLEET", player.arena.ship.rank),
                value: sArena.join("\n") + "\n`------------------------------`",
                inline: true
            });
        }

        let desc = "";
        if (!showStats) {
            const cArena = [];
            for (let ix = 0; ix < player.arena.char.squad.length; ix++) {
                const char = player.arena.char.squad[ix];
                let thisChar = player.roster.find(c => c.defId === char.defId);        // Get the character
                thisChar = await Bot.swgohAPI.langChar(thisChar, interaction.guildSettings.swgohLanguage);
                const thisZ = thisChar.skills.filter(s => s.isZeta && s.tier === s.tiers);    // Get the zetas of that character
                if (thisChar.name && !thisChar.nameKey) thisChar.nameKey = thisChar.name;
                cArena.push(`\`${positions[ix]}\` ${"z".repeat(thisZ.length)}${thisChar.nameKey}`);
            }
            fields.push({
                name: interaction.language.get("COMMAND_MYARENA_ARENA", player.arena.char.rank),
                value: cArena.join("\n") + "\n`------------------------------`",
                inline: true
            });
        } else {
            let playerStats = null;
            try {
                playerStats = await Bot.swgohAPI.unitStats(allycode, cooldown);
                if (Array.isArray(playerStats)) playerStats = playerStats[0];
            } catch (e) {
                console.error(e);
                return super.error(interaction, Bot.codeBlock(e.interaction), {
                    title: interaction.language.get("BASE_SOMETHING_BROKE"),
                    footer: "Please try again in a bit."
                });
            }
            const chars = [];
            // player.arena.char.squad.forEach((char, ix) => {
            for (let ix = 0; ix < player.arena.char.squad.length; ix++) {
                const char = player.arena.char.squad[ix];
                let thisChar = playerStats.roster.find(c => c.defId === char.defId);        // Get the character
                thisChar = await Bot.swgohAPI.langChar(thisChar, interaction.guildSettings.swgohLanguage);
                const thisZ = thisChar.skills.filter(s => s.isZeta && s.tier === s.tiers);    // Get the zetas of that character
                if (thisChar.name && !thisChar.nameKey) thisChar.nameKey = thisChar.name;
                const cName = `**${"z".repeat(thisZ.length)}${thisChar.nameKey}**`;
                const speed  = thisChar.stats.final.Speed.toLocaleString();
                const health = thisChar.stats.final.Health.toLocaleString();
                const prot   = thisChar.stats.final.Protection.toLocaleString();
                chars.push({
                    pos: positions[ix],
                    speed: speed,
                    health: health,
                    prot: prot,
                    name: cName
                });
            }
            desc = Bot.makeTable({
                pos: {value: "", startWith: "`"},
                speed:{value:  "Spd", startWith: "[", endWith: "|"},
                health: {value: "HP", endWith: "|"},
                prot: {value: "Prot", endWith: "]`"},
                name: {value: "", align: "left"}
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
    }
}

module.exports = MyArena;
