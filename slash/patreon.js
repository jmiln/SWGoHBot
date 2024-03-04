const { ApplicationCommandOptionType } = require("discord.js");
const Command = require("../base/slashCommand");
const patreonInfo = require("../data/patreon.js");
const { addServerSupporter, clearSupporterInfo } = require("../modules/guildConfig/patreonSettings");

class Patreon extends Command {
    constructor(Bot) {
        super(Bot, {
            name: "patreon",
            enabled: true,
            guildOnly: false,
            options: [
                {
                    name: "commands",
                    description: "Show the available Patreon related commands.",
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: "cooldowns",
                    description: "Show your current gamedata cooldowns",
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: "benefits",
                    description: "Show the various benefits from supporting through Patreon.",
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: "my_info",
                    description: "Show what benefits your currently have available to you",
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: "set_server",
                    description: "Select this server to share your patreon benefits with",
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: "unset_server",
                    description: "Unset your selected server",
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        });
    }

    async run(Bot, interaction) {
        const subCom = interaction.options.getSubcommand() || "none";
        const fields = [];
        let description = null;
        let ephemeral = false;

        switch (subCom) {
            case "benefits": {
                // Spit out the benefits data
                for (const tier of Object.keys(patreonInfo.tiers)) {
                    const thisTier = patreonInfo.tiers[tier];
                    if (!thisTier?.benefits) continue;

                    fields.push({
                        name: `${thisTier.name} - $${tier}`,
                        value: [
                            `>>> Player data updates: **every ${getCooldowns(thisTier.playerTime)}**`,
                            `Guild data updates: **every ${getCooldowns(thisTier.guildTime)}**`,
                            "",
                            `**__BENEFITS__:**${parseInt(tier, 10) > 1 ? "\nEverything above +\n" : ""}`,
                            Object.keys(thisTier.benefits).map(ben => {
                                return `**${ben}**:\n${thisTier.benefits[ben]}`;
                            }).join("\n\n")
                        ].join("\n")
                    });
                }
                break;
            }
            case "cooldowns": {
                const currentCooldowns = await Bot.getPlayerCooldown(interaction.user.id, interaction?.guild?.id || null);
                return interaction.reply({
                    content: null,
                    embeds: [{
                        title: `${interaction.user.displayName}'s Current Cooldowns`,
                        description: `Player: ${getCooldowns(currentCooldowns.player)}\nGuild: ${getCooldowns(currentCooldowns.guild)}`
                    }]
                });
            }
            case "commands": {
                // Spit out the commands data
                const info = patCmdinfo();
                fields.push(info);
                break;
            }
            case "set_server": {
                // Grab the current server and set it to the user's selected server to support with their patreon subscription
                //  - If they're not a subscriber, reply with an error
                const pat = await Bot.getPatronUser(interaction.user.id);
                if (!pat) {
                    return super.error(interaction, "Sorry, but you need to be subscribed through [Patreon](https://patreon.com/swgohbot) in order to select a server.");
                }

                const userInfo = {
                    userId: interaction.user.id,
                    tier: Math.floor(pat.amount_cents / 100)
                };
                const res = await addServerSupporter({cache: Bot.cache, guildId: interaction.guild.id, userInfo});
                if (res.user.error || res.guild.error) {
                    return super.error(interaction, `Something went wrong when I tried to update your settings.\n\nUser error: ${res.user.error || "N/A"}\nGuild Error: ${res.guild.error || "N/A"}`);
                }
                // TODO Better wording?
                //  - You are now supporting this server?
                //  - You have now selected this server to share your sub benefits with
                return super.success(interaction, "Server set as your primary to share your subscriber benefits with!");
            }
            case "unset_server": {
                // Remove the user from whichever server they have set as their bonusServer, and clear the bonusServer from their settings
                const userConf = await Bot.userReg.getUser(interaction.user.id);
                if (!userConf?.bonusServer?.length) {
                    return super.error(interaction, "Sorry, but it doesn't look like you have a bonus server set");
                }

                const clearRes = await clearSupporterInfo({cache: Bot.cache, userId: interaction.user.id});

                if (clearRes.user.error || clearRes.guild.error) {
                    return super.error(interaction, `Something went wrong when I tried to update your settings.\n\nUser error: ${clearRes.user.error || "N/A"}\nGuild Error: ${clearRes.guild.error || "N/A"}`);
                }
                // TODO Better wording?
                return super.success(interaction, "I've removed the server you'd set to share with.");
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

                    // Show which server they have marked to support/ share the benefits with
                    const userConf = await Bot.userReg.getUser(interaction.user.id);
                    fields.push({
                        name: "Selected Server",
                        value: userConf?.bonusServer ? `<#${userConf.bonusServer}>` : "N/A"
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
                        if (!thisT?.benefits) continue;
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
        return `${mins} minute${mins > 1 ? "s" : ""}`;
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
