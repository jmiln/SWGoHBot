const Command = require("../base/Command");

class Randomchar extends Command {
    constructor(client) {
        super(client, {
            name: "randomchar",
            aliases: ["rand", "random"],
            category: "Star Wars"
        });
    }

    async run(client, message, [userID, count]) {
        let chars = client.characters;
        let MAX_CHARACTERS = 5;

        const charOut = [];
        let msg;

        let allyCode;
        if (userID) {
            allyCode = await super.getUser(message, userID, false);
            if (allyCode) {
                // If there is a valid userID, and an allycode linked to it
                const cooldown = client.getPlayerCooldown(message.author.id);
                let player = null;
                try {
                    player = await client.swgohAPI.player(allyCode, cooldown);
                } catch (e) {
                    console.error(e);
                    return msg.edit({embed: {
                        author: {name: message.language.get("BASE_SOMETHING_BROKE")},
                        description: client.codeBlock(e.message) + "Please try again in a bit"
                    }});
                } 
                // Filter out all the ships, so it only shows characters
                chars = player.roster.filter(c => !c.crew.length);
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
                    // TODO Tell em something is wrong?
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
                name = await client.swgohAPI.units(newChar.defId);
                name = name.nameKey;
            }
            if (!charOut.includes(name)) {    // If it's already picked a character, don't let it pick them again
                charOut.push(name);
            }
        }
        const charString = charOut.join("\n");

        message.channel.send("```\n" + charString + "```");
    }
}
module.exports = Randomchar;
