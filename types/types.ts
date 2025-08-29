import type { Interaction } from "discord.js";

export interface PlayerCooldown {
    player: number;
    guild: number;
}

export type BotLanguage = "en_US" | "de_DE" | "es_SP" | "ko_KR" | "pt_BR"

// All the mess we cram into the Bot object
// - Should probably just make em get imported as needed instead
export interface BotType {
    getAllyCode: (message: Interaction, userId: string, useMessageId?: boolean) => Promise<string[]>
    isAllyCode: (allyCode: string) => boolean;
    isUserID: (userID: string) => boolean;
    constants: BotConstants;
}

interface BotConstants {
    // Bot invite
    invite: string;

    // Time amounts in ms
    dayMS: number;
    hrMS: number;
    minMS: number;
    secMS: number;

    // Zero width string
    zws: string;

    emotes: {[key: string]: string}

    colors: {[key: string]: number}

    permMap: {[key: string]: number}

    OmicronMode: string[]
}

export interface BotSlashCmd {
    Bot: BotType
}
