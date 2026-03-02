import type {
    ComlinkAbility,
    RawCharacter,
    RawGuild,
    SWAPIGear,
    SWAPIGuild,
    SWAPIGuildMember,
    SWAPILang,
    SWAPIPlayer,
    SWAPIPlayerArenaProfile,
    SWAPIRecipe,
    SWAPIUnit,
    SWAPIUnitAbility,
} from "../../types/swapi_types.ts";
import type { PlayerCooldown } from "../../types/types.ts";

/**
 * Mock SWAPI for testing
 *
 * Usage:
 *   const mockSwapi = createMockSwapi();
 *   // Configure responses
 *   mockSwapi.setPlayerData({ allyCode: 123456789, ... });
 *   mockSwapi.setGuildData({ id: "guildid", ... });
 *   // Use in tests
 *   const player = await mockSwapi.unitStats(123456789);
 *
 * Configure behaviors:
 *   mockSwapi.setShouldThrowError("guild", true); // Make guild() throw
 *   mockSwapi.setErrorMessage("guild", "Custom error"); // Custom error message
 */

interface MockSwapiConfig {
    players: Map<number, SWAPIPlayer>;
    guilds: Map<string, SWAPIGuild>;
    rawGuilds: Map<string, RawGuild>;
    units: Map<string, SWAPIUnit>;
    characters: Map<string, RawCharacter>;
    abilities: Map<string, ComlinkAbility>;
    gear: Map<string, SWAPIGear>;
    recipes: Map<number, SWAPIRecipe>;
    specialAbilities: SWAPIUnitAbility[];
    errors: Map<string, { shouldThrow: boolean; message: string }>;
}

export class MockSWAPI {
    private config: MockSwapiConfig = {
        players: new Map(),
        guilds: new Map(),
        rawGuilds: new Map(),
        units: new Map(),
        characters: new Map(),
        abilities: new Map(),
        gear: new Map(),
        recipes: new Map(),
        specialAbilities: [],
        errors: new Map(),
    };

    /**
     * Initialize the mock (mimics real SWAPI init)
     */
    init(): void {
        // Mock initialization - no-op
    }

    /**
     * Configure mock to throw error for a specific method
     */
    setShouldThrowError(methodName: string, shouldThrow: boolean): void {
        const existing = this.config.errors.get(methodName) || { shouldThrow: false, message: "" };
        this.config.errors.set(methodName, { ...existing, shouldThrow });
    }

    /**
     * Set custom error message for a method
     */
    setErrorMessage(methodName: string, message: string): void {
        const existing = this.config.errors.get(methodName) || { shouldThrow: false, message: "" };
        this.config.errors.set(methodName, { ...existing, message });
    }

    /**
     * Check if method should throw and throw configured error
     */
    private checkError(methodName: string): void {
        const errorConfig = this.config.errors.get(methodName);
        if (errorConfig?.shouldThrow) {
            throw new Error(errorConfig.message || `Mock ${methodName} error`);
        }
    }

    /**
     * Set mock player data
     */
    setPlayerData(player: SWAPIPlayer): void {
        this.config.players.set(player.allyCode, player);
    }

    /**
     * Set mock guild data
     */
    setGuildData(guild: SWAPIGuild): void {
        this.config.guilds.set(guild.id, guild);
    }

    /**
     * Set mock raw guild data
     */
    setRawGuildData(guild: RawGuild): void {
        this.config.rawGuilds.set(guild.id, guild);
    }

    /**
     * Set mock unit data
     */
    setUnitData(defId: string, unit: SWAPIUnit): void {
        this.config.units.set(defId, unit);
    }

    /**
     * Set mock character data
     */
    setCharacterData(defId: string, character: RawCharacter): void {
        this.config.characters.set(defId, character);
    }

    /**
     * Set mock special abilities
     */
    setSpecialAbilities(abilities: SWAPIUnitAbility[]): void {
        this.config.specialAbilities = abilities;
    }

    /**
     * Reset all mock data
     */
    reset(): void {
        this.config.players.clear();
        this.config.guilds.clear();
        this.config.rawGuilds.clear();
        this.config.units.clear();
        this.config.characters.clear();
        this.config.abilities.clear();
        this.config.gear.clear();
        this.config.recipes.clear();
        this.config.specialAbilities = [];
        this.config.errors.clear();
    }

    // ===== SWAPI Method Implementations =====

    async playerByName(name: string, limit = 0) {
        this.checkError("playerByName");
        if (!name?.length || typeof name !== "string") return null;

        const matchingPlayers = Array.from(this.config.players.values()).filter((p) =>
            p.name.toLowerCase().includes(name.toLowerCase()),
        );

        if (limit > 0) {
            return matchingPlayers.slice(0, limit);
        }
        return matchingPlayers;
    }


    async getPlayersArena(allycodes: number | number[]): Promise<SWAPIPlayerArenaProfile[]> {
        this.checkError("getPlayersArena");
        const acArr = Array.isArray(allycodes) ? allycodes : [allycodes];
        const validAC = acArr.filter((ac) => !!ac && ac.toString().length === 9);

        return validAC
            .map((ac) => {
                const player = this.config.players.get(ac);
                if (!player?.arena) return null;

                return {
                    name: player.name,
                    allyCode: ac,
                    arena: player.arena,
                    poUTCOffsetMinutes: player.poUTCOffsetMinutes,
                } as unknown as SWAPIPlayerArenaProfile;
            })
            .filter((p) => !!p);
    }

    async getPlayerUpdates(allycodes: number | number[]) {
        this.checkError("getPlayerUpdates");
        const acArr = Array.isArray(allycodes) ? allycodes : [allycodes];

        const guildLog = {};
        for (const ac of acArr) {
            const player = this.config.players.get(ac);
            if (player) {
                guildLog[player.name] = {
                    abilities: [],
                    geared: [],
                    leveled: [],
                    reliced: [],
                    starred: [],
                    unlocked: [],
                    ultimate: [],
                };
            }
        }
        return guildLog;
    }

    async unitStats(
        allycodes: number | number[],
        _cooldown: PlayerCooldown = {
            player: 180,
            guild: 360,
        },
        options: { force?: boolean; defId?: string } = { force: false, defId: null },
    ): Promise<SWAPIPlayer[]> {
        this.checkError("unitStats");
        if (!allycodes) return null;

        const acArr: number[] = Array.isArray(allycodes) ? allycodes : [allycodes];
        const players = acArr
            .map((ac) => {
                const player = this.config.players.get(ac);
                if (!player) return null;

                if (options?.defId) {
                    return {
                        ...player,
                        roster: player.roster.filter((u) => u.defId === options.defId),
                    };
                }
                return player;
            })
            .filter((p) => !!p);

        return players;
    }

    async player(allycode: string | number, _cooldown?: PlayerCooldown): Promise<SWAPIPlayer | null> {
        this.checkError("player");
        const acNum = Number.parseInt(String(allycode), 10);
        return this.config.players.get(acNum) ?? null;
    }

    async langChar(char: Partial<SWAPIUnit>, _lang: SWAPILang): Promise<Partial<SWAPIUnit>> {
        this.checkError("langChar");
        if (!char) throw new Error("Missing Character");

        // Return character as-is (language processing not needed for mocks)
        return char;
    }

    async guildUnitStats(allyCodes: number[], defId: string, _cooldown: PlayerCooldown): Promise<SWAPIUnit[]> {
        this.checkError("guildUnitStats");
        if (!defId) throw new Error("[swapi guildUnitStats] You need to specify a defId");

        const players = await this.unitStats(allyCodes, _cooldown, { defId });
        if (!players.length) throw new Error("Couldn't get your stats");

        const outStats: SWAPIUnit[] = [];
        for (const player of players) {
            let unit: SWAPIUnit = null;

            if (player?.roster?.length) {
                unit = player.roster.find((c) => c.defId === defId);
            }

            if (!unit) {
                unit = {
                    defId: defId,
                    gear: 0,
                    gp: 0,
                    level: 0,
                    rarity: 0,
                    skills: [],
                    relic: { currentTier: 0 },
                    equipped: [],
                    stats: null,
                } as SWAPIUnit;
            }

            unit.zetas = unit.skills.filter((s) => s.isZeta && s.tier >= s.zetaTier);
            unit.omicrons = unit.skills.filter((s) => s.isOmicron && s.tier >= s.omicronTier);
            unit.player = player.name;
            unit.allyCode = player.allyCode;
            unit.updated = player.updated;
            outStats.push(unit);
        }
        return outStats;
    }

    async abilities(skillArray: string | string[], _lang: SWAPILang = "eng_us", opts = { min: false }) {
        this.checkError("abilities");
        if (!skillArray) {
            throw new Error("You need to have a list of abilities here");
        }

        const skillArr = Array.isArray(skillArray) ? skillArray : [skillArray];
        const abilities = skillArr
            .map((skillId) => this.config.abilities.get(skillId))
            .filter((a) => !!a);

        if (opts.min) {
            return abilities.map((a) => ({ nameKey: a.nameKey }));
        }
        return abilities;
    }

    async getCharacter(defId: string, _lang: SWAPILang = "eng_us"): Promise<RawCharacter> {
        this.checkError("getCharacter");
        if (!defId) throw new Error("[getCharacter] Missing character ID.");

        const char = this.config.characters.get(defId);
        if (!char) throw new Error("[SWGoH-API getCharacter] Missing Character");
        if (!char.skillReferenceList) throw new Error("[SWGoH-API getCharacter] Missing character abilities");

        return char;
    }

    async character(defId: string): Promise<RawCharacter> {
        this.checkError("character");
        return this.config.characters.get(defId);
    }

    async gear(gearArray: string | string[], _lang: SWAPILang): Promise<SWAPIGear[]> {
        this.checkError("gear");
        if (!gearArray) {
            throw new Error("You need to have a list of gear here");
        }

        const gearArr = Array.isArray(gearArray) ? gearArray : [gearArray];
        return gearArr.map((id) => this.config.gear.get(id)).filter((g) => !!g);
    }

    async units(defId: string, _lang: SWAPILang = "eng_us"): Promise<SWAPIUnit> {
        this.checkError("units");
        if (!defId) throw new Error("You need to specify a defId");

        return this.config.units.get(defId);
    }

    async recipes(recArray: number | number[], _lang: SWAPILang): Promise<SWAPIRecipe[]> {
        this.checkError("recipes");
        if (!recArray) {
            throw new Error("You need to have a list of gear here");
        }

        const recArr = Array.isArray(recArray) ? recArray : [recArray];
        return recArr.map((id) => this.config.recipes.get(id)).filter((r) => !!r);
    }

    async getRawGuild(
        allycode: number,
        _cooldown: PlayerCooldown = { player: 180, guild: 360 },
        { forceUpdate: _forceUpdate } = { forceUpdate: false },
    ): Promise<RawGuild> {
        this.checkError("getRawGuild");
        const thisAc = allycode?.toString().replace(/[^\d]/g, "");
        if (!thisAc || Number.isNaN(thisAc) || thisAc.length !== 9) {
            throw new Error("Please provide a valid allycode");
        }

        const player = this.config.players.get(Number.parseInt(thisAc, 10));
        if (!player) throw new Error("I cannot find a matching profile for this allycode, please make sure it's typed in correctly");
        if (!player.guildId) throw new Error("This player is not in a guild");

        const rawGuild = this.config.rawGuilds.get(player.guildId);
        if (!rawGuild) throw new Error("Sorry, that player is not in a guild");

        return rawGuild;
    }

    async guild(allycode: number | string, _cooldown?: PlayerCooldown): Promise<SWAPIGuild> {
        this.checkError("guild");
        const thisAcStr = allycode?.toString().replace(/[^\d]/g, "");
        if (thisAcStr?.length !== 9 || Number.isNaN(thisAcStr)) throw new Error("Please provide a valid allycode");

        const thisAc = Number.parseInt(thisAcStr, 10);
        const player = this.config.players.get(thisAc);

        if (!player) {
            throw new Error("I don't know this player, make sure they're registered first");
        }
        if (!player.guildId) throw new Error("Sorry, that player is not in a guild");

        const guild = this.config.guilds.get(player.guildId);
        if (!guild) throw new Error("Could not find guild");

        return {
            ...guild,
            roster: guild.roster.filter((m) => m.guildMemberLevel > 1).filter((m) => m.allyCode !== null),
        };
    }

    async guildByName(gName: string): Promise<SWAPIGuild> {
        this.checkError("guildByName");
        const guild = Array.from(this.config.guilds.values()).find((g) => g.name === gName);
        return guild || null;
    }

    async zetaRec(_lang = "ENG_US") {
        this.checkError("zetaRec");
        return [];
    }
}

/**
 * Factory function to create a new mock SWAPI instance
 */
export function createMockSwapi(): MockSWAPI {
    return new MockSWAPI();
}

/**
 * Create a mock player with default values
 */
export function createMockPlayer(overrides: Partial<SWAPIPlayer> = {}): SWAPIPlayer {
    return {
        id: "player123",
        name: "MockPlayer",
        allyCode: 123456789,
        guildId: "guild123",
        guildName: "Mock Guild",
        guildBannerColor: "color1",
        guildBannerLogo: "logo1",
        level: 85,
        poUTCOffsetMinutes: 0,
        roster: [],
        stats: [
            { nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 },
            { nameKey: "STAT_CHARACTER_GALACTIC_POWER_ACQUIRED_NAME", value: 3000000 },
            { nameKey: "STAT_SHIP_GALACTIC_POWER_ACQUIRED_NAME", value: 2000000 },
        ],
        arena: {
            char: { rank: 100, squad: [] },
            ship: { rank: 50, squad: [] },
        },
        lastActivity: Date.now(),
        updated: Date.now(),
        updatedAt: new Date(),
        ...overrides,
    };
}

/**
 * Create a mock guild with default values
 */
export function createMockGuild(overrides: Partial<SWAPIGuild> = {}): SWAPIGuild {
    return {
        id: "guild123",
        _id: "mongoid123",
        name: "Mock Guild",
        desc: "A test guild",
        members: 50,
        gp: 250000000,
        level: 300,
        status: 1,
        required: 1,
        bannerColor: "color1",
        bannerLogo: "logo1",
        message: "Welcome!",
        roster: [],
        updated: Date.now(),
        updatedAt: new Date(),
        chatChannelId: "channel123",
        guildType: "NORMAL",
        guildGalacticPowerForRequirement: "0",
        leaderboardScore: "1000",
        logoBackground: "bg1",
        memberMax: 50,
        nextChallengesRefresh: new Date().toISOString(),
        rank: 1000,
        raidWin: 100,
        trophy: 500,
        recentTerritoryWarResult: [],
        guildEventTracker: null,
        guildEvents: null,
        inventory: null,
        inviteStatus: null,
        messageCriteriaKey: null,
        progress: null,
        raidLaunchConfig: null,
        raidResult: null,
        raidStatus: null,
        roomAvailable: null,
        stat: null,
        territoryBattleResult: null,
        territoryBattleStatus: null,
        territoryWarStatus: null,
        ...overrides,
    };
}

/**
 * Create a mock guild member with default values
 */
export function createMockGuildMember(overrides: Partial<SWAPIGuildMember> = {}): SWAPIGuildMember {
    return {
        id: "member123",
        name: "MockMember",
        playerName: "MockMember",
        level: 85,
        playerLevel: 85,
        allyCode: 123456789,
        gp: 5000000,
        gpChar: 3000000,
        gpShip: 2000000,
        guildMemberLevel: 10,
        memberContribution: {
            "1": { currentValue: "600", lifetimeValue: "50000" },
            "2": { currentValue: "15000", lifetimeValue: "1000000" },
            "3": { currentValue: "30000", lifetimeValue: "2000000" },
        },
        lastActivityTime: new Date().toISOString(),
        updated: Date.now(),
        seasonStatus: [],
        guildXp: 1000,
        squadPower: 5000000,
        guildJoinTime: new Date().toISOString(),
        galacticPower: "5000000",
        playerTitle: "Title",
        playerPortrait: "Portrait",
        lifetimeSeasonScore: "10000",
        leagueId: "league1",
        shipGalacticPower: "2000000",
        characterGalacticPower: "3000000",
        nucleusId: "nucleus123",
        ...overrides,
    };
}

/**
 * Create a mock unit with default values
 */
export function createMockUnit(overrides: Partial<SWAPIUnit> = {}): SWAPIUnit {
    return {
        id: "unit123",
        defId: "DARTHVADER",
        nameKey: "Darth Vader",
        level: 85,
        rarity: 7,
        gear: 13,
        equipped: [],
        skills: [],
        mods: [],
        relic: { currentTier: 8 },
        purchasedAbilityId: [],
        crew: null,
        combatType: 1,
        gp: 25000,
        ...overrides,
    };
}

export default createMockSwapi;
