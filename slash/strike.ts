import {
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    EmbedBuilder,
    InteractionContextType,
} from "discord.js";
import Command from "../base/slashCommand.ts";
import { env } from "../config/config.ts";
import constants from "../data/constants/constants.ts";
import cache from "../modules/cache.ts";
import { expandSpaces, msgArray, msgArrayToFields } from "../modules/functions.ts";
import {
    addStrike,
    clearStrikes,
    getActiveStrikes,
    getAllStrikes,
    getPlayerStrikes,
    revokeStrike,
} from "../modules/guildConfig/strikes.ts";
import swgohAPI from "../modules/swapi.ts";
import type { PlayerStrikes, Strike } from "../types/guildConfig_types.ts";
import type { CommandContext } from "../types/types.ts";

export default class StrikeCommand extends Command {
    static readonly metadata = {
        name: "strike",
        category: "Admin",
        contexts: [InteractionContextType.Guild],
        description: "Track guild member strikes and offenses",
        options: [
            {
                name: "add",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Add a strike to a guild member",
                options: [
                    {
                        name: "allycode",
                        type: ApplicationCommandOptionType.Integer,
                        description: "The guild member's ally code",
                        required: true,
                    },
                    {
                        name: "reason",
                        type: ApplicationCommandOptionType.String,
                        description: "Reason for the strike",
                        required: true,
                    },
                    {
                        name: "expires",
                        type: ApplicationCommandOptionType.Integer,
                        description: "Number of days until this strike expires (omit for permanent)",
                        required: false,
                        minValue: 1,
                    },
                ],
            },
            {
                name: "revoke",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Revoke a strike — it remains visible in the member's history",
                options: [
                    {
                        name: "allycode",
                        type: ApplicationCommandOptionType.Integer,
                        description: "The guild member's ally code",
                        required: true,
                        autocomplete: true,
                    },
                    {
                        name: "strike_id",
                        type: ApplicationCommandOptionType.String,
                        description: "The strike to revoke",
                        required: true,
                        autocomplete: true,
                    },
                ],
            },
            {
                name: "clear",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Clear all strikes (including history) for a guild member",
                options: [
                    {
                        name: "allycode",
                        type: ApplicationCommandOptionType.Integer,
                        description: "The guild member's ally code",
                        required: true,
                        autocomplete: true,
                    },
                ],
            },
            {
                name: "view",
                type: ApplicationCommandOptionType.Subcommand,
                description: "View active and historical strikes for a guild member",
                options: [
                    {
                        name: "allycode",
                        type: ApplicationCommandOptionType.Integer,
                        description: "The guild member's ally code",
                        required: true,
                        autocomplete: true,
                    },
                ],
            },
            {
                name: "list",
                type: ApplicationCommandOptionType.Subcommand,
                description: "List members with active strikes, or a guild's full roster with strike counts",
                options: [
                    {
                        name: "guild",
                        type: ApplicationCommandOptionType.String,
                        description: "Filter by guild (shows full roster with strike counts)",
                        required: false,
                        autocomplete: true,
                    },
                    {
                        name: "sort",
                        type: ApplicationCommandOptionType.String,
                        description: "Sort order (default: name)",
                        required: false,
                        choices: [
                            { name: "Name", value: "name" },
                            { name: "Strikes (highest first)", value: "strikes" },
                        ],
                    },
                ],
            },
        ],
    };

    constructor() {
        super(StrikeCommand.metadata);
    }

    async run({ interaction, permLevel }: CommandContext) {
        if (!interaction.guild) {
            return super.error(interaction, "This command can only be used in a server.");
        }

        const action = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        const adminActions = ["add", "revoke", "clear"];
        if (adminActions.includes(action) && (permLevel ?? 0) < constants.permMap.GUILD_ADMIN) {
            return super.error(interaction, "You need the admin role to use this command.");
        }

        switch (action) {
            case "add":
                return this.handleAdd(interaction, guildId);
            case "revoke":
                return this.handleRevoke(interaction, guildId);
            case "clear":
                return this.handleClear(interaction, guildId);
            case "view":
                return this.handleView(interaction, guildId);
            case "list":
                return this.handleList(interaction, guildId);
        }
    }

    private async handleAdd(interaction: ChatInputCommandInteraction, guildId: string) {
        const allyCode = interaction.options.getInteger("allycode", true);
        const reason = interaction.options.getString("reason", true);
        const expiresDays = interaction.options.getInteger("expires");

        const cached = (await cache.getOne(env.MONGODB_SWAPI_DB, "players", { allyCode })) as {
            name: string;
            guildId?: string;
            guildName?: string;
        } | null;

        let playerName: string;
        let playerGuildId: string | undefined;
        let playerGuildName: string | undefined;

        if (cached) {
            playerName = cached.name;
            playerGuildId = cached.guildId;
            playerGuildName = cached.guildName;
        } else {
            const swapiPlayer = await swgohAPI.player(allyCode);
            if (!swapiPlayer) {
                return super.error(interaction, `No player found for ally code ${allyCode}.`);
            }
            playerName = swapiPlayer.name;
            playerGuildId = swapiPlayer.guildId;
            playerGuildName = swapiPlayer.guildName;
        }

        const strike: Strike = {
            id: crypto.randomUUID(),
            reason,
            issuedBy: interaction.user.id,
            issuedAt: Date.now(),
            ...(typeof expiresDays === "number" ? { expiresAt: Date.now() + expiresDays * 86400000 } : {}),
        };

        const playerInfo: Omit<PlayerStrikes, "strikes"> = {
            allyCode,
            playerName,
            guildId: playerGuildId ?? "unknown",
            guildName: playerGuildName ?? "Unknown Guild",
        };

        await addStrike({ guildId, playerInfo, strike });

        const expiryText = typeof expiresDays === "number" ? ` (expires in ${expiresDays} days)` : "";
        return super.success(interaction, `Strike added for **${playerName}**\nReason: ${reason}${expiryText}`, { title: "Strike Added" });
    }

    private async handleRevoke(interaction: ChatInputCommandInteraction, guildId: string) {
        const allyCode = interaction.options.getInteger("allycode", true);
        const strikeId = interaction.options.getString("strike_id", true);
        const revokedBy = interaction.user.id;

        const result = await revokeStrike({ guildId, allyCode, strikeId, revokedBy });

        if (result === "no_player") {
            return super.error(interaction, "No strikes found for that player.");
        }
        if (result === "not_found") {
            return super.error(interaction, "Strike not found.");
        }
        if (result === "already_revoked") {
            return super.error(interaction, "This strike has already been revoked.");
        }

        return super.success(interaction, "Strike revoked. It will remain visible in the member's history.", { title: "Strike Revoked" });
    }

    private async handleClear(interaction: ChatInputCommandInteraction, guildId: string) {
        const allyCode = interaction.options.getInteger("allycode", true);

        const record = await getPlayerStrikes({ guildId, allyCode });
        if (!record) {
            return super.error(interaction, "No strikes found for that player.");
        }

        const cleared = await clearStrikes({ guildId, allyCode });
        if (!cleared) {
            return super.error(interaction, "No strikes found for that player.");
        }
        return super.success(interaction, `All strikes cleared for **${record.playerName}**.`, { title: "Strikes Cleared" });
    }

    private async handleView(interaction: ChatInputCommandInteraction, guildId: string) {
        const allyCode = interaction.options.getInteger("allycode", true);
        const record = await getPlayerStrikes({ guildId, allyCode });

        if (!record) {
            return super.error(interaction, "No strikes found for that player.");
        }

        const now = Date.now();
        const activeStrikes = getActiveStrikes(record.strikes);
        const historicStrikes = record.strikes.filter(
            (s) => s.removedAt !== undefined || (s.expiresAt !== undefined && s.expiresAt <= now),
        );

        const formatStrike = (s: Strike): string => {
            const date = new Date(s.issuedAt).toISOString().split("T")[0];
            if (s.removedAt !== undefined) {
                const revokedDate = new Date(s.removedAt).toISOString().split("T")[0];
                return `• ~~${s.reason}~~ — ${date} by <@${s.issuedBy}> (revoked ${revokedDate} by <@${s.removedBy ?? "unknown"}>)`;
            }
            const expiry = s.expiresAt ? ` (expired: ${new Date(s.expiresAt).toISOString().split("T")[0]})` : "";
            return `• ${s.reason} — ${date} by <@${s.issuedBy}>${expiry}`;
        };

        const embed = new EmbedBuilder()
            .setTitle(`Strikes: ${record.playerName}`)
            .setColor(activeStrikes.length > 0 ? constants.colors.red : constants.colors.green);

        const activeLines = activeStrikes.length > 0 ? activeStrikes.map(formatStrike) : ["No active strikes"];
        embed.addFields(msgArrayToFields(msgArray(activeLines, "\n", 1024), `Active Strikes (${activeStrikes.length})`));

        if (historicStrikes.length > 0) {
            embed.addFields(
                msgArrayToFields(msgArray(historicStrikes.map(formatStrike), "\n", 1024), `Strike History (${historicStrikes.length})`),
            );
        }

        return interaction.reply({ embeds: [embed] });
    }

    private async handleList(interaction: ChatInputCommandInteraction, guildId: string) {
        const guildFilter = interaction.options.getString("guild");
        const sortBy = interaction.options.getString("sort") ?? "name";

        if (guildFilter) {
            await interaction.deferReply();

            // Direct cache lookup by guildId (same pattern used internally by swapi.guild()).
            // Do NOT call swgohAPI.guild() -- that method requires an ally code and does a player lookup first.
            type GuildMember = { allyCode: number; name: string };
            const cachedGuild = (await cache.getOne(env.MONGODB_SWAPI_DB, "guilds", { id: guildFilter })) as {
                name: string;
                roster?: GuildMember[];
            } | null;
            if (!cachedGuild) {
                return super.error(interaction, "Guild not found in cache. The guild may not have been fetched yet.");
            }

            const allStrikes = await getAllStrikes({ guildId });
            const strikesByAlly = new Map(allStrikes.map((p) => [p.allyCode, getActiveStrikes(p.strikes).length]));

            const members = (cachedGuild.roster ?? []).filter((m) => m.allyCode);
            const maxCount = Math.max(0, ...members.map((m) => strikesByAlly.get(m.allyCode) ?? 0));
            const padWidth = String(maxCount).length;

            const roster = members
                .sort((a, b) => {
                    if (sortBy === "strikes") {
                        const diff = (strikesByAlly.get(b.allyCode) ?? 0) - (strikesByAlly.get(a.allyCode) ?? 0);
                        return diff !== 0 ? diff : a.name.localeCompare(b.name);
                    }
                    return a.name.localeCompare(b.name);
                })
                .map((m) => {
                    const count = strikesByAlly.get(m.allyCode) ?? 0;
                    return expandSpaces(`\` ${String(count).padStart(padWidth)} |\` ${m.name}`);
                });

            const chunks = msgArray(roster.length > 0 ? roster : ["No members found."], "\n", 4000);
            const embed = new EmbedBuilder()
                .setTitle(`Strike List: ${cachedGuild.name}`)
                .setDescription(chunks[0])
                .setColor(constants.colors.blue);
            await interaction.editReply({ embeds: [embed] });
            for (const chunk of chunks.slice(1)) {
                await interaction.followUp({ embeds: [new EmbedBuilder().setDescription(chunk).setColor(constants.colors.blue)] });
            }
            return;
        }

        // No guild filter: strikes-only, no API call needed
        const allStrikes = await getAllStrikes({ guildId });
        const activeCounts = new Map(allStrikes.map((p) => [p.allyCode, getActiveStrikes(p.strikes).length]));
        const withActive = allStrikes.filter((p) => (activeCounts.get(p.allyCode) ?? 0) > 0);

        if (withActive.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle("Strike List")
                .setDescription("No members with active strikes.")
                .setColor(constants.colors.green);
            return interaction.reply({ embeds: [embed] });
        }

        const maxCount = Math.max(...withActive.map((p) => activeCounts.get(p.allyCode) ?? 0));
        const padWidth = String(maxCount).length;

        const sorted =
            sortBy === "strikes"
                ? withActive.sort((a, b) => {
                      const diff = (activeCounts.get(b.allyCode) ?? 0) - (activeCounts.get(a.allyCode) ?? 0);
                      return diff !== 0 ? diff : a.playerName.localeCompare(b.playerName);
                  })
                : withActive.sort((a, b) => a.playerName.localeCompare(b.playerName));

        const lines = sorted.map((p) => {
            const count = activeCounts.get(p.allyCode) ?? 0;
            return expandSpaces(`\` ${String(count).padStart(padWidth)} |\` ${p.playerName} (${p.guildName})`);
        });

        const chunks = msgArray(lines, "\n", 4000);
        const embed = new EmbedBuilder().setTitle("Strike List").setDescription(chunks[0]).setColor(constants.colors.red);
        await interaction.reply({ embeds: [embed] });
        for (const chunk of chunks.slice(1)) {
            await interaction.followUp({ embeds: [new EmbedBuilder().setDescription(chunk).setColor(constants.colors.red)] });
        }
    }

    async autocomplete(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
        if (!interaction.guild) return interaction.respond([]);

        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();
        const query = focusedOption.value?.toString().toLowerCase() ?? "";

        // allycode on revoke/clear/view: players with any strikes in this server
        if (focusedOption.name === "allycode" && ["revoke", "clear", "view"].includes(subcommand)) {
            const allStrikes = await getAllStrikes({ guildId });
            const filtered = allStrikes
                .filter((p) => p.playerName.toLowerCase().includes(query) || String(p.allyCode).includes(query))
                .slice(0, 25)
                .map((p) => ({ name: `${p.playerName} (${p.guildName})`, value: p.allyCode }));
            return interaction.respond(filtered);
        }

        // strike_id on revoke: non-revoked strikes for the selected allycode, expired ones clearly marked
        if (focusedOption.name === "strike_id" && subcommand === "revoke") {
            const allyCode = interaction.options.getInteger("allycode");
            if (!allyCode) return interaction.respond([]);

            const record = await getPlayerStrikes({ guildId, allyCode });
            if (!record) return interaction.respond([]);

            const now = Date.now();
            const choices = record.strikes
                .filter((s) => s.removedAt === undefined)
                .slice(0, 25)
                .map((s) => {
                    const date = new Date(s.issuedAt).toISOString().split("T")[0];
                    const expired = s.expiresAt !== undefined && s.expiresAt <= now;
                    const label = expired ? `[expired] ${s.reason} (${date})` : `${s.reason} (${date})`;
                    return { name: label, value: s.id };
                });
            return interaction.respond(choices);
        }

        // guild on list: distinct guilds from strike data + officer's own guild if registered
        if (focusedOption.name === "guild" && subcommand === "list") {
            const allStrikes = await getAllStrikes({ guildId });

            // De-duplicate by guildId (handles in-game guild renames gracefully)
            const seenIds = new Set<string>();
            const guilds: { name: string; value: string }[] = [];
            for (const p of allStrikes) {
                if (!seenIds.has(p.guildId)) {
                    seenIds.add(p.guildId);
                    guilds.push({ name: p.guildName, value: p.guildId });
                }
            }

            // Append officer's own guild if registered and not already in the list
            const officerRecord = (await cache.getOne(
                env.MONGODB_SWGOHBOT_DB,
                "users",
                { id: interaction.user.id },
                { accounts: 1, _id: 0 },
            )) as { accounts?: { allyCode?: string | number }[] } | null;
            const officerAllyCode = officerRecord?.accounts?.[0]?.allyCode ? Number(officerRecord.accounts[0].allyCode) : null;

            if (officerAllyCode) {
                const officerPlayer = (await cache.getOne(
                    env.MONGODB_SWAPI_DB,
                    "players",
                    { allyCode: officerAllyCode },
                    { guildId: 1, guildName: 1, _id: 0 },
                )) as { guildId?: string; guildName?: string } | null;
                if (officerPlayer?.guildId && !seenIds.has(officerPlayer.guildId)) {
                    guilds.push({ name: officerPlayer.guildName ?? "Unknown Guild", value: officerPlayer.guildId });
                }
            }

            const filtered = guilds.filter((g) => g.name.toLowerCase().includes(query)).slice(0, 25);

            return interaction.respond(filtered);
        }

        return interaction.respond([]);
    }
}
