import { Client, Collection, ColorResolvable, CommandInteraction, Guild, GuildEmoji, Intents, Interaction, Message, MessageEmbed, PartialTypes } from "discord.js";
import SlashCommand from "../base/slashCommand";
import Logger from "./Logger";

export interface BotInteraction extends CommandInteraction {
    guildSettings: GuildConf,
    language: {[key: string]: any},
    swgohLanguage: string,
    client: BotClient
}
export interface BotClient extends Client {
    slashcmds: Collection<string, SlashCommand>,
    announceMsg(guild: Guild, announceMsg: string, channel: string, guildConf: GuildConf): void,
    unloadSlash(commandName: string): Promise<string>,
    loadSlash(commandName: string): Promise<string>,
    reloadSlash(commandName: string): void,
    reloadAllSlashCommands(): Promise<{succArr: string[], errArr: string[]}>,
    reloadAllEvents(): Promise<{succArr: string[], errArr: string[]}>,
    reloadFunctions(): Promise<{err: string}>,
    reloadSwapi()    : Promise<{err: string}>,
    reloadUserReg()  : Promise<{err: string}>,
    reloadDataFiles(): Promise<{err: string}>,
    reloadLanguages(): Promise<{err: string}>,
}

export interface CommandOptions {
    level: number
}

export interface BotType {
    [key:  string]: any,
    abilityCosts: {[key: string]: {}},
    acronyms: {[key: string]: string},
    arenaJumps: {[key: string]: number},
    charLocs: UnitLocation[],
    characters: UnitObj[],
    factions: string[]
    languages: {[key: string]: {[key: string]: any}},
    missions: {[key: string]: {}},
    resources: {[key: string]: {}},
    shipLocs: UnitLocation[],
    ships: UnitObj[],
    squads: {[key: string]: {}},
    swgohLangList: string[],

    // From eventFuncs
    manageEvents: any,
    deleteEvent: any,
    countdownAnnounce: any,
    eventAnnounce: any,

    // Extra from swgohBot.ts
    cache: any,
    config: {
        ownerid: string,
        dev_server: string,
        token: string,
        shardCount: number,
        botIntents: Intents,
        partials: PartialTypes[]
        enableGlobalCmds: boolean,
        locations: {
            char: string,
            ship: string
        },
        database: {[key: string]: string},
        mongodb: {[key: string]: string},
        eventServe: {
            port: number
        },
        defaultSettings: GuildConf,
        typedDefaultSettings: {[key: string]: any},
        defaultUserConf: {[key: string]: any},
        webhookURL: string,
        debugLogs: boolean,
        logs: {
            logToChannel: boolean,
            channel: string,
            logComs: boolean
        },
        changelog: {
            changelogChannel: string,
            sendChangelogs: boolean
        },
        premium: boolean,
        premiumIP_Port: string,
        imageServIP_Port: string,
        patrons: string[],
        patreon: {[key: string]: string},
        arenaWatchConfig: {[key: string]: number},
        swapiConfig: {[key: string]: string},
        fakeSwapiConfig: {[key: string]: any}

        [key: string]: string | {} | any[] | boolean | number
    },
    database: any,
    logger: Logger,
    mongo: any,
    swgoh: any,
    swgohAPI: any,
    swgohGuildCount: number,
    swgohPlayerCount: number,
    swapiStub: any,
    statCalculator: any,
    userReg: any,
    seqOps: any,
    socket: any,

    // Extra from the functions file (Should trim this down at a later time)
    constants: {
        invite: string,
        zws: string,
        longSpace: string,
        colors: {[key: string]: ColorResolvable},
        optionType: {[key: string]: number},
        permMap: {
            BOT_OWNER: number,
            HELPER: number,
            GUILD_OWNER: number,
            GUILD_ADMIN: number,
            BASE_USER: number
        }
    },
    permLevel(message: Interaction): Promise<number>,
    isMain(): boolean,
    myTime(): string,
    findChar(searchName: string, charList: UnitObj[], ship?: boolean): UnitObj[],
    sendWebhook(hookUrl: string, embed: {}): void,
    wait(time: number): void,
    msgArray(arr: string[], join: string, maxLen?: number): any[],
    codeBlock(str: string, lang?: string): string,
    duration(time: number | string, message: Interaction): string,
    updatedFooter(updated: string | number, message: Interaction, type: string, userCooldown: PlayerCooldown): {},
    userCount(): Promise<number>,
    guildCount(): Promise<number>,
    isUserID(numStr: string): boolean,
    getUserID(numStr: string): string | null,
    isAllyCode(aCode: number | string): boolean,
    makeTable(headers: Header, rows: {}[], options?: {boldHeader?: boolean, useHeader?: boolean}): string[],
    findFaction(faction: string): string | string[] | boolean,
    expandSpaces(str: string): string,
    getAllyCode(message: Interaction, user: string | number, useMessageId?: boolean): Promise<number>,
    convertMS(milliseconds: number): { hour: number, minute: number, totalMin: number, seconds: number },
    getDivider(count: number, divChar: string): string,
    cleanMentions(guild: Guild, input: string): string,
    isChannelMention(mention: string): boolean,
    isRoleMention(mention: string): boolean,
    isUserMention(mention: string): boolean,
    chunkArray(inArray: string[], chunkSize: number): any[],
    getGuildConf(guildID: string): Promise<GuildConf>,
    hasGuildConf(guildID: string): Promise<boolean>,
    getGearStr(charIn: {}, preStr: string): string,
    summarizeCharLevels(guildMembers: PlayerStatsAccount | PlayerStatsAccount[], type: string): [{[key: string]: number}, string],
    toProperCase(strIn: string): string,
    deploy(): void,
    shortenNum(number: number, trimTo?: number): string,

    // From patreonFuncs
    getPatronUser(userId: string): Promise<PatronUser>,
    getPlayerCooldown(authorId: string): Promise<PlayerCooldown>,
    getRanks(): void,
    shardTimes(): void,
    shardRanks(): void,
    guildsUpdate(): void,
}
export interface Header {
    [index: string]: {
        value: string,
        startWith?: string,
        endWith?: string,
        align?: string | "left" | "right" | "center"
    }
}
export interface UnitLocation {
    name: string,
    locations: {
        type: string,
        level?: string,
        cost?: string,
        name?: string
    }[]
}
// interface MappedFaction {
//     name: string,
//     value: string
// }
export interface PlayerCooldown {
    player?: number,
    guild?: number
}
export interface PlayerStatsAccount {
    id: string,
    roster: APIUnitObj[],
    allyCode: number,
    arena?: {
        char?: {
            rank: number,
            squad: squadUnit[]
        },
        ship?: {
            rank: number,
            squad: squadUnit[]
        }
    },
    grandArena?: gaSeason[],
    guildBannerColor: string,
    guildBannerLogo: string,
    guildName: string,
    guildRefId: string,
    guildTypeId: string,
    lastActivity: number,
    level: number,
    name: string,
    poUTCOffsetMinutes: number,
    portraits: {
        selected: string,
        unlocked: string[]
    },
    stats: playerStat[],
    titles: {
        selected: string,
        unlocked: string[]
    },
    updated: number,
    playerRating: {
        playerSkillRating: {
            skillRating: number
        },
        playerRankStatus: {
            leagueId: string,
            divisionId: number
        }
    },
    warnings?: string[],
}
interface squadUnit {
    defId: string,
    squadUnitType: number
}
interface gaSeason {
    seasonId: string,
    eventInstance: string,
    league: string,
    wins: number,
    losses: number,
    seasonPoints: number,
    division: number,
    joinTime: string,
    endTime: string,
    remove: boolean,
    rank: number,
}
interface playerStat {
    nameKey: string,
    value: number,
    index: number
}

export interface UserReg {
    id: string,
    accounts: UserRegAccount[],
    defaults: {},
    arenaAlert: {
        enableRankDMs: boolean | string,
        arena: "both" | "fleet" | "char" | "none",
        payoutWarning: number,
        enablePayoutResult: boolean
    },
    updated: number,
    lang: {
        language: string,
        swgohLanguage: string
    },
    arenaWatch: UserArenaWatch,
    guildUpdate: {
        enabled: boolean,
        channel: string,
        allycode: number
    },
    avatar: string,
    bot: boolean,
    discriminator: string,
    username: string
}
export interface UserArenaWatch {
    enabled: boolean,
    channelID: string | null,
    allyCodes: AWPlayer[],
    channel: string,
    arena: {
        fleet: null | {
            channel: string,
            enabled: boolean
        },
        char: null | {
            channel: string,
            enabled: boolean
        }
    },
    payout: {
        fleet: null | {
            channel: string,
            msgID: string,
            enabled: boolean
        },
        char: null | {
            channel: string,
            msgID: string,
            enabled: boolean
        }
    },
    useEmotesInLog: boolean,
    useMarksInLog: boolean,
    report: "both" | "climb" | "drop",
    showvs: boolean
}
export interface UserRegAccount {
    allyCode: string,
    name: string,
    primary: boolean,
    lastCharRank?: number,
    lastCharClimb?: number,
    lastShipRank?: number,
    lastShipClimb?: number
}
export interface PlayerArenaProfile {
    name: string,
    allyCode: number,
    arena: {
        char: {
            rank: number
        },
        ship: {
            rank: number
        },
    },
    poUTCOffsetMinutes: number
}
export interface APIPlayerArenaProfile {
    name: string,
    level: number,
    allyCode: string,
    playerId: string,
    localTimeZoneOffsetMinutes: number,
    lifetimeSeasonScore: string,
    pvpProfile: {
        tab: number,
        rank: number,
        squad: {},
        eventId: string
    }[]
}

// The guildConf object, for per-guild setitngs
export interface GuildConf {
    prefix: string,
    adminRole: string[],
    enableWelcome: boolean,
    welcomeMessage: string,
    enablePart: boolean,
    partMessage: string,
    useEmbeds: boolean,
    timezone: string,
    announceChan: string,
    useEventPages: boolean,
    eventCountdown: Number[],
    language: string,
    swgohLanguage: string,
    shardtimeVertical: boolean,
    useActivityLog: boolean,
    changelogWebhook: string
}

// Events from the event scheduler
export interface ScheduledEvent {
    guildID: string,
    announceMessage: string,
    chan: string,
    guildConf: GuildConf
}

// The actual events that get saved
export interface SavedEvent {
    eventID: string,
    eventDT: number,
    eventMessage: string,
    eventChan: string, // Should be a Discord channel ID
    countdown: boolean,
    repeat: {
        repeatDay: number,
        repeatHour: number,
        repeatMin: number
    },
    // | string,   // The {day,hr,min} or the 0d0h0m
    repeatDays: number[]
}

// Event sent to validate
export interface ValidateEvent {
    name: string,
    time: string,
    day: string,
    message: string,
    channelID: string
    countdown: boolean,
    repeat: string,
    repeatDay: string
}

// Character or ship objects, as stored in the json files
export interface UnitObj {
    name: string,
    uniqueName: string,
    aliases: string[],
    nameVariant: string[],
    url: string,
    avatarURL: string,
    side: string,
    factions: string[],
    mods?: UnitModObj,
    crew: string[],
    isShip?: boolean
}
export interface UnitModObj {
    url: string,
    sets: string[],
    square: string,
    arrow: string,
    diamond: string,
    triangle: string,
    circle: string,
    cross: string,
    source: string,
}

// Character or ship objects, as grabbed from the api/ game
export interface APIUnitObj {
    defId: string,
    name?: string,
    nameKey: string,
    side: string,
    factions: string[],
    crew: string[] | null
    rarity: number,
    level: number,
    gear: number,
    equipped: {
        slot: number
    }[],
    combatType: number,
    skills: APIUnitSkill[],
    skillReferenceList: APIUnitSkill[],
    purchasedAbilityId?: {}[],
    mods: APIUnitModObj[],
    gp: number,
    relic: {currentTier?: number},
    stats?: {
        final?: {
            Health?: number,
            Strength?: number,
            Agility?: number,
            Intelligence?: number,
            Speed?: number,
            "Physical Damage"?: number,
            "Special Damage"?: number,
            Armor?: number,
            Resistance?: number,
            "Armor Penetration"?: number,
            "Resistance Penetration"?: number,
            "Dodge Chance"?: number,
            "Deflection Chance"?: number,
            "Physical Critical Chance"?: number,
            "Special Critical Chance"?: number,
            "Critical Damage"?: number,
            Potency?: number,
            Tenacity?: number,
            "Health Steal"?: number,
            Protection?: number,
            "Physical Accuracy"?: number,
            "Special Accuracy"?: number,
            "Physical Critical Avoidance"?: number,
            "Special Critical Avoidance"?: number,
            Mastery?: number,
        },
        mods?: {
            Health?: number,
            Speed?: number,
            "Physical Damage"?: number,
            "Special Damage"?: number,
            Armor?: number,
            Resistance?: number,
            Potency?: number,
            Tenacity?: number,
            "Physical Critical Chance"?: number,
            "Special Critical Chance"?: number,
            Protection?: number,
        },

        // Some extras for the guildStats function
        player?: string,
        gp?: number,
        gear?: number,
        Protection?: number
    },
    updated: number

    // Extras tacked on occasionally
    zetas: APIUnitSkill[],
    player?: string,
    unit?: any
}
export interface APIUnitAbility {
    id: string,
    abilityReference?: string,
    skillId: string,
    descKey: string,
    tierList: TierSkill[],
    language: string,
    isZeta?: boolean,
    zetaTier?: number,
    isOmicron?: boolean,
    omicronTier?: number,
}
export interface TierSkill {
    nameKey?: string,
    descKey: string,
    powerOverrideTag: string,
    recipeId: string
}
export interface APIUnitEquipment {
    id: string,
    nameKey: string
}
export interface APIUnitSkill {
    id: string,
    skillId: string,
    tier: number,
    tiers: number,
    nameKey: string,
    isZeta?: boolean,
    isOmicron?: boolean,
}
export interface APIUnitModObj {
    level: number,
    tier:  number,
    slot:  number,
    set:   number,
    pips:  number,
    primaryStat: APIUnitModObjPStat,
    secondaryStat: APIUnitModObjSStat[]
}
export interface APIUnitListChar {
    baseId: string,
    language: string,
    creationRecipeReference: string,
    categoryIdList: string[],
    unitTierList: {


        tier: number,
        equipmentSetList: []
    },
    crewList: {
        skillReferenceList: SkillReferenceObj[],
        unitId: string,
        slot: number,
        skilllessCrewAbilityId: string
    }[],
    nameKey: string,
    skillReferenceList: SkillReferenceObj[],
    updateTierList: [],
    updated: number
}
export interface SkillReferenceObj {
    skillId: string,
    requiredTier: number,
    requiredRarity: number,
    requiredrelicTier: number,
    cost?: {[key: string]: number}
}
export interface APIGuildObj {
    name: string,
    id: string,
    desc: string,
    members: number,
    required: number,
    bannerColor: string,
    bannerLogo: string,
    message: string ,
    gp: number,
    raid?: {
        rancor?: "string",
        aat?: "string",
        sith_raid?: "string"
    },
    roster: APIGuildMemberObj[],
    updated: number,
    warnings?: string[]
}
export interface APIGuildMemberObj {
    id: string,
    guildMemberLevel: number,
    name: string,
    level: number,
    allyCode: number,
    gp: number,
    gpChar: number,
    gpShip: number,
    roster?: APIUnitObj[],
    updated: number,

    // Next 3 are used in the guilds command (Added there, and used farther down)
    inGuild?: boolean,
    discordId?: string,
    memberLvl: string
}

export interface APIRawGuildObj {
    name: string,
    nextChallengesRefresh: string,
    profile: {
        messageCriteriaKey: [],
        raidLaunchConfig: [],       // Expand if needed (shows raids and their settings for the guild)
        guildEventTracker: [],      // TB stats(ish/ meh)
        id: string,
        name: string,
        externalMessageKey: string,
        logoBackground: string,
        enrollmentStatus: number,
        trophy: number,
        memberCount: number,
        memberMax: number,
        level: number,
        rank: number,
        levelRequirement: number,
        raidWin: number,
        leaderboardScore: string | number,
        bannerColorId: string,
        bannerLogoId: string,
        guildGalacticPower: string,
        chatChannelId: string,
        guildType: string,
    },
    roster: APIRawGuildMemberObj[],
    updated: number
}
export interface APIRawGuildMemberObj {
    memberContribution: {
        1: {
            currentValue: string,
            lifetimeValue: string
        },
        2: {
            currentValue: string,
            lifetimeValue: string
        },
        3: {
            currentValue: string,
            lifetimeValue: string
        }
    },
    playerName: string,
    lastActivityTime: string,
    playerId: string
}

export interface APIUnitModObjPStat {
    unitStatId?: number,
    unitStat: number | string,
    value: number
}

export interface APIUnitModObjSStat {
    unitStatId?: number,
    unitStat: number | string,
    value: number,
    roll: number
}


// Poll objects
export interface Poll {
    pollID: string,
    question: string,
    options: string[],
    votes: {[key: string]: number},
    anon: boolean
}

// ArenaWatch player
export interface AWPlayer {
    allyCode: number,
    name: string,
    mention: string,
    lastChar: number | null,
    lastShip: number | null,
    poOffset: number,
    result?: any,
    mark: string | null,

    // Some add-ins for formatting the outputs
    duration?: number,
    timeTil?: string,
    warn?: {
        min: number,
        arena: string
    }
}


export interface GuildPlayerUpdates {
    abilities: string[],
    geared:    string[],
    leveled:   string[],
    reliced:   string[],
    starred:   string[],
    unlocked:  string[],
    ultimate:  string[]
}

export interface PatronUser {
    id: string,
    amount_cents: number,
    declined_since: string,
    discordID: string,
    email: string,
    full_name: string,
    pledge_cap_cents: number,
    updated: number,
    vanity: string,
}
