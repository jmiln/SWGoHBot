import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js";
import type Language from "../base/Language.ts";
import type { SWAPILang } from "./swapi_types.ts";

export interface PlayerCooldown {
    player: number;
    guild: number;
}

export type BotLanguage = "en_US" | "de_DE" | "es_SP" | "ko_KR" | "pt_BR";
export type UnitSide = "light" | "dark" | "neutral";

export interface JourneyName {
    defId: string;
    name: string;
    aliases: string[];
}

export interface OmicronAbility {
    skillId: string;
    descKey: string;
}

export interface OmicronCategories {
    tw: OmicronAbility[];
    ga3: OmicronAbility[];
    ga: OmicronAbility[];
    tb: OmicronAbility[];
    raid: OmicronAbility[];
    conquest: OmicronAbility[];
    other: OmicronAbility[];
}

export interface JourneyReqs {
    [key: string]: {
        guideId: string;
        type: string;
        faction?: {
            name: string;
            type: string;
            tier: number;
        };
        reqs: {
            defId: string;
            type: string;
            tier: number;
            ship?: boolean;
            required?: boolean;
            manual?: boolean;
        }[];
        auto?: {
            faction: string;
            ship?: boolean;
            capital?: boolean;
            type: string;
            tier: number;
        }[];
    };
}

export interface PlayerArenaRes {
    name: string;
    allyCode: number;
    arena: {
        char: {
            rank: number | null;
        };
        ship: {
            rank: number | null;
        };
    };
    poUTCOffsetMinutes: number;
}
export interface UnitLocation {
    name: string;
    defId: string;
    locations: Location[];
}
export interface Location {
    type: string;
    locId: string;
    name?: string;
    level?: string;
    cost?: string;
}
export interface PlayerUpdates {
    [key: string]: {
        // username?
        [key: string]: string[]; // ChangeType: [change, change, change]
    };
}

// Local units from the json files
export interface BotUnit {
    uniqueName: string;
    name: string;
    aliases: string[];
    url?: string;
    avatarURL: string;
    side: UnitSide;
    factions: string[];
    avatarName: string;

    // For Characters only
    mods?: BotUnitMods;

    // For Ships only
    crew?: string[];
    abilities?: {
        [key: string]: {
            type: string;
            abilityCooldown: string;
            abilityDesc: string;
        };
    };

    // Added in by some commands teporarily
    isShip?: boolean;
}
export interface BotUnitMods {
    sets: string[];
    square: string;
    arrow: string;
    diamond: string;
    triangle: string;
    circle: string;
    cross: string;
    source?: string;
}

// Union type for event handlers that process both command and autocomplete interactions
export type AnyBotInteraction = ChatInputCommandInteraction | AutocompleteInteraction;

// CommandContext - new pattern for command execution without mutating Discord types
export interface CommandContext {
    interaction: ChatInputCommandInteraction;
    guildSettings?: BotDefaultSettings;
    language?: Language;
    swgohLanguage?: SWAPILang;
    permLevel?: number;
}

export interface BotDefaultSettings {
    adminRole: string[];
    enableWelcome: boolean;
    welcomeMessage: string;
    enablePart: boolean;
    partMessage: string;
    timezone: string;
    announceChan: string;
    eventCountdown: number[];
    language: BotLanguage;
    swgohLanguage: SWAPILang;
    shardtimeVertical: boolean;
}

export interface GuildAlias {
    alias: string;
    defId: string;
    name: string;
}

export interface PatronUser {
    guild?: string;
    userId: string;
    playerTime: number;
    guildTime: number;
    awAccounts: number;
    discordID: string;
    amount_cents: number;
    updatedAt?: Date;
}

export interface ActivePatron {
    discordID: string;
    amount_cents: number;
}
export interface PatreonTier {
    playerTime: number;
    guildTime: number;
    awAccounts: number;
}
export interface PatreonTiers {
    tiers: {
        [key: number]: {
            name: string;
            benefits?: Record<string, string>;
            playerTime: number;
            guildTime: number;
            awAccounts: number;
            sharePlayer: number;
            shareGuild: number;
        };
    };
    commands: Record<string, string>;
}

export interface UserConfig {
    id: string;
    accounts: UserAcct[];
    arenaAlert: {
        enableRankDMs: string;
        arena: string;
        payoutWarning: number;
        enablePayoutResult: boolean;
        payoutResult?: string;
    };
    updated: number;
    lang: {
        language?: BotLanguage;
        swgohLanguage?: SWAPILang;
    };
    arenaWatch: {
        allyCodes: ArenaWatchAcct[];
        channel?: string;
        arena: {
            fleet?: { channel: string; enabled: boolean };
            char?: { channel: string; enabled: boolean };
        };
        payout: {
            char: { enabled: boolean; channel: string; msgID: string };
            fleet: { enabled: boolean; channel: string; msgID: string };
        };
        useEmotesInLog?: boolean;
        useMarksInLog?: boolean;
        report: string;
        showvs: boolean;
    };
    guildUpdate: {
        enabled: boolean;
        channel: string;
        allyCode: number;
    };
    username: string;
    guildTickets: {
        enabled: boolean;
        channel: string;
        allyCode: number;
        sortBy: string;
        msgId: string;
        tickets: number;
        updateType: string;
        nextChallengesRefresh: string;
        showMax: boolean;
    };
    bonusServer: string;
}
export interface UserAcct {
    allyCode: string;
    name: string;
    primary: boolean;
    lastCharRank?: number;
    lastCharClimb?: number;
    lastShipRank?: number;
    lastShipClimb?: number;
}
export interface ArenaWatchAcct {
    allyCode: number;
    name: string;
    mention: string;
    lastChar: number;
    lastShip: number;
    poOffset: number;
    mark?: string;
    warn?: { min?: number; arena?: string };
    result?: string;
    lastCharChange?: number;
    lastShipChange?: number;

    // Added in temporarily while processing
    duration?: number;
    timeTil?: string;
    outString?: string;
}
export interface TWList {
    [key: string]: {
        [key: string]: string;
    };
}

// Patreon API response types
export interface PatreonMember {
    type: string;
    attributes: {
        full_name: string;
        patron_status: string;
        currently_entitled_amount_cents: number;
    };
    relationships?: {
        currently_entitled_tiers?: {
            data?: [
                {
                    id: string;
                    type: string;
                },
            ];
        };
        user?: {
            data?: {
                id: string;
            };
        };
    };
}

export interface PatreonAPIUser {
    type: string;
    id: string;
    attributes: {
        social_connections?: {
            discord?: {
                user_id: string;
            };
        };
    };
}
