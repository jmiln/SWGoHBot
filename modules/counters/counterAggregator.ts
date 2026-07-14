export interface RawUnit {
    definitionId: string;
    squadUnitType?: number;
}

export interface RawDuel {
    attackerUnit?: RawUnit[];
    defenderUnit?: RawUnit[];
    battleOutcome?: number;
}

export interface RawPlayerDoc {
    matchResult?: { attackResult?: { duelResult?: RawDuel[] }[] }[];
}

export type BattleType = "char" | "fleet";

export interface SquadInfo {
    kind: BattleType | "unknown";
    leader: string | null;
}

/** "GRIEVOUS:SEVEN_STAR" -> "GRIEVOUS" */
export function baseId(defId: string): string {
    return String(defId ?? "").split(":")[0];
}

export function teamIds(units: RawUnit[]): string[] {
    return Array.isArray(units) ? units.map((u) => baseId(u?.definitionId)).filter(Boolean) : [];
}

/** Order-independent identity for a team of baseIds. */
export function teamKey(ids: string[]): string {
    return [...ids].sort().join("+");
}

/**
 * Classify a squad and find its leader from squadUnitType (NOT index 0).
 * 2 = character leader, 3 = fleet capital, 5 = fleet reinforcement, 1 = member/starting ship.
 */
export function squadInfo(units: RawUnit[]): SquadInfo {
    if (!Array.isArray(units) || !units.length) {
        return { kind: "unknown", leader: null };
    }
    const isFleet = units.some((u) => u?.squadUnitType === 3 || u?.squadUnitType === 5);
    if (isFleet) {
        const cap = units.find((u) => u?.squadUnitType === 3) ?? units[0];
        return { kind: "fleet", leader: baseId(cap?.definitionId) };
    }
    const lead = units.find((u) => u?.squadUnitType === 2) ?? units[0];
    return { kind: "char", leader: baseId(lead?.definitionId) };
}

export interface CounterTally {
    attack: string[];
    atkLeader: string;
    wins: number;
    total: number;
    draws: number;
}
export interface VariantTally {
    defense: string[];
    sampleN: number;
    byAttack: Map<string, CounterTally>;
}
export interface LeaderTally {
    battleType: BattleType;
    leader: string;
    sampleN: number;
    overallByAttack: Map<string, CounterTally>;
    variants: Map<string, VariantTally>;
}
export type Accumulator = Map<string, LeaderTally>;

function bumpTally(map: Map<string, CounterTally>, key: string, attack: string[], atkLeader: string, outcome: number): void {
    let row = map.get(key);
    if (!row) {
        row = { attack, atkLeader, wins: 0, total: 0, draws: 0 };
        map.set(key, row);
    }
    row.total++;
    if (outcome === 1) row.wins++;
    else if (outcome === 3) row.draws++;
    // outcome 2 = defense held = attacker loss (already counted in total)
}

/** Fold a single attack duel into the accumulator, keyed by the defense leader. */
export function foldDuel(acc: Accumulator, duel: RawDuel): void {
    const def = squadInfo(duel?.defenderUnit ?? []);
    const atk = squadInfo(duel?.attackerUnit ?? []);
    const outcome = duel?.battleOutcome;
    if ((def.kind !== "char" && def.kind !== "fleet") || !def.leader || outcome == null) return;

    const atkIds = teamIds(duel?.attackerUnit ?? []);
    const defIds = teamIds(duel?.defenderUnit ?? []);
    if (!atkIds.length || !defIds.length) return;

    const accKey = `${def.kind}:${def.leader}`;
    let lead = acc.get(accKey);
    if (!lead) {
        lead = { battleType: def.kind, leader: def.leader, sampleN: 0, overallByAttack: new Map(), variants: new Map() };
        acc.set(accKey, lead);
    }
    lead.sampleN++;

    const aKey = teamKey(atkIds);
    const atkLeader = atk.leader ?? atkIds[0];
    bumpTally(lead.overallByAttack, aKey, atkIds, atkLeader, outcome);

    const dKey = teamKey(defIds);
    let variant = lead.variants.get(dKey);
    if (!variant) {
        variant = { defense: defIds, sampleN: 0, byAttack: new Map() };
        lead.variants.set(dKey, variant);
    }
    variant.sampleN++;
    bumpTally(variant.byAttack, aKey, atkIds, atkLeader, outcome);
}

/** Fold every attackResult duel from a player's match history. defenseResult is ignored. */
export function foldPlayer(acc: Accumulator, doc: RawPlayerDoc): void {
    for (const match of doc?.matchResult ?? []) {
        for (const group of match?.attackResult ?? []) {
            for (const duel of group?.duelResult ?? []) foldDuel(acc, duel);
        }
    }
}

export interface BuildOptions {
    minBattles: number;
    countersPerBucket: number;
    variantsPerLeader: number;
    variantCoverage: number;
}
export interface BuildMeta {
    mode: "5v5" | "3v3";
    instanceId: string;
    season: number;
}

export const DEFAULT_BUILD_OPTIONS: BuildOptions = { minBattles: 5, countersPerBucket: 15, variantsPerLeader: 20, variantCoverage: 0.9 };

import type { CounterDoc, CounterEntry } from "../../schemas/counters.schema.ts";

const winRate = (t: CounterTally): number => (t.total ? t.wins / t.total : 0);

/** Filter by minBattles, sort by win% then sample size, cap, and strip to the stored shape. */
function rankCounters(byAttack: Map<string, CounterTally>, opts: BuildOptions): CounterEntry[] {
    return [...byAttack.values()]
        .filter((t) => t.total >= opts.minBattles)
        .sort((a, b) => winRate(b) - winRate(a) || b.total - a.total)
        .slice(0, opts.countersPerBucket)
        .map((t) => ({ attack: t.attack, atkLeader: t.atkLeader, wins: t.wins, total: t.total, draws: t.draws }));
}

/** Keep only the variants covering `variantCoverage` of the leader's attacks, capped. */
function selectVariants(lead: LeaderTally, opts: BuildOptions): CounterDoc["variants"] {
    const sorted = [...lead.variants.values()].sort((a, b) => b.sampleN - a.sampleN);
    const target = lead.sampleN * opts.variantCoverage;
    const out: CounterDoc["variants"] = [];
    let cumulative = 0;
    for (const v of sorted) {
        if (out.length >= opts.variantsPerLeader || cumulative >= target) break;
        const counters = rankCounters(v.byAttack, opts);
        if (counters.length) {
            out.push({ defense: v.defense, sampleN: v.sampleN, counters });
            cumulative += v.sampleN;
        }
    }
    return out;
}

export function buildCounterDocs(acc: Accumulator, meta: BuildMeta, options: BuildOptions = DEFAULT_BUILD_OPTIONS): CounterDoc[] {
    const docs: CounterDoc[] = [];
    for (const lead of acc.values()) {
        const counters = rankCounters(lead.overallByAttack, options);
        if (!counters.length) continue; // nothing meets the threshold for this leader
        docs.push({
            mode: meta.mode,
            battleType: lead.battleType,
            leader: lead.leader,
            instanceId: meta.instanceId,
            season: meta.season,
            overall: { sampleN: lead.sampleN, counters },
            variants: selectVariants(lead, options),
        });
    }
    return docs;
}
