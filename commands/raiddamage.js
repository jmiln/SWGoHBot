const Command = require("../base/Command");
const raids = require("../data/raiddmg.js");

class RaidDamage extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "raiddamage",
            category: "SWGoH",
            enabled: true,
            aliases: ["raiddmg", "rdmg", "convert", "raidd", "raid"],
            permissions: ["EMBED_LINKS"]
        });
    }

    async run(Bot, message, [raid, phase, amt]) {
        const examples = [
            "raiddmg rancor 1 49%",
            `${message.guildSettings.prefix}raiddmg aat 3 100,000`
        ];
        if (!raid) {
            return super.error(message, message.language.get("COMMAND_RAIDDAMAGE_RAID_STR", raids.map(r => r.name.toLowerCase())), {
                title: message.language.get("COMMAND_RAIDDAMAGE_MISSING_RAID"),
                example: examples.join("\n")
            });
        }
        raid = raid.toLowerCase();
        const thisRaid = raids.find(r => r.name.toLowerCase() === raid || r.aliases.includes(raid));
        if (!thisRaid) {
            return super.error(message, message.language.get("COMMAND_RAIDDAMAGE_RAID_STR", raids.map(r => r.name.toLowerCase())), {
                title: message.language.get("COMMAND_RAIDDAMAGE_MISSING_RAID"),
                example: examples.join("\n")
            });
        }

        if (!phase) {
            return super.error(message, message.language.get("COMMAND_RAIDDAMAGE_PHASE_STR", thisRaid.name, Object.keys(thisRaid.phases).map(ix => "`" + ix + "`: " + Bot.toProperCase(thisRaid.phases[ix].name)).join("\n")), {
                title: message.language.get("COMMAND_RAIDDAMAGE_MISSING_PHASE"),
                example: examples.join("\n")
            });
        }
        if (phase.toLowerCase().startsWith("p")) {
            phase = phase.replace(/p/i, "");
        }
        const thisPhase = thisRaid.phases[phase];
        if (!thisPhase) {
            return super.error(message, message.language.get("COMMAND_RAIDDAMAGE_PHASE_STR", thisRaid.name, Object.keys(thisRaid.phases).map(ix => "`" + ix + "`: " + Bot.toProperCase(thisRaid.phases[ix].name)).join("\n")), {
                title: message.language.get("COMMAND_RAIDDAMAGE_INVALID_PHASE"),
                example: examples.join("\n")
            });
        }

        if (!amt) {
            return super.error(message, message.language.get("COMMAND_RAIDDAMAGE_AMOUNT_STR"), {
                title: message.language.get("COMMAND_RAIDDAMAGE_MISSING_AMT"),
                example: examples.join("\n")
            });
        }
        if (isNaN(parseInt(amt, 10))) {
            return super.error(message, message.language.get("COMMAND_RAIDDAMAGE_AMOUNT_STR"), {
                title: message.language.get("COMMAND_RAIDDAMAGE_INVALID_AMT"),
                example: examples.join("\n")
            });
        }
        let outAmt = "";
        const percent = amt.toString().endsWith("%");
        const tmpAmt = parseInt(amt, 10);
        amt = tmpAmt.toLocaleString();
        if (percent) {
            amt = amt + "%";
            outAmt = parseInt((tmpAmt * thisPhase.dmg) / 100, 10).toLocaleString() + " " + message.language.get("COMMAND_RAIDDAMAGE_DMG");
        } else {
            outAmt = (100 * (tmpAmt / thisPhase.dmg)).toFixed(2).toLocaleString() + "%";
        }

        return message.channel.send({embeds: [{
            author: {
                name: message.language.get("COMMAND_RAIDDAMAGE_OUT_HEADER", Bot.toProperCase(thisRaid.name), Bot.toProperCase(thisPhase.name))
            },
            description: percent ? message.language.get("COMMAND_RAIDDAMAGE_OUT_PERCENT", amt, outAmt) : message.language.get("COMMAND_RAIDDAMAGE_OUT_DMG", amt, outAmt)
        }]});
    }
}

module.exports = RaidDamage;
