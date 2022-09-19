const Command = require("../base/slashCommand");
const { ApplicationCommandOptionType } = require("discord.js");

class Randomchar extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "randomchar",
            guildOnly: false,
            options: [
                {
                    name: "allycode",
                    description: "The ally code for the user you want to look up",
                    type: ApplicationCommandOptionType.String
                },
                {
                    name: "rarity",
                    description: "Choose a minimum rarity (Star level) to filter by",
                    type: ApplicationCommandOptionType.Integer,
                    choices: [
                        { name: "1*", value: 1 },
                        { name: "2*", value: 2 },
                        { name: "3*", value: 3 },
                        { name: "4*", value: 4 },
                        { name: "5*", value: 5 },
                        { name: "6*", value: 6 },
                        { name: "7*", value: 7 },
                    ]
                },
                {
                    name: "count",
                    description: "The number of characters to grab",
                    type: ApplicationCommandOptionType.Integer,
                    choices: [
                        { name: "1", value: 1 },
                        { name: "2", value: 2 },
                        { name: "3", value: 3 },
                        { name: "4", value: 4 },
                        { name: "5", value: 5 },
                    ]
                }
            ]
        });
    }

    async run(Bot, interaction) {
        let chars = Bot.characters;
        const MAX_CHARACTERS = 5;
        const charOut = [];

        let star = interaction.options.getInteger("rarity");
        if (!star) star = 1;

        let count = interaction.options.getInteger("count");
        if (!count) count = MAX_CHARACTERS;

        let allycode = interaction.options.getString("allycode");
        allycode = await Bot.getAllyCode(interaction, allycode, false);

        if (allycode) {
            // If there is a valid allycode provided, grab the user's roster
            const cooldown = await Bot.getPlayerCooldown(interaction.user.id);
            let player = null;
            try {
                player = await Bot.swgohAPI.unitStats(allycode, cooldown);
                if (Array.isArray(player)) player = player[0];
            } catch (e) {
                console.error(e);
                return super.error(interaction, Bot.codeBlock(e.message), {
                    title: interaction.language.get("BASE_SOMETHING_BROKE"),
                    footer: "Please try again in a bit."
                });
            }

            // Filter out all the ships from the player's roster, so it only shows characters
            // Replace the default list with this
            chars = player.roster.filter(c => c.combatType === 1);

            // If they're looking for a certain min star lvl, filter out everything lower
            if (star) {
                chars = chars.filter(c => c.rarity >= star);
            }

            // In case a new player tries using it before they get enough characters?
            if (chars.length < MAX_CHARACTERS) count = chars.length;
        }

        while (charOut.length < count) {
            const newIndex = Math.floor(Math.random() * chars.length);
            const newChar = chars[newIndex];
            let name;
            if (newChar.name) {
                name = newChar.name;
            } else if (newChar.defId) {
                const playerChar = await Bot.swgohAPI.units(newChar.defId);
                name = playerChar.nameKey;
            }
            if (!charOut.includes(name)) {    // If it's already picked a character, don't let it pick them again
                charOut.push(name);
            }
        }
        const charString = charOut.join("\n");

        return interaction.reply({content: Bot.codeBlock(charString)});
    }
}
module.exports = Randomchar;
