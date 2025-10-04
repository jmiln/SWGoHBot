import type { ChatInputCommandInteraction, Client, Collection, Guild, GuildChannel, GuildMember, Interaction } from "discord.js";
import type { MongoClient } from "mongodb";
import type { Socket } from "socket.io-client";
import type Language from "../base/Language.ts";
import type slashCommand from "../base/slashCommand.ts";
import type Help from "../data/help.ts";
import type Cache from "../modules/cache.js";
import type Logger from "../modules/Logger.ts";
import type UserReg from "../modules/users.js";
import type { RawCharacter, RawGuild, SWAPIGuild, SWAPILang, SWAPIPlayer, SWAPIUnit } from "./swapi_types.ts";

export interface PlayerCooldown {
    player: number;
    guild: number;
}

export type BotLanguage = "en_US" | "de_DE" | "es_SP" | "ko_KR" | "pt_BR";
export type UnitSide = "light" | "dark";

export interface LangHelpStrs {
    description: string;
    actions: {
        action: string;
        actionDesc: string;
        usage: string;
        args: {[key: string]: string}
    }[]
}

// All the mess we cram into the Bot object
// - Should probably just make em get imported as needed instead
export interface BotType {
    // Basic utility functions
    getAllyCode: (message: Interaction, userId: string, useMessageId?: boolean) => Promise<string>
    isAllyCode: (allyCode: string | number) => boolean;
    isUserMention: (userMention: string) => boolean;
    isUserID: (userID: string) => boolean;
    isChannelId: (channelId: string) => boolean;
    isMain: () => boolean;
    toProperCase(strIn: string): string;

    // Patreon / auto-updater functions
    getRanks: () => string[];
    shardRanks: () => string[];
    shardTimes: () => number;
    guildTickets: () => string[];
    guildsUpdate: () => void;
    getPatronUser: (userId: string) => PatronUser;
    getPlayerCooldown: (userId: string, guildId: string) => PlayerCooldown;

    // Scheduled events
    manageEvents: (eventsList: object[]) => void;
    sendWebhook: (webhookURL: string, data: object) => void;

    mongo: MongoClient;
    guildCount: () => number;
    userCount: () => number;
    shardId: number;
    swgohLangList: SWAPILang[];

    // Game strings
    characters: BotUnit[];
    ships: BotUnit[]
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
    acronyms: {
        [key: string]: string;
    };
    arenaJumps: {
        [key: string]: number;
    };
    charLocs: {
        name: string;
        defId: string;
        locations: {
            type: string;
            locId: string;
            name?: string;
            level?: string;
            cost?: string;
        }[];
    }[];
    shipLocs: {
        name: string;
        defId: string;
        locations: {
            type: string;
            locId: string;
            name?: string;
            level?: string;
        }[];
    }[];
    raidNames: {
        [key: string]: {
            [key: string]: string
            aat: string;
            rancor: string;
            rancor_challenge: string;
            sith_raid: string;
            kraytdragon: string;
            heroic: string;
            speederbike: string;
            naboo: string;
            order66: string;
        };
    }

    // swapi functs
    swgohAPI: {
        unitStats: (
            allyCodes: string | string[] | number | number[],
            cooldown?: PlayerCooldown,
            options?: {force?: boolean, defId?: string}
        ) => SWAPIPlayer[];
        guildUnitStats: (allyCodes: number[], defId: string, cooldown?: PlayerCooldown) => SWAPIUnit[];
        getCharacter: (defId: string, lang?: SWAPILang) => RawCharacter;
        langChar: (char: SWAPIUnit, lang: SWAPILang) => SWAPIUnit;
        units: (defId: string, lang?: SWAPILang) => SWAPIUnit;
        guild: (allycode: number, cooldown: PlayerCooldown) => SWAPIGuild;
        getRawGuild: (allycode: number, cooldown?: PlayerCooldown, options?: {forceUpdate?: boolean}) => RawGuild;
    };
    findChar: (searchName: string, charList: BotUnit | BotUnit[], isShip?: boolean) => BotUnit[];

    findFaction: (fact: string) => string | string[] | null;
    getSideColor: (side: UnitSide) => number;
    summarizeCharLevels: (guildMembers: SWAPIPlayer[], type: string) =>[{[key: string]: number}, number];
    getGearStr(charIn: SWAPIUnit, preStr: string): string;

    // util functions
    msgArray: (message: string | string[], splitStr?: string, limit?: number) => string[];
    makeTable: (
        headers: {
            [key: string]: {
                value: string;
                startWith?: string;
                endWith?: string ;
                align?: string; // "left" | "center" | "right";
            }
        },
        rows: {[key: string]: string | number}[],
        options?: {
            boldHeader?: boolean;
            useHeader?: boolean;
        }
    ) => string[];
    expandSpaces: (strIn: string) => string;
    updatedFooterStr: (updated: number, interaction: BotInteraction) => string;
    getSetTimeForTimezone: (dtString: string, timezone?: string) => number;
    isValidZone: (timezone: string) => boolean;
    shortenNum: (number: number, trimTo?: number) => string;
    formatDuration: (duration: number, lang?: BotLanguage) => string;

    getCurrentWeekday: (timezone?: string) => string;
    toProperCase: (strIn: string) => string;
    logger: Logger;
    help: Help;
    cache: Cache;
    userReg: UserReg;
    permLevel: (interaction: Interaction) => number;
    hasViewAndSend: (channel: GuildChannel, user: GuildMember) => boolean;
    commandList: string[];
    constants: BotConstants;
    languages: {
        [key: string]: Language
    };
    config: BotConfig;
    socket: Socket;
}

// Local units from the json files
export interface BotUnit {
    uniqueName: string;
    name: string;
    aliases: string[];
    url: string;
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
        }
    };
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

export interface BotClient extends Client {
    shardId: number;
    slashcmds: Collection<string, slashCommand>;
    reloadDataFiles: () => Promise<void>;
    announceMsg: (guild: Guild, announceMsg: string, channel: string, guildConf: object) => void;
}

export interface BotInteraction extends ChatInputCommandInteraction {
    guildSettings: BotDefaultSettings;
    language: Language;
    swgohLanguage: SWAPILang;
}

export interface BotConfig {
    [key: string]: string | number | boolean | object;
    defaultSettings: BotDefaultSettings;
    eventServe: {
        port: number;
    };
    mongodb: {
        swapidb: string;
    }
    logs: {
        logToChannel: boolean;
    }
    webhookURL: string;
}
export interface BotDefaultSettings {
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
    swgohLanguage: SWAPILang;
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

interface PatronUser {
    guild: string;
    userId: string;
    playerTime: number;
    guildTime: number;
    awAccounts: number;
    discordID: string;
    amount_cents: number;
}
// interface PatreonTier {
//     playerTime: number;
//     guildTime: number;
//     awAccounts: number;
// }

export interface UserConfig {
    id: string;
    accounts: UserAcct[];
    defaults: object;
    arenaAlert: {
        enableRankDMs: string;
        arena: string;
        payoutWarning: number;
        enablePayoutResult: boolean;
    };
    updated: number;
    lang: {
        language: BotLanguage;
        swgohLanguage: SWAPILang;
    };
    arenaWatch: {
        enabled: boolean;
        allycodes: ArenaWatchAcct[];
        channel?: string;
        arena: {
            fleet?: {channel: string, enabled: boolean}
            char?: {channel: string, enabled: boolean}
        };
        payout: {
            char: {enabled: boolean, channel: string, msgID: string};
            fleet: {enabled: boolean, channel: string, msgID: string};
        }
        useEmotesInLog?: boolean;
        useMarksInLog?: boolean;
        report: string;
        showvs: boolean
    };
    guildUpdate: {
        enabled: boolean;
        channel: string;
        allycode: number;
        sortBy: string;
    };
    username: string;
    guildTickets: {
        enabled: boolean;
        channel: string;
        allycode: number;
        sortBy: string;
        msgId: string;
        tickets: number;
        updateType: string;
        nextChallengesRefresh: string;
        showMax: boolean;
    };
    bonusServer: string;
}
interface UserAcct {
    allyCode: string;
    name: string;
    primary: boolean;
    lastCharRank: number;
    lastCharClimb: number;
    lastShipRank: number;
    lastShipClimb: number
}
interface ArenaWatchAcct {
    allyCode: number;
    name: string;
    mention: string;
    lastChar: number;
    lastShip: number;
    poOffset: number;
    mark?: string;
    warn?: {min?: number, arena?: string}
    result?: string;
    lastCharChange?: number;
    lastShipChange?: number;
}
export interface TWList {
    [key: string]: {
        [key: string]: string
    }
}
