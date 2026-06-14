import type { ApplicationCommandOptionType } from "discord.js";

// Shape of a Discord application command option as written in each command's static metadata.
// Permissive on `type` (the general enum, not a discriminated literal) so the hand-written
// metadata literals type-check; deployed verbatim as the REST payload (scripts/deployCommands.ts).
export interface CommandOption {
    name: string;
    description: string;
    type: ApplicationCommandOptionType;
    required?: boolean;
    autocomplete?: boolean;
    choices?: { name: string; value: string | number }[];
    options?: CommandOption[];
    minValue?: number;
    maxValue?: number;
}

export interface SlashEmbedOptions {
    title?: string;
    color?: number;
    ephemeral?: boolean;
    footer?: string;
    iconURL?: string;
    example?: string;
}
