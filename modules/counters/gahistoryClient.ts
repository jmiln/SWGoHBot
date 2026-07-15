import type { RawPlayerDoc } from "./counterAggregator.ts";

const GAHISTORY_BASE = "https://gahistory.c3po.wtf";

/**
 * Leagues we fold into the counter stats, best-first.
 *
 * KYBER alone is only ~4.8% of the ~189k tracked players, which spreads each defense across too few
 * battles: teams end up seen 11-200 times, so coin-flip 100% win rates survive and crowd out the
 * teams people actually field. Widening to AURODIUM/CHROMIUM/BRONZIUM gives ~134k players (~15x),
 * enough for win rates to regress toward the truth.
 *
 * CARBONITE is deliberately excluded: it is the largest bucket (~54k) and the parking spot for AFK
 * players, whose unattended defenses would inflate every attacker's win rate.
 */
export const INGEST_LEAGUES = ["KYBER", "AURODIUM", "CHROMIUM", "BRONZIUM"] as const;

export type Mode = "5v5" | "3v3";
export interface InfoDoc {
    instanceId: string;
    season: number;
    eventInstanceId: string;
}
export interface FetchResponse {
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}
export type FetchImpl = (url: string) => Promise<FetchResponse>;

export interface GahistoryClient {
    getInfo(mode: Mode): Promise<InfoDoc>;
    getPlayerIds(mode: Mode): Promise<string[]>;
    getPlayer(mode: Mode, playerId: string): Promise<RawPlayerDoc | null>;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Rolling 10s-window limiter to stay well under the source's 2000/10s/IP cap. */
function makeLimiter(maxPer10s: number) {
    let windowStart = Date.now();
    let count = 0;
    return async function gate(): Promise<void> {
        for (;;) {
            const now = Date.now();
            if (now - windowStart >= 10_000) {
                windowStart = now;
                count = 0;
            }
            if (count < maxPer10s) {
                count++;
                return;
            }
            await sleep(10_000 - (now - windowStart) + 10);
        }
    };
}

export function createGahistoryClient(opts: { fetchImpl?: FetchImpl; maxPer10s?: number } = {}): GahistoryClient {
    const doFetch: FetchImpl = opts.fetchImpl ?? ((url) => fetch(url) as unknown as Promise<FetchResponse>);
    const gate = makeLimiter(opts.maxPer10s ?? 500);

    async function getJson(path: string, tries = 4): Promise<{ status: number; data: unknown }> {
        let lastStatus = 0;
        for (let attempt = 1; attempt <= tries; attempt++) {
            await gate();
            try {
                const res = await doFetch(`${GAHISTORY_BASE}${path}`);
                if (res.status === 404) return { status: 404, data: null };
                if (res.status === 429 || res.status >= 500) {
                    lastStatus = res.status;
                    await sleep(500 * attempt);
                    continue;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
                return { status: res.status, data: await res.json() };
            } catch (err) {
                lastStatus = -1;
                if (attempt === tries) throw err;
                await sleep(500 * attempt);
            }
        }
        throw new Error(`gahistory request failed after ${tries} tries (last status ${lastStatus}): ${path}`);
    }

    return {
        async getInfo(mode) {
            const { data } = await getJson(`/${mode}/info.json`);
            const d = data as InfoDoc | null;
            if (!d?.instanceId) throw new Error(`gahistory ${mode}/info.json missing instanceId (not posted yet?)`);
            return { instanceId: d.instanceId, season: d.season, eventInstanceId: d.eventInstanceId };
        },
        async getPlayerIds(mode) {
            const { data } = await getJson(`/${mode}/players.json`);
            const d = (data ?? {}) as Record<string, string[] | undefined>;
            // De-duplicated across leagues: a player should only ever appear in one, but a repeat
            // would otherwise double-count every one of their battles.
            const ids = new Set<string>();
            for (const league of INGEST_LEAGUES) {
                for (const id of d[league] ?? []) ids.add(id);
            }
            return [...ids];
        },
        async getPlayer(mode, playerId) {
            const { status, data } = await getJson(`/${mode}/${playerId}.json`);
            if (status === 404 || data == null) return null;
            return data as RawPlayerDoc;
        },
    };
}
