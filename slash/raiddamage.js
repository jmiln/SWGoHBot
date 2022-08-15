const Command = require("../base/slashCommand");
const fs = require("fs");
const raids = JSON.parse(fs.readFileSync("../data/raiddmg.json", {encoding: "utf-8"}));

class RaidDamage extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "raiddamage",
            enabled: true,
            guildOnly: false,
            options: [
                {
                    name: "raid",
                    description: "The raid you want to calculate for",
                    type: "STRING",
                    required: true,
                    choices: [
                        {
                            name: "Rancor",
                            value: "Rancor"
                        },
                        {
                            name: "Challenge Rancor",
                            value: "cRancor"
                        },
                        {
                            name: "HAAT",
                            value: "HAAT"
                        },
                        {
                            name: "Heroic Sith",
                            value: "Sith"
                        }
                    ]
                },
                {
                    name: "phase",
                    description: "Which of the 4 phases you want to calculate",
                    type: "STRING",
                    required: true,
                    choices: [
                        {
                            name: "Phase 1",
                            value: "1"
                        },
                        {
                            name: "Phase 2",
                            value: "2"
                        },
                        {
                            name: "Phase 3",
                            value: "3"
                        },
                        {
                            name: "Phase 4",
                            value: "4"
                        },
                    ]
                },
                {
                    name: "amount",
                    description: "What amount of the damage you want to calculate, damage number or percentage",
                    type: "STRING",
                    required: true
                }
            ]
        });
    }

    async run(Bot, interaction) {
        const raid = interaction.options.getString("raid");
        const phase = interaction.options.getString("phase");
        let amount = interaction.options.getString("amount");

        const thisRaid = raids.find(r => r.name === raid);

        const thisPhase = thisRaid.phases[phase];

        if (isNaN(parseInt(amount, 10))) {
            return super.error(interaction, interaction.language.get("COMMAND_RAIDDAMAGE_AMOUNT_STR"), {
                title: interaction.language.get("COMMAND_RAIDDAMAGE_INVALID_AMT")
            });
        }
        let outAmt = "";
        const percent = amount.toString().endsWith("%");
        const tmpAmount = parseInt(amount, 10);
        amount = tmpAmount.toLocaleString();

        if (percent) {
            amount = amount + "%";
            outAmt = ((tmpAmount * thisPhase.dmg) / 100).toLocaleString() + " " + interaction.language.get("COMMAND_RAIDDAMAGE_DMG");
        } else {
            outAmt = (100 * (tmpAmount / thisPhase.dmg)).toFixed(2).toLocaleString() + "%";
        }

        return interaction.reply({embeds: [{
            author: {
                name: interaction.language.get("COMMAND_RAIDDAMAGE_OUT_HEADER", Bot.toProperCase(thisRaid.name), Bot.toProperCase(thisPhase.name))
            },
            description: percent ? interaction.language.get("COMMAND_RAIDDAMAGE_OUT_PERCENT", amount, outAmt) : interaction.language.get("COMMAND_RAIDDAMAGE_OUT_DMG", amount, outAmt)
        }]});
    }
}

module.exports = RaidDamage;
