import type {
    BaseInteraction,
    ChatInputCommandInteraction,
    Client,
    Collection,
    Guild,
    GuildMember,
    IntentsBitField,
    Interaction,
    Partials,
    TextChannel,
} from "discord.js";
import type { MongoClient } from "mongodb";
import type { Socket } from "socket.io-client";
import type Language from "../base/Language.ts";
import type slashCommand from "../base/slashCommand.ts";
import type { BotCache } from "./cache_types.ts";
import type { GuildConfigEvent,GuildConfigSettings } from "./guildConfig_types.ts";
import type { ComlinkAbility, RawCharacter, RawGuild, SWAPIGuild, SWAPILang, SWAPIPlayer, SWAPIUnit } from "./swapi_types.ts";

export interface PlayerCooldown {
    player: number;
    guild: number;
}

export type BotLanguage = "en_US" | "de_DE" | "es_SP" | "ko_KR" | "pt_BR";
export type UnitSide = "light" | "dark" | "neutral";

export interface LangHelpStrs {
    description: string;
    actions: {
        action: string;
        actionDesc: string;
        usage: string;
        args: { [key: string]: string };
    }[];
}

// All the mess we cram into the Bot object
// - Should probably just make em get imported as needed instead
export interface BotType {
    // Basic utility functions
    getAllyCode: (message: Interaction, userId: string, useMessageId?: boolean) => Promise<string>;
    isAllyCode: (allyCode: string | number) => boolean;
    isUserMention: (userMention: string) => boolean;
    getUserID: (userMention: string) => string;
    isUserID: (userID: string) => boolean;
    isChannelId: (channelId: string) => boolean;
    isChannelMention: (mention: string) => boolean;
    isRoleMention: (mention: string) => boolean;
    isMain: () => boolean;
    toProperCase(strIn: string): string;
    deployCommands(force?: boolean): Promise<string>;

    // Scheduled events
    manageEvents: (eventsList: GuildConfigEvent[]) => void;
    sendWebhook: (webhookURL: string, data: object) => void;
    countdownAnnounce: (event: GuildConfigEvent) => void;
    eventAnnounce: (event: GuildConfigEvent) => void;

    mongo: MongoClient;
    guildCount: () => Promise<number>;
    userCount: () => Promise<number>;
    shardId: number;
    swgohLangList: SWAPILang[];

    // Game strings
    characters: BotUnit[];
    ships: BotUnit[];
    journeyNames: {
        defId: string;
        name: string;
        aliases: string[];
    }[];
    journeyReqs: JourneyReqs[];
    CharacterNames: {
        name: string;
        defId: string;
        aliases: string[];
    }[];
    ShipNames: {
        name: string;
        defId: string;
        aliases: string[];
    }[];
    acronyms: {
        [key: string]: string;
    };
    arenaJumps: {
        [key: string]: number;
    };
    charLocs: UnitLocation[];
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
            [key: string]: string;
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
    };

    omicrons: {
        tw: string[];
        ga3: string[];
        ga: string[];
        tb: string[];
        raid: string[];
        conquest: string[];
        other: string[];
    };
    sortOmicrons: () => Promise<{
        tw: string[];
        ga3: string[];
        ga: string[];
        tb: string[];
        raid: string[];
        conquest: string[];
        other: string[];
    }>;

    // swapi functs
    swgohAPI: {
        unitStats: (
            allyCodes: string | string[] | number | number[],
            cooldown?: PlayerCooldown,
            options?: { force?: boolean; defId?: string },
        ) => Promise<SWAPIPlayer[]>;
        guildUnitStats: (allyCodes: number[], defId: string, cooldown?: PlayerCooldown) => Promise<SWAPIUnit[]>;
        getCharacter: (defId: string, lang?: SWAPILang) => Promise<RawCharacter>;
        getPlayersArena: (allyCodes: number | number[]) => Promise<PlayerArenaRes[]>;
        langChar: (char: Partial<SWAPIUnit>, lang?: SWAPILang) => Promise<Partial<SWAPIUnit>>;
        units: (defId: string, lang?: SWAPILang) => Promise<SWAPIUnit>;
        guild: (allycode: number | string, cooldown?: PlayerCooldown) => Promise<SWAPIGuild>;
        getRawGuild: (allycode: number, cooldown?: PlayerCooldown, options?: { forceUpdate?: boolean }) => Promise<RawGuild>;
        getPlayerUpdates: (allycodes: number | number[]) => Promise<PlayerUpdates>;
        playerByName: (name: string, limit?: number) => Promise<SWAPIPlayer[]>;
        abilities: (
            skillArray: string | string[],
            lang?: SWAPILang,
            opts?: { min?: boolean },
        ) => Promise<ComlinkAbility[] | { nameKey: string }[]>;
    };
    findChar: (searchName: string, charList: BotUnit[], isShip?: boolean) => BotUnit[];

    findFaction: (fact: string) => string | string[] | null;
    getSideColor: (side: UnitSide) => number;
    summarizeCharLevels: (guildMembers: SWAPIPlayer[], type: string) => [{ [key: string]: number }, string];
    getGearStr(charIn: SWAPIUnit, preStr: string): string;

    // Data files attached to the bot
    abilityCosts: Record<string, { [key: string]: number }>;
    missions: Record<string, { [key: string]: { [key: string]: string | number } }>;
    resources: Record<string, { [key: string]: string }>;
    factions: string[];

    // util functions
    wait: (ms?: number) => Promise<void>;
    chunkArray: <T>(inArray: T[], chunkSize: number) => T[][];
    msgArray: (arr: string | string[], join?: string, maxLen?: number) => string[];
    getDivider: (count: number, divChar: string) => string;
    makeTable: (
        headers: {
            [key: string]: {
                value: string;
                startWith?: string;
                endWith?: string;
                align?: string;
            };
        },
        rows: { [key: string]: string | number }[],
        options?: {
            boldHeader?: boolean;
            useHeader?: boolean;
        },
    ) => string[];
    expandSpaces: (strIn: string) => string;
    updatedFooterStr: (updated: number, interaction: BotInteraction) => string;
    getSetTimeForTimezone: (mmddyyyy_HHmm: string, zone?: string) => number;
    getStartOfDay: (timezone: string) => Date;
    getEndOfDay: (timezone: string) => Date;
    getUTCFromOffset: (offset: number) => number;
    convertMS: (ms: number) => {
        hour: number;
        minute: number;
        totalMin: number;
        seconds: number;
    };
    formatCurrentTime: (timezone?: string) => string;
    isValidZone: (timezone: string) => boolean;
    getTimezoneOffset: (timezone: string) => number;
    timezones: string[];
    shortenNum: (number: number, trimTo?: number) => string;
    duration: (time: number, interaciton: BotInteraction) => string;
    formatDuration: (duration: number, lang?: Language) => string;
    getBlankUnitImage: (defId: string) => Promise<Buffer>;
    getUnitImage: (defId: string, unit?: Partial<SWAPIUnit>) => Promise<Buffer>;
    myTime: () => string;

    getCurrentWeekday: (timezone?: string) => string;
    help: HelpObject;
    cache: BotCache;
    permLevel: (interaction: BotInteraction) => Promise<number>;
    hasViewAndSend: (channel: TextChannel, user: GuildMember) => Promise<boolean>;
    commandList: string[];
    constants: BotConstants;
    languages: {
        [key: string]: Language;
    };
    config: BotConfig;
    getDefaultGuildSettings: () => GuildConfigSettings;
    socket: Socket;
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

export interface BotClient extends Client {
    announceMsg: (guild: Guild, announceMsg: string, channel: string, guildConf: object) => void;
    reloadAllEvents: () => Promise<{ succArr: string[]; errArr: string[] }>;
    reloadDataFiles: () => Promise<{ err: string }>;
    reloadFunctions: () => Promise<{ err: string }>;
    reloadSwapi: () => Promise<void>;
    reloadUserReg: () => Promise<void>;
    reloadLanguages: () => Promise<undefined | Error>;
    slashcmds: Collection<string, slashCommand>;
    loadSlash: (commandName: string) => Promise<boolean>;
    reloadSlash: (commandName: string) => Promise<string>;
    reloadAllSlashCommands: () => Promise<{ succArr: string[]; errArr: string[] }>;
    unloadSlash: (commandName: string) => boolean;
}

export interface BotInteraction extends ChatInputCommandInteraction {
    guildSettings: BotDefaultSettings;
    language: Language;
    swgohLanguage: SWAPILang;
}
export interface BotBaseInteraction extends BaseInteraction {
    respond?: (args: { name: string; value: string }[]) => Promise<void>;
}

export interface BotConfig {
    ownerid: string;
    clientId: string;
    defaultSettings: BotDefaultSettings;
    token: string;
    dev_server: string;
    patrons: {
        [key: string]: number; // discordID: amount
    };
    eventServe: {
        port: number;
    };
    mongodb: {
        url: string;
        swapidb: string;
        swgohbotdb: string;
    };
    logs: {
        logToChannel: boolean;
        channel: string;
    };
    arenaWatchConfig: {
        tier1: number;
        tier2: number;
        tier3: number;
    };
    swapiConfig?: {
        statCalc: {
            url: string;
        };
        clientStub: {
            url: string;
            accessKey: string;
            secretKey: string;
        };
    };
    webhookURL: string;
    botIntents: IntentsBitField[];
    partials: Partials[];
    [key: string]: string | number | boolean | object;
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

    emotes: { [key: string]: string };

    colors: { [key: string]: number };

    permMap: { [key: string]: number };

    OmicronMode: string[];
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

export interface PatronUser {
    guild?: string;
    userId: string;
    playerTime: number;
    guildTime: number;
    awAccounts: number;
    discordID: string;
    amount_cents: number;

    declined_since?: string;
}

export interface ActivePatron {
    discordID: string;
    amount_cents: number;
    declined_since?: string;
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
    defaults: object;
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
        enabled: boolean;
        allycodes: ArenaWatchAcct[];
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

export interface HelpObject {
    [key: string]: {
        // The command category
        description: string;
        commands: {
            [key: string]: {
                // The command name
                desc: string;
                usage: string[];
            };
        };
    };
}
