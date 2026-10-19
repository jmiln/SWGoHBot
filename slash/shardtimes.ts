import {
    type APIEmbedField,
    ApplicationCommandOptionType,
    type AutocompleteFocusedOption,
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    type Client,
    escapeMarkdown,
    type GuildEmoji,
    InteractionContextType,
    type TextChannel,
} from "discord.js";
import type Language from "../base/Language.ts";
import Command from "../base/slashCommand.ts";
import constants from "../data/constants/constants.ts";
import {
    convertMS,
    fetchMembersById,
    getStartOfDay,
    getUTCFromOffset,
    hasViewAndSend,
    isUserID,
    isValidZone,
} from "../modules/functions.ts";
import { getGuildShardTimes, setGuildShardTimes } from "../modules/guildConfig/shardTimes.ts";
import logger from "../modules/Logger.ts";
import type { GuildConfigShardTimes } from "../types/guildConfig_types.ts";
import type { CommandContext } from "../types/types.ts";

// Shown in place of a payout time when a stored entry can't be resolved
const UNKNOWN_TIME = "??:??";

export default class Shardtimes extends Command {
    static readonly metadata = {
        name: "shardtimes",
        category: "General",
        contexts: [InteractionContextType.Guild],
        description: "Manage shard times",
        options: [
            // Add
            //  - UserID, name, me
            //  - Timezone, how long until
            //  - Flag, emote, symbol
            {
                name: "add",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Add a new name/ user to be shown",
                options: [
                    {
                        name: "user",
                        type: ApplicationCommandOptionType.String,
                        description: "A name or mention/ userID",
                        required: true,
                    },
                    {
                        name: "timezone",
                        type: ApplicationCommandOptionType.String,
                        description: "A timezone (e.g. America/New_York) or UTC offset (e.g. -4:00)",
                    },
                    {
                        name: "time_until",
                        type: ApplicationCommandOptionType.String,
                        description: "How long (hh:mm) until the payout",
                    },
                    {
                        name: "flag",
                        type: ApplicationCommandOptionType.String,
                        description: "An emoji (standard, or custom from a server the bot is in) or a single symbol to show by the name",
                    },
                ],
            },
            // Remove
            //  - UserID, name, etc
            {
                name: "remove",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Remove a name/ user from the list",
                options: [
                    {
                        name: "user",
                        type: ApplicationCommandOptionType.String,
                        description: "A name or mention/ userID",
                        required: true,
                        autocomplete: true,
                    },
                ],
            },
            // Copy (Make sure they have the correct perms for this, to avoid overwriting stuff in other channels?)
            //  - destinationChannel
            {
                name: "copy",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Copy the shard times from this channel to the target channel",
                options: [
                    {
                        name: "dest_channel",
                        type: ApplicationCommandOptionType.Channel,
                        description: "The channel you want it to be copied to",
                        required: true,
                    },
                ],
            },
            // View
            //  - Ships
            {
                name: "view",
                type: ApplicationCommandOptionType.Subcommand,
                description: "Show the payout times for this channel",
                options: [
                    {
                        name: "ships",
                        type: ApplicationCommandOptionType.Boolean,
                        description: "Show the ship arena payout times instead",
                    },
                ],
            },
        ],
    };
    constructor() {
        super(Shardtimes.metadata);
    }

    async autocomplete(interaction: AutocompleteInteraction, focusedOption: AutocompleteFocusedOption) {
        const subCommand = interaction.options.getSubcommand();

        // Only handle autocomplete for the remove subcommand's user option
        if (subCommand === "remove" && focusedOption.name === "user") {
            if (!interaction?.guild || !interaction?.channel) {
                return await interaction.respond([]);
            }
            const channelId = interaction.channel.id;

            const searchKey = focusedOption.value?.trim().toLowerCase() || "";

            // Get shard times for this channel
            const shardArr = await getGuildShardTimes({ guildId: interaction.guild.id });
            const shardTimes = shardArr.find((sh) => sh.channelId === channelId);

            if (!shardTimes?.times) {
                return await interaction.respond([]);
            }

            // Build list of users from shard times
            const userList = Object.keys(shardTimes.times)
                .map((userId) => {
                    const userInfo = shardTimes.times[userId];
                    const type = userInfo.type || "id";

                    // Create display name based on type
                    let displayName = userId;
                    if (type === "name") {
                        displayName = userId; // For names, userId is already the name
                    } else {
                        // For IDs, try to get the username
                        const user = interaction.client.users.cache.get(userId);
                        displayName = user ? `@${user.username}` : userId;
                    }

                    return {
                        name: displayName,
                        value: userId,
                    };
                })
                .filter((user) => user.name.toLowerCase().includes(searchKey))
                .slice(0, 25);

            await interaction.respond(userList);
        }
    }

    async run({ interaction, language, guildSettings, permLevel }: CommandContext) {
        // Shard ID will be guild.id-channel.id
        if (!interaction.inCachedGuild() || !interaction.channel) return super.error(interaction, language.get("BASE_COMMAND_UNAVAILABLE"));
        // const shardID = `${interaction.guild?.id}-${interaction.channel?.id}`;
        const channelId = interaction.channel.id;

        const shardArr = await getGuildShardTimes({ guildId: interaction.guild.id });
        const targetIndex = shardArr.findIndex((sh) => sh.channelId === channelId);
        const shardTimes: GuildConfigShardTimes =
            targetIndex > -1 ? JSON.parse(JSON.stringify(shardArr[targetIndex])) : { channelId: channelId, times: {} };

        const ctx: ShardContext = { interaction, channelId, language, permLevel, shardArr, targetIndex, shardTimes };
        switch (interaction.options.getSubcommand()) {
            case "add":
                return this.addUser(ctx);
            case "remove":
                return this.removeUser(ctx);
            case "copy":
                return this.copyTimes(ctx);
            case "view":
                return this.viewTimes(ctx, guildSettings.shardtimeVertical);
        }
    }

    // If it's an admin, let them register other users, else let em register themselves
    // To add someone ;shardinfo <me|@mention|discordID> <timezone> [flag/emoji]
    private async addUser({ interaction, language, permLevel, shardArr, targetIndex, shardTimes }: ShardContext) {
        const { key: userID, type } = resolveUserKey(interaction.options.getString("user"), interaction.user.id);

        if (!canChangeEntry(userID, interaction, permLevel)) {
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_REM_MISSING_PERMS"));
        }

        const payout = parsePayoutTime(interaction.options.getString("timezone"), interaction.options.getString("time_until"), language);
        if ("error" in payout) {
            return super.error(interaction, payout.error);
        }

        const flag = await resolveFlag(interaction.options.getString("flag"), interaction.client);
        if (flag === null) {
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_INVALID_FLAG"));
        }

        const previous = shardTimes.times[userID];
        const previousZone = previous ? describeStoredZone(previous) : null;
        shardTimes.times[userID] = {
            type: type,
            zoneType: payout.zoneType,
            timezone: payout.timezone,
            flag: flag,
        };
        if (targetIndex > -1) {
            shardArr[targetIndex] = shardTimes;
        } else {
            shardArr.push(shardTimes);
        }
        await setGuildShardTimes({ guildId: interaction.guild.id, stOut: shardArr })
            .then(() => {
                if (previous) {
                    return interaction.reply({
                        content: language.get("COMMAND_SHARDTIMES_USER_MOVED", previousZone ?? "", payout.displayZone ?? ""),
                    });
                }
                return interaction.reply({ content: language.get("COMMAND_SHARDTIMES_USER_ADDED") });
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`[shardtimes add] Failed to save shard times for guild ${interaction.guild.id}: ${message}`);
                return super.error(interaction, language.get("COMMAND_SHARDTIMES_USER_NOT_ADDED"));
            });
    }

    private async removeUser({ interaction, language, permLevel, shardArr, targetIndex, shardTimes }: ShardContext) {
        const { key: uid } = resolveUserKey(interaction.options.getString("user"), interaction.user.id);

        if (!canChangeEntry(uid, interaction, permLevel)) {
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_REM_MISSING_PERMS"));
        }

        if (!shardTimes.times[uid]) {
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_REM_MISSING"));
        }
        delete shardTimes.times[uid];
        shardArr[targetIndex] = shardTimes;
        await setGuildShardTimes({ guildId: interaction.guild.id, stOut: shardArr })
            .then(() => {
                return interaction.reply({ content: language.get("COMMAND_SHARDTIMES_REM_SUCCESS") });
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`[shardtimes remove] Failed to save shard times for guild ${interaction.guild.id}: ${message}`);
                return super.error(interaction, language.get("COMMAND_SHARDTIMES_REM_FAIL"));
            });
    }

    // ;shardtimes copy destChannel
    private async copyTimes({ interaction, channelId, language, permLevel, shardArr, shardTimes }: ShardContext) {
        const destChannel = interaction.options.getChannel("dest_channel") as TextChannel | null;
        if (!destChannel) {
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_COPY_NO_DEST", ""));
        }

        // Make sure the person has the correct perms to copy it (admin/ mod)
        if (permLevel < constants.permMap.GUILD_ADMIN) {
            // Permlevel 3 is the adminRole of the server, so anyone under that shouldn"t be able to do this
            return super.error(interaction, language.get("BASE_MISSING_ADMIN_PERM"));
        }

        // Make sure there are times to copy from
        if (!Object.keys(shardTimes.times).length) {
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_COPY_NO_SOURCE"));
        }

        const botMember = interaction.guild.members.me;
        if (!botMember || !(await hasViewAndSend(destChannel, botMember))) {
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_COPY_NO_PERMS", destChannel.id));
        }

        // Make sure the to/ from channels aren't the same
        if (channelId === destChannel.id) {
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_COPY_SAME_CHAN"));
        }

        const destTarget = shardArr.findIndex((sh) => sh.channelId === destChannel.id);
        const destTimes = shardArr[destTarget];
        if (destTarget < 0) {
            // If there's no shard info in the destination channel
            shardTimes.channelId = destChannel.id;
            shardArr.push(shardTimes);
            await setGuildShardTimes({ guildId: interaction.guild.id, stOut: shardArr })
                .then(() => {
                    return interaction.reply({ content: language.get("COMMAND_SHARDTIMES_COPY_SUCCESS", destChannel.id) });
                })
                .catch((err) => {
                    return super.error(interaction, err.message);
                });
            return;
        }
        if (destTimes?.times && Object.keys(destTimes.times)?.length) {
            // Or if there is shard info there with listings
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_COPY_DEST_FULL"));
        }
        // Or if there is shard info there, but no listings
        destTimes.times = shardTimes.times;
        shardArr[destTarget] = destTimes;
        await setGuildShardTimes({ guildId: interaction.guild.id, stOut: shardArr })
            .then(() => {
                return interaction.reply({ content: language.get("COMMAND_SHARDTIMES_COPY_SUCCESS", destChannel.id) });
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                logger.error(`[shardtimes copy] Failed to save shard times for guild ${interaction.guild.id}: ${message}`);
                return super.error(interaction, language.get("COMMAND_SHARDTIMES_COPY_BROKE"));
            });
    }

    private async viewTimes({ interaction, channelId, language, shardTimes }: ShardContext, vertical: boolean | undefined) {
        const isShip = interaction.options.getBoolean("ships");

        // View the shard table
        const timeToAdd = isShip ? 19 : 18;
        const shardOut: Record<string, string[]> = {};

        if (!shardTimes?.times || !Object.keys(shardTimes.times)?.length) {
            return super.error(interaction, language.get("COMMAND_SHARDTIMES_NO_WATCHERS"));
        }

        const logWhere = `guild ${interaction.guild.id}, channel ${channelId}`;
        for (const user of Object.keys(shardTimes.times)) {
            const entry = shardTimes.times[user];
            const diff = timeTil(entry.timezone, timeToAdd, entry?.zoneType ? entry.zoneType : "zone", `${user} in ${logWhere}`);
            if (shardOut[diff]) {
                shardOut[diff].push(user);
            } else {
                shardOut[diff] = [user];
            }
        }

        const sortedShardTimes = Object.keys(shardOut).sort((a, b) => (a > b ? 1 : -1));

        const isIdEntry = (user: string) => !shardTimes.times[user].type || shardTimes.times[user].type === "id";
        const members = await fetchMembersById(interaction.guild, Object.keys(shardTimes.times).filter(isIdEntry)).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            logger.error(`Failed to fetch members in guild ${interaction.guild.id}: ${message}`);
            return null;
        });

        const fields: APIEmbedField[] = sortedShardTimes.map((time) => {
            const sortedTimes = shardOut[time]
                .map((user) => ({
                    flag: displayFlag(shardTimes.times[user].flag, interaction.client.emojis.cache),
                    name: isIdEntry(user) ? `**${truncateName(members?.get(user)?.displayName ?? user)}**` : truncateName(user),
                }))
                .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                .map((t) => `${t.flag}${t.name}`);
            return {
                name: time,
                value: sortedTimes.join(vertical ? "\n" : " - "),
            };
        });
        return interaction.reply({
            embeds: [
                {
                    author: {
                        name: language.get("COMMAND_SHARDTIMES_SHARD_HEADER"),
                    },
                    fields: fields,
                },
            ],
        });
    }
}

interface ShardContext {
    interaction: ChatInputCommandInteraction<"cached">;
    channelId: string;
    language: Language;
    permLevel: number;
    shardArr: GuildConfigShardTimes[];
    targetIndex: number;
    shardTimes: GuildConfigShardTimes;
}

type ShardEntry = GuildConfigShardTimes["times"][string];

const MAX_NAME_LENGTH = 20;

function resolveUserKey(input: string | null, selfId: string): { key: string; type: "id" | "name" } {
    if (input === "me") return { key: selfId, type: "id" };
    // If it's an ID, use it as such
    if (input && isUserID(input)) return { key: input.replace(/[^\d]*/g, ""), type: "id" };
    // Otherwise, use it as a name
    return { key: input ?? "", type: "name" };
}

// If they're trying to change someone other than themselves, make sure they have perms for it (AdminRole/ server manager)
function canChangeEntry(key: string, interaction: ChatInputCommandInteraction<"cached">, permLevel: number): boolean {
    return [interaction.user.id, interaction.user.username, "me"].includes(key) || permLevel >= constants.permMap.GUILD_ADMIN;
}

function parsePayoutTime(
    timezone: string | null,
    timeUntil: string | null,
    language: Language,
): { error: string } | { zoneType: string; timezone: string | number; displayZone: string | null } {
    if (timezone && timeUntil) {
        // Warn em if they try using both a timezone and the time_until, since they can only use one
        return { error: language.get("COMMAND_SHARDTIMES_CONFLICTING_OPTIONS") };
    }
    if (timezone) {
        const match = timezone.match(/([+-])(2[0-3]|[01]{0,1}[0-9]):([0-5][0-9])/);
        if (isValidZone(timezone)) return { zoneType: "zone", timezone, displayZone: timezone };
        if (!match) {
            // Grumble that it's an invalid tz
            return { error: language.get("BASE_INVALID_TIMEZONE") };
        }
        // It's a UTC +/- zone  (+8:00 / -4:15)
        const offset = Number.parseInt(`${match[1]}${Number.parseInt(match[2], 10) * 60 + Number.parseInt(match[3], 10)}`, 10);
        return { zoneType: "utc", timezone: offset, displayZone: timezone };
    }
    if (!timeUntil) {
        // Warn em if they don't give a timezone or time_until
        return { error: "You need to specify when the user's payout will be, using either the **timezone** or **time_until** arguments" };
    }
    if (!timeUntil.match(/(2[0-3]|[01]{0,1}[0-9]):([0-5][0-9])/)) {
        return { error: language.get("COMMAND_SHARDTIMES_INVALID_TIME_TIL") };
    }
    const payoutAt = quarterHourAfter(timeUntil);
    return { zoneType: "hhmm", timezone: payoutAt, displayZone: `${payoutAt} UTC` };
}

function quarterHourAfter(timeUntil: string): string {
    const [hour, minute] = timeUntil.split(":");

    // Then grab the current UTC time, and add the hr & min onto that
    const nowTime = new Date();
    const hourMS = 60 * 60 * 1000;
    const minMS = 60 * 1000;
    const updatedTime = new Date(
        new Date().setTime(nowTime.getTime() + (Number.parseInt(hour, 10) || 0) * hourMS + (Number.parseInt(minute, 10) || 0) * minMS),
    );
    const tempH = updatedTime.getUTCHours();
    const tempM = updatedTime.getUTCMinutes();

    const totalMin = tempH * 60 + tempM;
    const rounded = Math.round(totalMin / 15) * 15;
    return `${Math.floor(rounded / 60)}:${(rounded % 60).toString().padEnd(2, "0")}`;
}

const STANDARD_EMOJI = /^\p{RGI_Emoji}$/v;
const CUSTOM_EMOJI = /^<a?:\w+:(\d+)>$/;
const ASCII_SYMBOL = /^[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]$/;
// Entries saved before flags were stored as full markup hold a bare custom-emoji ID
const LEGACY_EMOJI_ID = /^\d+$/;

// "" when no flag was given, null when the flag can't be shown
async function resolveFlag(flagIn: string | null, client: Client<true>): Promise<string | null> {
    const flag = flagIn?.trim() ?? "";
    if (!flag || STANDARD_EMOJI.test(flag) || ASCII_SYMBOL.test(flag)) return flag;
    const emojiId = flag.match(CUSTOM_EMOJI)?.[1];
    if (emojiId && (await botCanUseEmoji(client, emojiId))) return flag;
    return null;
}

// Each shard only caches the emoji of the servers it hosts
async function botCanUseEmoji(client: Client<true>, emojiId: string): Promise<boolean> {
    if (!client.shard) return client.emojis.cache.has(emojiId);
    try {
        const results = await client.shard.broadcastEval((c, { emojiId }) => c.emojis.cache.has(emojiId), { context: { emojiId } });
        return results.some(Boolean);
    } catch (err) {
        logger.error(
            `[shardtimes] Emoji lookup across shards failed, checking this shard only: ${err instanceof Error ? err.message : String(err)}`,
        );
        return client.emojis.cache.has(emojiId);
    }
}

function describeStoredZone(entry: ShardEntry): string | number {
    if (entry.zoneType === "utc") {
        // utc zoneType stores the timezone as a numeric offset in minutes
        const offsetMinutes = Number(entry.timezone);
        const sign = offsetMinutes >= 0 ? "+" : "-";
        const num = Math.abs(offsetMinutes);
        const hour = Math.floor(num / 60);
        let min = (num % 60).toString();
        if (min.length === 1) min = `0${min}`;
        return `${sign + hour}:${min}`;
    }
    if (entry.zoneType === "hhmm") return `${entry.timezone} UTC`;
    return entry.timezone;
}

function displayFlag(flag: string, emojiCache: Map<string, GuildEmoji>): string {
    if (!flag) return "";
    if (LEGACY_EMOJI_ID.test(flag)) return emojiCache.get(flag)?.toString() ?? "";
    // A lone * or _ would otherwise merge with the bold markers around the name
    return ASCII_SYMBOL.test(flag) ? escapeMarkdown(flag) : flag;
}

function truncateName(name: string): string {
    return name.length > MAX_NAME_LENGTH ? name.substring(0, MAX_NAME_LENGTH) : name;
}

function timeTil(zone: string | number, timeToAdd: number, type: string, logContext: string) {
    const nowTime = Date.now();
    const { hrMS, dayMS } = constants;

    let targetTime: number;
    if (type === "zone" && typeof zone === "string") {
        // Stored rows are only validated when they're written, and the rules for that have changed over the years (moment-timezone,
        // now Intl), so a row can hold a zone this bot can no longer resolve. Skip it rather than killing the table
        if (!isValidZone(zone)) {
            logger.error(`[shardtimes view] Unusable timezone "${zone}" for ${logContext}`);
            return UNKNOWN_TIME;
        }
        const target = getStartOfDay(zone).getTime() + hrMS * timeToAdd;
        // If today's payout has already passed, grab tomorrow's
        targetTime = target + (target < nowTime ? dayMS : 0);
    } else {
        const target =
            type === "hhmm" && typeof zone === "string" ? getUTCAtTime(zone) : getUTCFromOffset(zone as number) + hrMS * timeToAdd;

        // If it's already passed, add a day to grab the next one
        targetTime = target + (target < nowTime ? dayMS : 0);
    }
    const times = convertMS(targetTime - nowTime);
    return `${times.hour.toString().padStart(2, "0")}:${times.minute.toString().padStart(2, "0")}`;
}

function getUTCAtTime(hhmm: string) {
    const [hr, min] = hhmm.split(":").map((t) => Number.parseInt(t, 10));
    const nowDate = new Date();
    return Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate(), hr, min);
}
