import { ApplicationCommandOptionType } from "discord.js";
import Command from "../base/slashCommand.ts";
import config from "../config.js";
import cache from "../modules/cache.ts";
import type { BotInteraction, BotType, UserConfig } from "../types/types.ts";

export default class ArenaAlert extends Command {
    constructor(Bot: BotType) {
        super(Bot, {
            name: "arenaalert",
            description: "Change settings for your arena alerts",
            guildOnly: false,
            options: [
                {
                    name: "enabledms",
                    type: ApplicationCommandOptionType.String,
                    description: "Set if it's going to DM you for jumps",
                    choices: [
                        {
                            name: "All",
                            value: "all",
                        },
                        {
                            name: "Primary",
                            value: "primary",
                        },
                        {
                            name: "Off",
                            value: "off",
                        },
                    ],
                },
                {
                    name: "arena",
                    type: ApplicationCommandOptionType.String,
                    description: "Set which arena it will watch.",
                    choices: [
                        {
                            name: "Char",
                            value: "char",
                        },
                        {
                            name: "Fleet",
                            value: "fleet",
                        },
                        {
                            name: "Both",
                            value: "both",
                        },
                    ],
                },
                {
                    name: "payout_result",
                    type: ApplicationCommandOptionType.String,
                    description: "Send you a DM with your final payout result",
                    choices: [
                        {
                            name: "On",
                            value: "on",
                        },
                        {
                            name: "Off",
                            value: "off",
                        },
                    ],
                },
                {
                    name: "payout_warning",
                    type: ApplicationCommandOptionType.Integer,
                    description: "(0-1439) Send you a DM the set number of min before your payout. 0 to turn it off.",
                    minValue: 0,
                    maxValue: 1440,
                },
            ],
        });
    }

    async run(Bot: BotType, interaction: BotInteraction) {
        const enabledms = interaction.options.getString("enabledms");
        const arena = interaction.options.getString("arena");
        const payoutResult = interaction.options.getString("payout_result");
        const payoutWarning = interaction.options.getInteger("payout_warning");

        // Grab the user's info
        const userID = interaction.user.id;
        const user = (await cache.getOne(config.mongodb.swgohbotdb, "users", { id: userID })) as UserConfig;
        if (!user) {
            return super.error(interaction, "I couldn't find your data. Please try again.");
        }

        // Make sure the user is a patreon
        const pat = await Bot.getPatronUser(userID);
        if (!pat || pat.amount_cents < 100) {
            return super.error(interaction, interaction.language.get("COMMAND_ARENAALERT_PATREON_ONLY"));
        }

        if (!enabledms && !arena && !payoutResult && !payoutWarning && payoutWarning !== 0) {
            // If none of the arguments are used, just view
            return interaction.reply({
                embeds: [
                    {
                        title: interaction.language.get("COMMAND_ARENAALERT_VIEW_HEADER"),
                        description: [
                            `${interaction.language.get("COMMAND_ARENAALERT_VIEW_DM")}: **${
                                user.arenaAlert.enableRankDMs ? user.arenaAlert.enableRankDMs : "N/A"
                            }**`,
                            `${interaction.language.get("COMMAND_ARENAALERT_VIEW_SHOW")}: **${user.arenaAlert.arena}**`,
                            `${interaction.language.get("COMMAND_ARENAALERT_VIEW_WARNING")}: **${
                                user.arenaAlert.payoutWarning ? `${user.arenaAlert.payoutWarning} min` : "disabled"
                            }**`,
                            `${interaction.language.get("COMMAND_ARENAALERT_VIEW_RESULT")}: **${
                                user.arenaAlert.enablePayoutResult ? "ON" : "OFF"
                            }**`,
                        ].join("\n"),
                    },
                ],
            });
        }

        const { changelog, updatedUser } = this.computeArenaAlertChanges(user, {
            enabledms,
            arena,
            payoutResult,
            payoutWarning,
        });

        // TODO Get a res from this, so it can be replied to more accurately
        await cache.put(config.mongodb.swgohbotdb, "users", { id: userID }, updatedUser);
        if (!changelog?.length) {
            return super.success(interaction, "It looks like nothing was updated.");
        }
        return super.success(interaction, changelog.join("\n"));
    }

    private computeArenaAlertChanges(
        user: UserConfig,
        input: {
            enabledms?: string;
            arena?: string;
            payoutResult?: string;
            payoutWarning?: number | null;
        },
    ): { changelog: string[]; updatedUser: UserConfig } {
        const changelog: string[] = [];
        const updatedUser = structuredClone(user);

        const { enabledms, arena, payoutResult, payoutWarning } = input;

        // ArenaAlert -> activate/ deactivate (All, Primary, Off)
        if (enabledms && updatedUser.arenaAlert.enableRankDMs !== enabledms) {
            changelog.push(`Changed EnableDMs from ${updatedUser.arenaAlert.enableRankDMs} to ${enabledms}`);
            updatedUser.arenaAlert.enableRankDMs = enabledms;
        }

        // Set which of the arenas to watch (Char, Fleet, Both)
        if (arena && updatedUser.arenaAlert.arena !== arena) {
            changelog.push(`Changed arena from ${updatedUser.arenaAlert.arena} to ${arena}`);
            updatedUser.arenaAlert.arena = arena;
        }

        // Set payout result DM preference (On, Off)
        if (payoutResult && updatedUser.arenaAlert.payoutResult !== payoutResult) {
            changelog.push(`Changed Payout Result from ${updatedUser.arenaAlert.payoutResult} to ${payoutResult}`);
            updatedUser.arenaAlert.payoutResult = payoutResult;
        }

        // Set payout warning
        if (payoutWarning !== undefined && payoutWarning !== null && !Number.isNaN(payoutWarning)) {
            if (payoutWarning < 0 || payoutWarning > 1439) {
                changelog.push(`Cannot change the Payout Warning to ${payoutWarning}. Value must be between 0 and 1439`);
            } else if (updatedUser.arenaAlert.payoutWarning !== payoutWarning) {
                changelog.push(`Changed Payout Warning from ${updatedUser.arenaAlert.payoutWarning} to ${payoutWarning}`);
                updatedUser.arenaAlert.payoutWarning = payoutWarning;
            }
        }

        return { changelog, updatedUser };
    }
}
