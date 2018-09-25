const Command = require("../base/Command");

class Charactergear extends Command {
    constructor(client) {
        super(client, {
            name: "charactergear",
            category: "Star Wars",
            aliases: ["chargear", "gear"]
        });
    }

    run(client, message, args) {
        const charList = client.characters;


        // The current max possible gear level
        const MAX_GEAR = 12;

        // Figure out where the gear level is in the command, and grab it
        let gearLvl = "";
        if (!args[0]) return message.channel.send(message.language.get("COMMAND_CHARGEAR_NEED_CHARACTER", message.guildSettings.prefix));

        if (args[1]) {
            gearLvl = parseInt(args[args.length - 1].replace(/\D/g, ""));
            if (gearLvl < 1 || gearLvl > MAX_GEAR || isNaN(gearLvl) ) {
                gearLvl = "";
            } else {
                // There is a valid gear level being requested
                gearLvl = "Gear " + gearLvl;
                args.splice(args.length - 1);
            }
        } else {
            gearLvl = "";
        }

        // Remove any junk from the name
        const searchName = String(args.join(" ")).toLowerCase().replace(/[^\w\s]/gi, "");

        // Check if it should send as an embed or a code block
        const guildConf = message.guildSettings;
        let embeds = true;
        if (message.guild) {
            if (guildConf["useEmbeds"] !== true || !message.channel.permissionsFor(client.user).has("EMBED_LINKS")) {
                embeds = false;
            }
        }

        // Make sure they gave a character to find
        if (searchName === "") {
            return message.channel.send(message.language.get("COMMAND_CHARGEAR_NEED_CHARACTER", message.guildSettings.prefix));
        }

        // Find any characters that match that
        const chars = client.findChar(searchName, charList);
        if (!chars || chars.length <= 0) {
            return message.channel.send(message.language.get("COMMAND_CHARGEAR_INVALID_CHARACTER", message.guildSettings.prefix));
        }

        if (!chars || chars.length === 0) {
            return message.channel.send(message.language.get("BASE_SWGOH_NO_CHAR_FOUND", searchName));
        } else if (chars.length > 1) {
            const charL = [];
            const charS = chars.sort((p, c) => p.name > c.name ? 1 : -1);
            charS.forEach(c => {
                charL.push(c.name);
            });
            return message.channel.send(message.language.get("BASE_SWGOH_CHAR_LIST", charL.join("\n")));
        }


        if (gearLvl === "") {
            chars.forEach(character => {
                const allGear = {};

                for (var level in character.gear) {
                    const thisLvl = character.gear[level];
                    for (var ix = 0; ix < thisLvl.length; ix++) {
                        if (!allGear[thisLvl[ix]]) { // If it"s not been checked yet
                            allGear[thisLvl[ix]] = 1;
                        } else { // It"s already in there
                            allGear[thisLvl[ix]] = allGear[thisLvl[ix]] + 1;
                        }
                    }
                }

                let gearString = "";
                for (var key in allGear) {
                    gearString += `* ${allGear[key]}x ${key}\n`;
                }
                message.channel.send(message.language.get("COMMAND_CHARGEAR_GEAR_ALL", character.name, gearString), {
                    code: "md",
                    split: true
                });
            });
        } else {
            // Format and send the requested data back
            chars.forEach(character => {
                const thisGear = character.gear[gearLvl];
                if (embeds) { // if Embeds are enabled
                    message.channel.send({
                        embed: {
                            "color": `${character.side === "light" ? 0x5114e0 : 0xe01414}`,
                            "author": {
                                "name": character.name,
                                "url": character.url,
                                "icon_url": character.avatarURL
                            },
                            "fields": [{
                                "name": gearLvl,
                                "value": `* ${thisGear.length > 0 ? thisGear.join("\n* ") : message.language.get("COMMAND_CHARGEAR_GEAR_NA")}`
                            }]
                        }
                    });
                } else { // Embeds are disabled
                    message.channel.send(` * ${character.name} * \n### ${gearLvl} ### \n* ${character.gear[gearLvl].join("\n* ")}`, {
                        code: "md"
                    });
                }
            });
        }
    }
}

module.exports = Charactergear;
