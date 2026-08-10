import { workerData } from "node:worker_threads";
import { env } from "../../config/config.ts";
import { signRequest } from "../../services/swapiServe/signer.ts";
import type { ComlinkPlayer } from "../../types/swapi_types.ts";
import logger from "../Logger.ts";

interface ModMap {
    [key: string]: {
        pips: number;
        set: string;
        slot: number;
    };
}

const PLAYER_FETCH_TIMEOUT_MS = 30_000;
const PLAYER_URI = "/player";

function getComlinkUrl(): string {
    // dataUpdater resolves once whether swapiServe is reachable and passes the base URL it settled
    // on through workerData, so every thread inherits that one decision instead of each probing the
    // service separately. The fallback to the direct URL only matters if this worker is ever run
    // outside that pool.
    const { comlinkUrl } = (workerData ?? {}) as { comlinkUrl?: string };
    return comlinkUrl ?? env.SWAPI_CLIENT_URL;
}

function getStatusCode(err: unknown): number | undefined {
    if (!(err instanceof Error)) return undefined;
    return (err as Error & { status?: number }).status;
}

/**
 * Fetches one player's roster, with a timeout that actually cancels the request.
 *
 * Deliberately not ComlinkStub. The stub hardcodes its got options and awaits internally, so
 * neither got's `timeout` nor the PCancelable it returns is reachable from outside, and got 11 has
 * no AbortSignal support at all. The only way to bound the call through the stub was to race it
 * against a timer - but a race has a loser that keeps running: the worker thread was freed while
 * the request it had given up on carried on holding a socket, a swapiServe slot and a share of the
 * retry budget, for up to swapiServe's own 60s upstream timeout after this side stopped caring.
 *
 * Signing here is what makes that possible, and costs one small function. Aborting closes the
 * socket, which swapiServe sees as a client disconnect and uses to withdraw the queued request, so
 * giving up locally now actually releases the upstream capacity.
 */
async function fetchPlayerRoster(baseUrl: string, playerId: number, timeoutMs: number): Promise<ComlinkPlayer> {
    // Matches ComlinkStub.getPlayer(null, playerId): the same body the library would have built.
    const body = Buffer.from(JSON.stringify({ payload: { playerId: playerId.toString() } }));

    const headers: Record<string, string> = {
        ...signRequest({
            accessKey: env.SWAPI_ACCESS_KEY,
            secretKey: env.SWAPI_SECRET_KEY,
            method: "POST",
            uri: PLAYER_URI,
            body,
        }),
        "content-type": "application/json",
    };

    const response = await fetch(`${baseUrl}${PLAYER_URI}`, {
        method: "POST",
        headers,
        // Node's fetch accepts a Buffer, but the DOM typings resolved here describe BodyInit
        // without it, so the type is asserted rather than the value converted: the signature's md5
        // was computed over these exact bytes.
        body: body as unknown as BodyInit,
        signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
        throw Object.assign(new Error(`getPlayer(${playerId}) failed with status ${response.status}`), {
            status: response.status,
        });
    }

    return (await response.json()) as ComlinkPlayer;
}

/**
 * Strips a roster down to the mod info the aggregation needs. Pure, so the mapping rules are
 * testable without any of the I/O above.
 */
export function stripRoster(player: ComlinkPlayer | undefined, modMap: ModMap) {
    return player?.rosterUnit
        ?.filter((unit) => unit?.equippedStatMod?.length)
        .map((unit) => ({
            defId: unit.definitionId.split(":")[0],
            mods: unit.equippedStatMod
                .map(({ definitionId, primaryStat }) => {
                    const modSchema = modMap[definitionId];
                    if (!modSchema) return null;
                    return {
                        slot: modSchema.slot - 1, // mod slots are numbered 2-7
                        set: Number(modSchema.set),
                        primaryStat: primaryStat?.stat.unitStatId,
                    };
                })
                .filter((mod) => mod !== null),
        }));
}

/**
 * Fetches one player's roster and strips it down to the mod info the aggregation needs.
 *
 * Retry deliberately lives in swapiServe now, not here. This worker used to retry 502/503 twice
 * itself, which stacked multiplicatively once its calls started going through the queue: three
 * worker attempts times three service attempts is up to nine upstream calls for a single player,
 * amplifying load at exactly the moment the backend is already struggling. The service retries
 * with a shared budget and paces those retries against live traffic, which this thread cannot see.
 *
 * The timeout stays, because it bounds how long a worker thread is held by one wedged request.
 */
export async function fetchPlayerData(baseUrl: string, playerId: number, modMap: ModMap, timeoutMs = PLAYER_FETCH_TIMEOUT_MS) {
    try {
        return stripRoster(await fetchPlayerRoster(baseUrl, playerId, timeoutMs), modMap);
    } catch (err: unknown) {
        const timedOut = err instanceof Error && err.name === "TimeoutError";
        const message = timedOut ? `timed out after ${timeoutMs}ms` : err instanceof Error ? err.message : String(err);
        const code = getStatusCode(err);
        const statusStr = code != null ? ` [status ${code}]` : "";
        logger.error(`[getStrippedModsWorker] Error fetching player ${playerId}:${statusStr} ${message}`);
        return undefined;
    }
}

export default async function ({ playerId, modMap }: { playerId: number; modMap: ModMap }) {
    return fetchPlayerData(getComlinkUrl(), playerId, modMap);
}
