declare module "@swgoh-utils/comlink" {
    interface ComlinkStubOptions {
        url?: string;
        statsUrl?: string;
        accessKey?: string;
        secretKey?: string;
        log?: Console;
        compression?: boolean;
    }

    export default class ComlinkStub {
        constructor(options?: ComlinkStubOptions);
        getMetaData(): Promise<unknown>;
        getGameData(version: string, includePveUnits?: boolean, requestSegment?: number): Promise<unknown>;
        getLocalizationBundle(id: string, unzip?: boolean): Promise<unknown>;
        getGuild(guildId: string, includeRecentGuildActivityInfo?: boolean): Promise<unknown>;
        getGuildLeaderboard(
            leaderboardType: unknown,
            defId: unknown,
            monthOffset: unknown,
            count: unknown,
            enums?: boolean,
        ): Promise<unknown>;
        getPlayer(allyCode?: string | null, playerId?: string | null): Promise<unknown>;
        getPlayerArenaProfile(allyCode?: string, playerId?: string, playerDetailsOnly?: boolean): Promise<unknown>;
        getEnums(): Promise<unknown>;
        getNameSpaces(onlyCompatible?: boolean): Promise<unknown>;
        getUnitStats(requestPayload: unknown, flags?: string[], lang?: string): Promise<unknown>;
        _postRequestPromiseAPI(uri: string, payload: unknown): Promise<unknown>;
    }
}
