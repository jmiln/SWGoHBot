import type { BaseInteraction, Client, Collection, Guild, Interaction } from "discord.js";
import type { Socket } from "socket.io-client";
import type Language from "../base/Language.ts";
import type slashCommand from "../base/slashCommand.ts";
import type Cache from "../modules/cache.js";
import type Logger from "../modules/Logger.ts";
import type UserReg from "../modules/users.js";

export interface PlayerCooldown {
    player: number;
    guild: number;
}

export type BotLanguage = "en_US" | "de_DE" | "es_SP" | "ko_KR" | "pt_BR";
export type swgohLanguage = "ENG_US" | "GER_DE" | "SPA_XM" | "FRE_FR" | "RUS_RU" | "POR_BR" | "KOR_KR" | "ITA_IT" | "TUR_TR" | "CHS_CN" | "CHT_CN" | "IND_ID" | "JPN_JP" | "THA_TH";
export type UnitSide = "light" | "dark";

// All the mess we cram into the Bot object
// - Should probably just make em get imported as needed instead
export interface BotType {
    // Basic utility functions
    getAllyCode: (message: Interaction, userId: string, useMessageId?: boolean) => Promise<string[]>
    isAllyCode: (allyCode: string) => boolean;
    isUserID: (userID: string) => boolean;
    isMain: () => boolean;
    toProperCase(strIn: string): string;

    // Patreon / auto-updater functions
    getRanks: () => string[];
    shardRanks: () => string[];
    shardTimes: () => number;
    guildTickets: () => string[];
    guildsUpdate: () => void;

    // Scheduled events
    manageEvents: (eventsList: object[]) => void;
    sendWebhook: (webhookURL: string, data: object) => void;

    // Game strings
    characters: {
        uniqueName: string;
        name: string;
        aliases: string[];
        url: string;
        avatarURL: string;
        side: UnitSide;
        factions: string[];
        mods: {
            sets: string[];
            square: string;
            arrow: string;
            diamond: string;
            triangle: string;
            circle: string;
            cross: string;
        },
        avatarName: string;
    }[];
    ships: {
        uniqueName: string;
        name: string;
        aliases: string[];
        crew: string[];
        url: string;
        avatarURL: string;
        side: UnitSide;
        factions: string[];
        abilities: {
            [key: string]: {
                type: string;
                abilityCooldown: string;
                abilityDesc: string;
            }
        },
        avatarName: string;
    }[]
    journeyNames: {
        defId: string;
        name: string;
        aliases: string[];
    }[];
    CharacterNames: {
        name: string;
        defId: string;
        aliases: GuildAlias[]
    }[];
    ShipNames: {
        name: string;
        defId: string;
        aliases: GuildAlias[]
    }[];

    logger: Logger;
    cache: Cache;
    userReg: UserReg;
    permLevel: (interaction: Interaction) => number;
    commandList: string[];
    constants: BotConstants;
    languages: {
        [key: string]: Language
    };
    config: BotConfig;
    socket: Socket;
}

export interface BotClient extends Client {
    shardId: number;
    slashcmds: Collection<string, slashCommand>;
    reloadDataFiles: () => Promise<void>;
    announceMsg: (guild: Guild, announceMsg: string, channel: string, guildConf: object) => void;
}

export interface BotInteraction extends BaseInteraction {
    guildSettings: BotDefaultSettings;
    language: Language;
    swgohLanguage: swgohLanguage;
}

export interface BotConfig {
    [key: string]: string | number | boolean | object;
    defaultSettings: BotDefaultSettings;
    eventServe: {
        port: number;
    };
    logs: {
        logToChannel: boolean;
    }
    webhookURL: string;
}
interface BotDefaultSettings {
    adminRole: string[];
    enableWelcome: boolean;
    welcomeMessage: string;
    enablePart: boolean;
    partMessage: string;
    useEmbeds: boolean;
    timezone: string;
    announceChan: string;
    eventCountdown: number[];
    language: BotLanguage;
    swgohLanguage: swgohLanguage;
    shardtimeVertical: boolean;
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


// User-scheduled events / alerts
export interface GuildEvent {
    eventID: string;
    eventDT: number;
    eventMessage: string;
    eventChan: string;
    countdown: boolean;
    repeat?: {
        repeatDay: number;
        repeatMin: number;
        repeatHour: number;
    };
    repeatDays?: number[];
    updated: number;

    // Mongo stuff
    _id: null;
    createdAt: Date;
    updatedAt: Date;
}

export interface GuildAlias {
    alias: string;
    defId: string;
    name: string;
}
