export type SWAPILang =
    | "eng_us"
    | "ger_de"
    | "spa_xm"
    | "fre_fr"
    | "rus_ru"
    | "por_br"
    | "kor_kr"
    | "ita_it"
    | "tur_tr"
    | "chs_cn"
    | "cht_cn"
    | "ind_id"
    | "jpn_jp"
    | "tha_th";

export interface SWAPIPlayer {
    id: string;
    name: string;
    allyCode: number;
    guildId: string;
    guildName: string;
    guildBannerColor: string;
    guildBannerLogo: string;
    level: number;
    poUTCOffsetMinutes: number;
    roster: SWAPIUnit[];
    stats: { nameKey: string; value: number }[];
    arena?: SWAPIPlayerArena;
    lastActivity: number;

    // Extra that's added occasionally before sending out
    warnings?: string[];

    // Used in some commands
    inGuild?: boolean; // Used to highlight the member if they're in the Discord server
    dID?: string; // Discord ID, similar to above

    // DB Updated timestamps
    updated?: number;
    updatedAt?: Date;
}

export interface ComlinkPlayer {
    playerId: string;
    name: string;
    allyCode: string;
    guildId: string;
    guildName: string;
    guildBannerColor: string;
    guildBannerLogo: string;
    level: number;

    pvpProfile?: ComlinkPvpProfile[];
    localTimeZoneOffsetMinutes?: number;
    lastActivityTime?: number;
    profileStat?: { nameKey: string; value: number }[];
    rosterUnit: ComlinkUnit[];

    // Generally unused for me
    datacron: null;
    grandArena: null;
    playerRating: null;
    lifetimeSeasonScore: null;
    titles: {
        selected: null;
        unlocked: null;
    };
    portraits: {
        selected: null;
        unlocked: null;
    };
    guildTypeId: null;
}

export interface ComlinkPvpProfile {
    tab: number;
    rank: number;
    squad: SWAPIComlinkPvpProfileSquad;
}
export interface SWAPIComlinkPvpProfileSquad {
    cell: SWAPIComlinkPvpProfileCell[];
    targetingTactic: number;
    squadType: number;
    targetingSetId: string;
    expireTime: string;
    lastSaveTime: string;
    supportInheritFromDefinitionId: string;
    datacron: null;
    eventId: string;
}
export interface SWAPIComlinkPvpProfileCell {
    crewBattleStat: [];
    unitId: string;
    unitDefId: string;
    cellIndex: number;
    unitBattleStat: null;
    messageReticle: string;
    progressItem: boolean;
    squadUnitType: number;
    unitState: null;
    selectable: boolean;
    overkillItem: boolean;
    inheritFromDefinitionId: string;
}

export interface SWAPIPlayerArena {
    char: arenaSquad;
    ship: arenaSquad;
}

interface arenaSquad {
    rank: number;
    squad: { id: string; defId: string }[];
}

export interface SWAPIUnit {
    id: string;
    name?: string; // Only there at the end, when we get the specified lang
    defId: string;
    nameKey: string;
    gear: number;
    equipped: {
        equipmentId: number;
        slot: string;
    }[];
    factions?: string[]; // Only there after processing
    skills: SWAPIUnitSkill[];
    mods?: SWAPIMod[]; // Only there if the unit has mods equipped
    stats?: SWAPIUnitStats; // Not there til processed
    relic: { currentTier: number } | null;
    purchasedAbilityId: string[]; // Ultimate ability if available
    crew: SWAPIPlayerCrew[];
    combatType: 1 | 2;
    gp?: number; // This won't be there til we process the stats
    level: number;
    rarity: number;

    // Bits that get added in
    zetas?: SWAPIUnitSkill[]; // List of skills with zetas
    omicrons?: SWAPIUnitSkill[]; // List of skills with omicrons
    player?: string; // Player name
    allyCode?: number;
    updated?: number;
    unitTierList?: {
        tier: number;
        equipmentSetList: string[];
    }[];
}

// Kept in the characters table of swapi mongo
export interface RawCharacter {
    baseId: string;
    combatType: number;
    crew?: [];
    factions?: string[];
    legend: boolean;
    skillReferenceList: {
        skillId: string;
        requiredTier: number;
        requiredRarity: number;
        requiredRelicTier: number;

        // custom bits
        isZeta?: boolean;
        isOmicron?: boolean;
        name?: string;
        cooldown?: number;
        desc?: string;
        zetaDesc?: string;
        cost?: {
            [key: string]: number;
            // AbilityMatZeta: number;
            // AbilityMatOmicron: number;
        };
    }[];
    unitTierList: {
        tier: number;
        equipmentSetList: string[];
    }[];
    categoryIdList: null;
    creationRecipeReference: string | null;
    crewList: null;
    nameKey: string | null;
}

export interface RawUnit {
    language: SWAPILang;
    baseId: string;
    categoryIdList: string[];
    combatType: number;
    creationRecipeReference: string;
    crewList: [];
    legend: boolean;
    nameKey: string;
    skillReferenceList: {
        skillId: string;
        requiredTier: number;
        requiredRarity: number;
        requiredRelicTier: number;
    }[];
    unitTierList: {
        tier: number;
        equipmentSetList: string[];
    };
}

// {
//   profile: {
//   },

export interface RawGuild {
    id: string;
    inventory: null;
    lastRaidPointsSummary: {
        identifier: {
            campaignId: string;
            campaignMapId: string;
            campaignNodeId: string;
            campaignNodeDifficulty: number;
            campaignMissionId: string;
        };
        totalPoints: string;
    }[];
    nextChallengesRefresh: string;
    profile: {
        messageCriteriaKey: [];
        raidLaunchConfig: [];
        guildEventTracker: {
            definitionId: string;
            completedStars: string;
            endTime: string;
        }[];
        id: string;
        name: string;
        externalMessageKey: string;
        logoBackground: string;
        enrollmentStatus: number;
        trophy: number;
        memberCount: number;
        memberMax: number;
        level: number;
        rank: number;
        levelRequirement: number;
        raidWin: number;
        leaderboardScore: string;
        bannerColorId: string;
        bannerLogoId: string;
        guildGalacticPower: string;
        chatChannelId: string;
        guildType: string;
        guildGalacticPowerForRequirement: string;
        singleLaunchConfig: null;
        autoLaunchConfig: {
            raidId: string;
            campaignMissionIdentifier: {
                campaignId: string;
                campaignMapId: string;
                campaignNodeId: string;
                campaignNodeDifficulty: number;
                campaignMissionId: string;
            };
            autoLaunch: boolean;
            autoLaunchImmediately: boolean;
            autoLaunchTime: string;
            joinPeriodDuration: string;
            autoSimEnabled: boolean;
            immediate: boolean;
            scheduledUtcOffsetSeconds: string;
        };
    };
    progress: null;
    roster: RawGuildMember[];
    updated: number;
    updatedAt: Date;
}
export interface RawGuildMember {
    memberContribution: {
        "1": { currentValue: string; lifetimeValue: string };
        "2": { currentValue: string; lifetimeValue: string };
        "3": { currentValue: string; lifetimeValue: string };
    };
    playerName: string;
    lastActivityTime: string;
    playerId: string;
}

export interface ComlinkUnit {
    id: string;
    name?: string; // Once it's run through the lang getter
    definitionId: string;
    nameKey: string;
    currentTier: number;
    equipment: {
        equipmentId: number;
        slot: number;
    }[];
    skill: {
        id: string;
        tier: number;
        tiers: number;
    }[];
    equippedStatMod: ComlinkMod[];
    relic: { currentTier: number } | null;
    purchasedAbilityId: string[]; // Ultimate ability if available
    crew: SWAPIPlayerCrew[];
    combatType: 1 | 2;
    gp?: number; // This won't be there til we process the stats
    currentLevel: number;
    currentRarity: number;

    // Bits that get added in
    zetas?: SWAPIUnitSkill[]; // List of scills with zetas
    omicrons?: SWAPIUnitSkill[]; // List of scills with omicrons
    player?: string; // Player name
    allyCode?: number;
    updated?: number;
}
export interface ComlinkAbility {
    id: string;
    languages: SWAPILang;
    abilityTiers: string[];
    cooldown: number;
    isOmicron: boolean;
    isZeta: boolean;
    nameKey: string;
    omicronTier: number;
    skillId: string;
    tierList: string[];
    type: null;
    zetaTier: number;
}

export interface ComlinkMod {
    definitionId: string;
    primaryStat: ComlinkModStat;
    id: string;
    level: number;
    tier: number;
    secondaryStat: ComlinkModStat[];
}
interface ComlinkModStat {
    roll: string[];
    unscaledRollValue: string[];
    stat: {
        unitStatId: number;
        statValueDecimal: string;
        unscaledDecimalValue: string;
        uiDisplayOverrideValue: string;
        scalar: string;
    };
    statRolls: number;
    statRollerBoundsMin: string;
    statRollerBoundsMax: string;
}

export interface SWAPIPlayerCrew {
    skillReferenceList: {
        skillId: string;
        requiredTier: number;
        requiredRarity: number;
        requiredRelicTier: number;
    }[];
    unitId: string;
    slot: number;
}

export interface SWAPIUnitSkill {
    id: string;
    tier: number; // Current Tier
    tiers: number; // Total tiers
    nameKey?: string; // Only after processing with langChar

    // These bits are only there after it's processed
    isZeta?: boolean;
    zetaTier?: number;
    isOmicron?: boolean;
    omicronTier?: number;
    omicronMode?: null; // Not sure, they all seem to be null

    // And these just sometimes mid-command usage
    type: string;
    tierStr: string;
    defId: string;
}

export interface SWAPIUnitAbility {
    skillId: string;
    nameKey?: string;
    zetaTier: number;
    omicronTier: number;
    omicronMode: null;
}

export interface SWAPIMod {
    id: string;
    level: number;
    tier: number;
    slot: number;
    set: number;
    pips: number;
    primaryStat: {
        unitStat?: number | string; // Gets changed to the string when we lang it
        unitStatId?: number;
        value: number;
    };
    secondaryStat: {
        unitStat?: number | string; // Gets changed to the string when we lang it
        unitStatId?: number;
        value: number;
        roll: number;
    }[];
}

export interface SWAPIUnitStats {
    final: SWAPIUnitStatTypes;
    mods: SWAPIUnitStatTypes;
    gp: number;
}

export interface SWAPIUnitStatTypes {
    Health: number;
    Strength: number;
    Agility: number;
    Intelligence: number;
    Speed: number;
    "Physical Damage": number;
    "Special Damage": number;
    Armor: number;
    Resistance: number;
    "Armor Penetration": number;
    "Dodge Chance": number;
    "Deflection Chance": number;
    "Physical Critical Chance": number;
    "Special Critical Chance": number;
    "Critical Damage": number;
    Potency: number;
    Tenacity: number;
    "Health Steal": number;
    Protection: number;
    "Physical Accuracy": number;
    "Special Accuracy": number;
    Accuracy: number; // Added later since the two accuracy stats are always the same
    "Physical Critical Avoidance": number;
    "Special Critical Avoidance": number;
}

export interface SWAPIPlayerArenaProfile {
    pvpProfile: SWAPIPlayerArenaProfilePVP[];
    name: string;
    level: number;
    allyCode: string;
    playerId: string;
    localTimeZoneOffsetMinutes: number;
    lifetimeSeasonScore: string;
    playerRating: {
        playerSkillRating: { skillRating: number };
        playerRankStatus: { leagueId: string; divisionId: number };
    };
    nucleusId: string;
}

export interface SWAPIPlayerArenaProfilePVP {
    tab: number;
    rank: number;
    squad: {
        cell: SWAPIPlayerArenaProfileCell;
        targetingTactic: number;
        squadType: number;
        targetingSetId: string;
        expireTime: string;
        lastSaveTime: string;
        supportInheritFromDefinitionId: string;
        datacron: null; // Not sure, I don't really use em?
    };
    eventId: string;
}

export interface SWAPIPlayerArenaProfileCell {
    crewBattleStat: []; // Not sure / they all seemed to be empty
    unitId: string;
    unitDefId: string;
    cellIndex: number;
    unitBattleStat: null;
    messageReticle: string;
    progressItem: boolean;
    squadUnitType: number;
    unitState: null;
    selectable: boolean;
    overkillItem: boolean;
    inheritFromDefinitionId: string;
}

export interface SWAPIWorkerGuildLog {
    [playerName: string]: SWAPIWorkerPlayerLog;
}
export interface SWAPIWorkerPlayerLog {
    abilities: string[];
    geared: string[];
    leveled: string[];
    reliced: string[];
    starred: string[];
    unlocked: string[];
    ultimate: string[];
}

export interface SWAPIWorkerOutput {
    guildLogOut: SWAPIWorkerGuildLog;
    cacheUpdatesOut: {
        updateOne: {
            filter: { allyCode: number };
            update: { $set: SWAPIPlayer };
            upsert: boolean;
        };
    }[]; // Bunch of updateOne querys for the db cache
    skills: string[];
    defIds: string[];
}

export interface SWAPIGear {
    id: string;
    language: SWAPILang;
    mark: string;
    nameKey: string;
    recipeId: string;
}
export interface SWAPIGearRecipe {
    nameKey: string;
    recipeId: string;
}

export interface SWAPIRecipe {
    id: string;
    language: SWAPILang;
    descKey: string;
    ingredients: SWAPIIngredient[];
}
export interface SWAPIIngredient {
    id: string;
    type: number;
    minQuantity: number;
    maxQuantity: number;
    rarity: number;
    statMod: null;
    previewPriority: number;
    unitLevel: number;
    unitTier: number;
    primaryReward: boolean;
}

export interface SWAPIGuild {
    id: string;
    _id: string; // Mongo ID from when we take it from the db
    autoLaunchConfig?: SWAPIGuildRaidLaunchConfig;
    bannerColor: string;
    bannerLogo: string;
    chatChannelId: string;
    desc: string;
    gp: number;
    guildEventTracker: null;
    guildEvents: null; // Not sure?
    guildGalacticPowerForRequirement: string;
    guildType: string;
    inventory: null;
    inviteStatus: null; // Not sure
    lastRaidPointsSummary?: SWAPIGuildRaidSummary[];
    leaderboardScore: string;
    level: number;
    logoBackground: string;
    memberMax: number;
    members: number;
    message: string;
    messageCriteriaKey: null;
    name: string;
    nextChallengesRefresh: string;
    progress: null;
    raid?: {
        [key: string]: {
            diffId: string;
            progress: string;
        };
    };
    raidLaunchConfig: null;
    raidResult: null;
    raidStatus: null;
    raidWin: number;
    rank: number;
    recentTerritoryWarResult: SWAPIGuildTWResult[];
    required: number;
    roomAvailable: null;
    roster: SWAPIGuildMember[];
    singleLaunchConfig?: SWAPIGuildRaidLaunchConfig;
    stat: null;
    status: number;
    territoryBattleResult: null;
    territoryBattleStatus: null;
    territoryWarStatus: null;
    trophy: number;
    updated: number;
    updatedAt: Date;

    // Used in some commands
    warnings?: string[];
}

interface SWAPIGuildTWResult {
    territoryWarId: string;
    score: string;
    power: number;
    opponentScore: string;
    endTimeSeconds: string;
}
interface SWAPIGuildRaidLaunchConfig {
    raidId: string;
    campaignMissionIdentifier: {
        campaignId: string;
        campaignMapId: string;
        campaignNodeId: string;
        campaignNodeDifficulty: number;
        campaignMissionId: string;
    };
    autoLaunch: boolean;
    autoLaunchImmediately: boolean;
    autoLaunchTime: string;
    joinPeriodDuration: string;
    autoSimEnabled: boolean;
    immediate: boolean;
    scheduledUtcOffsetSeconds: string;
}
interface SWAPIGuildRaidSummary {
    identifier: {
        campaignId: string;
        campaignMapId: string;
        campaignNodeId: string;
        campaignNodeDifficulty: number;
        campaignMissionId: string;
    };
    totalPoints: string;
}

export interface SWAPIGuildMember {
    seasonStatus: SWAPIGuildMemberSeasonStatus[];
    playerName: string;
    playerLevel: number;
    guildXp: number;
    lastActivityTime: string;
    squadPower: number;
    guildJoinTime: string;
    galacticPower: string;
    playerTitle: string;
    playerPortrait: string;
    lifetimeSeasonScore: string;
    leagueId: string;
    shipGalacticPower: string;
    characterGalacticPower: string;
    nucleusId: string;
    id: string;
    guildMemberLevel: number;
    memberContribution: SWAPIGuildMemberContribution[] | SWAPIGuildAlteredMemberContribution;

    // Added after getting it from the api?
    name?: string;
    level?: number;
    allyCode?: number;
    gp?: number;
    gpChar?: number;
    gpShip?: number;
    updated?: number;

    // Used in some commands
    inGuild?: boolean; // Used to highlight the member if they're in the Discord server
    dID?: string; // Discord ID, similar to above
    memberLvl?: string;
    warnings?: string[];
}
interface SWAPIGuildMemberContribution {
    type: number;
    currentValue: string;
    lifetimeValue: string;
}
interface SWAPIGuildAlteredMemberContribution {
    [key: number]: {
        currentValue: string;
        lifetimeValue: string;
    };
}
interface SWAPIGuildMemberSeasonStatus {
    seasonId: string;
    eventInstanceId: string;
    league: string;
    wins: number;
    losses: number;
    seasonPoints: number;
    division: number;
    joinTime: string;
    endTime: string;
    remove: boolean;
    rank: number;
}
