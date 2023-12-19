const { ApplicationCommandOptionType } = require("discord.js");
const Command = require("../base/slashCommand");
const patreonInfo = require("../data/patreon.js");

class Patreon extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "patreon",
            enabled: true,
            guildOnly: false,
            options: [
                {
                    name: "display",
                    description: "Choose what to show",
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        {
                            name: "Commands",
                            value: "commands"
                        },
                        {
                            name: "Benefits",
                            value: "benefits"
                        },
                        {
                            name: "my_info",
                            value: "my_info"
                        }
                    ]
                }
            ]
        });
    }

    async run(Bot, interaction) {
        const display = interaction.options.getString("display") || "none";
        const fields = [];
        let description = null;
        let ephemeral = false;

        switch (display) {
            case "benefits": {
                // Spit out the benefits data
                for (const tier of Object.keys(patreonInfo.tiers)) {
                    const thisTier = patreonInfo.tiers[tier];

                    fields.push({
                        name: `${thisTier.name} - $${tier}`,
                        value: [
                            `>>> Player data updates: **every ${getCooldowns(thisTier.playerTime)}**`,
                            `Guild data updates: **every ${getCooldowns(thisTier.guildTime)}**`,
                            "",
                            `**__Benefits__:**${parseInt(tier, 10) > 1 ? "\nEverything above +" : ""}`,
                            Object.keys(thisTier.benefits).map(ben => {
                                return `${ben}:\n${thisTier.benefits[ben]}`;
                            }).join("\n\n")
                        ].join("\n")
                    });
                }
                break;
            }
            case "commands": {
                // Spit out the commands data
                const info = patCmdinfo();
                fields.push(info);
                break;
            }
            case "my_info":
            default: {
                const pat = await Bot.getPatronUser(interaction.user.id);
                ephemeral = true;

                if (!pat || pat.amount_cents < 100) {
                    // If the user isn't subscribed, say so, provide a link to show more & show command examples
                    description = "You are not currently subscribed through [Patreon](https://patreon.com/swgohbot)";

                    const info = patCmdinfo();
                    fields.push(info);
                } else {
                    // If they are subscribed, show what they have available
                    const tierNum = getTier(pat.amount_cents);
                    const thisTier = patreonInfo.tiers[tierNum];

                    // Player-specific pulls: patreonInfo.tiers[tier].playerTime
                    // Guild-specific pulls: patreonInfo.tiers[tier].guildTime
                    description = `**__${thisTier.name} tier__**:`;
                    fields.push({
                        name: "Pull Times",
                        value: [
                            `>>> Player data pulls: **2hr** => **${getCooldowns(thisTier.playerTime)}**`,
                            `Guild data pulls: **6hr** ${(thisTier.guildTime/60) < 6 ? `=> **${getCooldowns(thisTier.guildTime)}**` : ""}`
                        ].join("\n")
                    });

                    // Benefits: patreonInfo[tier].benefits
                    //   - For this, it'd be everything prior + each new bit
                    const tiers = Object.keys(patreonInfo.tiers)
                        .map(t => parseInt(t, 10))  // Make sure they're numbers instead of strings
                        .filter(t => t < tierNum)   // Grab just the ones under the current tier
                        .sort().reverse();          // Sort it backwards so it's highest first
                    const outObj = {...thisTier.benefits};
                    for (const t of tiers) {
                        const thisT = patreonInfo.tiers[t];
                        for (const benefit of Object.keys(thisT.benefits)) {
                            if (!outObj[benefit]) {
                                outObj[benefit] = thisT.benefits[benefit];
                            }
                        }
                    }
                    fields.push({
                        name: "Command Benefits",
                        value: ">>> " + Object.keys(outObj).map(ben => `**${ben}:** ${outObj[ben]}`).join("\n")
                    });
                }
                break;
            }
        }

        return interaction.reply({
            embeds: [{
                author: {name: interaction.user.username + "'s current Patreon info"},
                description: description,
                fields: fields,
            }],
            ephemeral: ephemeral
        });
    }
}

function getCooldowns(mins) {
    if (mins < 60) {
        return `${mins} minutes`;
    }
    return `${mins/60} hour${mins/60 > 1 ? "s" : ""}`;
}

function getTier(amount_cents) {
    const tier100Cent = amount_cents / 100;
    if (tier100Cent >= 10) {
        return 10;
    } else if (tier100Cent >= 5) {
        return 5;
    } else {
        return 1;
    }
}

function patCmdinfo() {
    const patreonValue = [];
    for (const cmd of Object.keys(patreonInfo.commands)) {
        patreonValue.push(...[
            "",
            `**__${cmd}__**`,
            patreonInfo.commands[cmd]
        ]);
    }
    return {
        name: "Patreon Commands",
        value: ">>> " + patreonValue.join("\n")
    };
}

module.exports = Patreon;
