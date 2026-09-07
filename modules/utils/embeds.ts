import type { ChatInputCommandInteraction } from "discord.js";

export interface EmbedField {
    name: string;
    value: string;
}

interface SendableEmbed {
    title?: string;
    description?: string;
    fields?: EmbedField[];
}

export const MAX_FIELDS_PER_EMBED = 25;
export const MAX_EMBEDS_PER_MESSAGE = 10;

// Summed over every title, description, field name, field value, footer and author across ALL
// embeds in a message, not a per-embed allowance: splitting fields over more embeds buys no room.
export const MAX_CHARS_PER_MESSAGE = 6000;

// Footers and timestamps are counted inconsistently, so stop short of the line rather than on it.
const CHAR_SAFETY_MARGIN = 200;

export interface PaginateOptions {
    /** Lower than the Discord cap when a caller wants shorter, more scannable embeds. */
    fieldsPerEmbed?: number;
    /** Chars each message spends on its own title and description before any field. */
    reservedChars?: number;
}

/** Send the first message with `editReply`, the rest as `followUp`s. */
export function paginateEmbedFields(fields: EmbedField[], options: PaginateOptions = {}): EmbedField[][][] {
    const fieldsPerEmbed = Math.min(options.fieldsPerEmbed ?? MAX_FIELDS_PER_EMBED, MAX_FIELDS_PER_EMBED);
    const budget = MAX_CHARS_PER_MESSAGE - CHAR_SAFETY_MARGIN;

    if (!fields.length) return [[[]]];

    const reservedChars = options.reservedChars ?? 0;
    const messages: EmbedField[][][] = [];
    let embeds: EmbedField[][] = [];
    let embed: EmbedField[] = [];
    let usedChars = reservedChars;

    const closeEmbed = () => {
        if (embed.length) embeds.push(embed);
        embed = [];
    };
    const closeMessage = () => {
        closeEmbed();
        if (embeds.length) messages.push(embeds);
        embeds = [];
        usedChars = reservedChars;
    };

    for (const field of fields) {
        const cost = field.name.length + field.value.length;

        // An over-budget field goes out alone rather than being dropped; upstream truncation to the
        // 1024 per-field cap keeps that unreachable, and swallowing it would hide that bug.
        const isFirstOfMessage = !embeds.length && !embed.length;

        if (!isFirstOfMessage && usedChars + cost > budget) {
            closeMessage();
        } else if (embed.length >= fieldsPerEmbed) {
            closeEmbed();
            if (embeds.length >= MAX_EMBEDS_PER_MESSAGE) closeMessage();
        }

        embed.push(field);
        usedChars += cost;
    }
    closeMessage();

    return messages;
}

/** Sends paginated output in order: the deferred reply first, the overflow as follow-ups. */
export async function sendPaginatedEmbeds<T extends SendableEmbed>(interaction: ChatInputCommandInteraction, messages: T[][]) {
    const sent = await interaction.editReply({ embeds: messages[0] });
    for (const embeds of messages.slice(1)) {
        await interaction.followUp({ embeds });
    }
    return sent;
}
