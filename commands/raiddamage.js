const Command = require("../base/Command");
const raids = require("../data/raiddmg.json");

class RaidDamage extends Command {
    constructor(client) {
        super(client, {
            name: "raiddamage",
            category: "SWGoH",
            enabled: true, 
            aliases: ["raiddmg", "rdmg", "convert"],
            permissions: ["EMBED_LINKS"]
        });
    }

    async run(client, message, [raid, phase, amt]) {
        const examples = [
            "raiddmg rancor 1 49%",
            `${message.guildSettings.prefix}raiddmg aat 3 100,000`
        ];
        if (!raid) {
            return super.error(message, message.language.get("COMMAND_RAIDDMG_RAID_STR", raids.map(r => r.name.toLowerCase())), {
                title: message.language.get("COMMAND_RAIDDMG_MISSING_RAID"), 
                example: examples.join("\n")
            });
        }
        raid = raid.toLowerCase();
        const thisRaid = raids.find(r => r.name.toLowerCase() === raid || r.aliases.includes(raid));
        if (!thisRaid) {
            return super.error(message, message.language.get("COMMAND_RAIDDMG_RAID_STR", raids.map(r => r.name.toLowerCase())), {
                title: message.language.get("COMMAND_RAIDDMG_MISSING_RAID"), 
                example: examples.join("\n")
            });
        }

        if (!phase) {
            return super.error(message, message.language.get("COMMAND_RAIDDMG_PHASE_STR", thisRaid.name, Object.keys(thisRaid.phases).map(ix => "`" + ix + "`: " + thisRaid.phases[ix].name.toProperCase()).join("\n")), {
                title: message.language.get("COMMAND_RAIDDMG_MISSING_PHASE"), 
                example: examples.join("\n")
            });
        }
        const thisPhase = thisRaid.phases[phase];
        if (!thisPhase) {
            return super.error(message, message.language.get("COMMAND_RAIDDMG_PHASE_STR", thisRaid.name, Object.keys(thisRaid.phases).map(ix => "`" + ix + "`: " + thisRaid.phases[ix].name.toProperCase()).join("\n")), {
                title: message.language.get("COMMAND_RAIDDMG_INVALID_PHASE"), 
                example: examples.join("\n")
            });
        }

        if (!amt) {
            return super.error(message, message.language.get("COMMAND_RAIDDMG_AMOUNT_STR"), {
                title: message.language.get("COMMAND_RAIDDMG_MISSING_AMT"), 
                example: examples.join("\n")
            });
        } 
        if (isNaN(parseInt(amt))) {
            return super.error(message, message.language.get("COMMAND_RAIDDMG_AMOUNT_STR"), {
                title: message.language.get("COMMAND_RAIDDMG_INVALID_AMT"), 
                example: examples.join("\n")
            });
        }
        let outAmt = "";
        const percent = amt.toString().endsWith("%");
        if (percent) {
            const tmpAmt = parseInt(amt.toString().replace(/\D/g, ""));
            outAmt = parseInt(tmpAmt * thisPhase.dmg).toLocaleString() + " " + message.language.get("COMMAND_RAIDDMG_DMG");
        } else {
            const tmpAmt = parseInt(amt.toString().replace(/\D/g, ""));
            amt = tmpAmt.toLocaleString();
            outAmt = (tmpAmt / thisPhase.dmg).toFixed(2).toLocaleString() + "%";
        }

        return message.channel.send({embed: {
            author: {
                name: message.language.get("COMMAND_RAIDDMG_OUT_HEADER", thisRaid.name.toProperCase(), thisPhase.name.toProperCase())
            },
            description: percent ? message.language.get("COMMAND_RAIDDMG_OUT_PERCENT", amt, outAmt) : message.language.get("COMMAND_RAIDDMG_OUT_DMG", amt, outAmt)
        }});
    } 
}

module.exports = RaidDamage;
