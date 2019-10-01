const Command = require("../base/Command");

class Randomchar extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "randomchar",
            aliases: ["rand", "random"],
            category: "Star Wars",
            permissions: ["EMBED_LINKS"],
            subArgs: {
                star: {
                    aliases: ["rarity"]
                }
            }
        });
    }

    async run(Bot, message, [userID, count], options) {
        let chars = Bot.characters;
        let MAX_CHARACTERS = 5;

        const charOut = [];

        let allyCode;
        if (userID) {
            allyCode = await super.getUser(message, userID, false);
            if (allyCode) {
                // If there is a valid userID, and an allycode linked to it
                const cooldown = await Bot.getPlayerCooldown(message.author.id);
                let player = null;
                try {
                    player = await Bot.swgohAPI.player(allyCode, cooldown);
                } catch (e) {
                    console.error(e);
                    return super.error(message, Bot.codeBlock(e.message), {
                        title: message.lanugage.get("BASE_SOMETHING_BROKE"),
                        footer: "Please try again in a bit."
                    });
                }
                // Filter out all the ships, so it only shows characters
                chars = player.roster.filter(c => !c.crew.length);

                // If they're looking for a certain min star lvl, filter out everything lower
                if (options.subArgs.star) {
                    const star = parseInt(options.subArgs.star);
                    if (!isNaN(star) && star <= 7 && star > 0) {
                        chars = chars.filter(c => c.rarity >= star);
                    } else {
                        return super.error(message, "Invalid star level. Only 1-7 are supported.");
                    }
                }

                // In case a new player tries using it before they get enough characters?
                if (chars.length < MAX_CHARACTERS) MAX_CHARACTERS = chars.length;
                if (count) {
                    count = parseInt(count);
                    if (count <= 0) {
                        count = 1;
                    } else if (count > MAX_CHARACTERS) {
                        count = MAX_CHARACTERS;
                    }
                } else {
                    count = MAX_CHARACTERS;
                }
            } else {
                if (count) {
                    // They must have put in a bad user?
                    return super.error(message, "Could not find any characters to pick from");
                }
                // The userID was probably a #
                userID = parseInt(userID);
                if (userID > 0 && !isNaN(userID) && userID <= MAX_CHARACTERS) {
                    count = userID;
                } else if (userID <= 0) {
                    count = 1;
                } else {
                    count = MAX_CHARACTERS;
                }
            }
        } else {
            count = MAX_CHARACTERS;
        }

        const charCount = chars.length;
        while (charOut.length < count) {
            const newIndex = Math.floor(Math.random()*charCount);
            const newChar = chars[newIndex];
            let name;
            if (newChar.name) {
                name = newChar.name;
            } else if (newChar.defId) {
                name = await Bot.swgohAPI.units(newChar.defId);
                name = name.nameKey;
            }
            if (!charOut.includes(name)) {    // If it's already picked a character, don't let it pick them again
                charOut.push(name);
            }
        }
        const charString = charOut.join("\n");

        return message.channel.send("```\n" + charString + "```");
    }
}
module.exports = Randomchar;
