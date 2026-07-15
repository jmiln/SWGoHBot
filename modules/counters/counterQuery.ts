import type { CounterDoc, CounterEntry, CounterVariant } from "../../schemas/counters.schema.ts";
import cache from "../cache.ts";

export interface DisplayRow {
    atkLeader: string; // baseId
    others: string[]; // attacker baseIds excluding the leader, in stored order
    winPct: number; // 0-100, whole percent
    n: number; // total battles (draws included)
}

/** Char vs fleet from the leader baseId; a leader in the ship-id set is a capital ship. */
export function inferBattleType(leaderBaseId: string, shipBaseIds: Set<string>): "char" | "fleet" {
    return shipBaseIds.has(leaderBaseId) ? "fleet" : "char";
}

/** Top `limit` counters as display rows. Defensive re-sort (data is already best-first). */
export function displayRows(bucket: { counters: CounterEntry[] }, limit = 10): DisplayRow[] {
    return [...bucket.counters]
        .sort((a, b) => b.wins / b.total - a.wins / a.total || b.total - a.total)
        .slice(0, limit)
        .map((c) => ({
            atkLeader: c.atkLeader,
            others: c.attack.filter((id) => id !== c.atkLeader),
            winPct: Math.round((c.wins / c.total) * 100),
            n: c.total,
        }));
}

export type BucketKind = "overall" | "variant" | "closest";

export interface SelectedBucket {
    bucket: { sampleN: number; counters: CounterEntry[] };
    kind: BucketKind;
    defense?: string[]; // present for variant/closest
}

/**
 * Fallback ladder: overall (no members / no variants) -> exact variant (every member,
 * largest sampleN) -> closest variant (highest overlap > 0, sampleN tiebreak) -> overall.
 */
export function selectBucket(doc: CounterDoc, specifiedMemberIds: Set<string>): SelectedBucket {
    if (specifiedMemberIds.size === 0 || doc.variants.length === 0) {
        return { bucket: doc.overall, kind: "overall" };
    }
    const wanted = [...specifiedMemberIds];

    const exact = doc.variants.filter((v) => wanted.every((id) => v.defense.includes(id))).sort((a, b) => b.sampleN - a.sampleN)[0];
    if (exact) return { bucket: exact, kind: "variant", defense: exact.defense };

    let best: CounterVariant | undefined;
    let bestOverlap = 0;
    for (const v of doc.variants) {
        const overlap = wanted.filter((id) => v.defense.includes(id)).length;
        if (overlap === 0) continue;
        if (overlap > bestOverlap || (overlap === bestOverlap && v.sampleN > (best?.sampleN ?? -1))) {
            best = v;
            bestOverlap = overlap;
        }
    }
    if (best) return { bucket: best, kind: "closest", defense: best.defense };

    return { bucket: doc.overall, kind: "overall" };
}

/** Distinct defense-member baseIds across all variants, minus `excludeIds` (leader + picked slots). */
export function variantMemberIds(doc: CounterDoc, excludeIds: Set<string>): string[] {
    const ids = new Set<string>();
    for (const v of doc.variants) {
        for (const id of v.defense) {
            if (!excludeIds.has(id)) ids.add(id);
        }
    }
    return [...ids];
}

/** Split projected `{ leader, battleType }` docs into de-duplicated char and fleet leader lists. */
export function distinctLeaders(docs: { leader: string; battleType: "char" | "fleet" }[]): { char: string[]; fleet: string[] } {
    const char = new Set<string>();
    const fleet = new Set<string>();
    for (const d of docs) {
        (d.battleType === "fleet" ? fleet : char).add(d.leader);
    }
    return { char: [...char], fleet: [...fleet] };
}

export interface CounterView extends SelectedBucket {
    doc: CounterDoc;
    rows: DisplayRow[];
    totalCounters: number; // counters in the chosen bucket before the display cap
}

/** Read-only lookup: one findOne on counterData, then bucket selection + display rows. */
export async function getCounterView(
    db: string,
    query: { mode: "5v5" | "3v3"; battleType: "char" | "fleet"; leader: string },
    specifiedMemberIds: Set<string>,
    limit = 10,
): Promise<CounterView | null> {
    const doc = await cache.getOne<CounterDoc>(db, "counterData", query);
    if (!doc) return null;
    const selected = selectBucket(doc, specifiedMemberIds);
    return {
        doc,
        ...selected,
        rows: displayRows(selected.bucket, limit),
        totalCounters: selected.bucket.counters.length,
    };
}
