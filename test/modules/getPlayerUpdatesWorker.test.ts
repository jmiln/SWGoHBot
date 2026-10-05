import assert from "node:assert";
import { describe, it } from "node:test";
import { Worker } from "node:worker_threads";
import type { SWAPIPlayer, SWAPIUnit, SWAPIUnitAbility, SWAPIWorkerGuildLog } from "../../types/swapi_types.ts";

const WORKER_PATH = `${import.meta.dirname}/../../modules/workers/getPlayerUpdates.ts`;

interface WorkerWrite {
    updateOne: { filter: { allyCode: number }; update: { $set: Partial<SWAPIPlayer> }; upsert?: boolean };
}

function unit(defId: string, level: number, skills: { id: string; tier: number }[] = []): SWAPIUnit {
    return { defId, level, rarity: 7, gear: 12, skills, relic: { currentTier: 1 } } as unknown as SWAPIUnit;
}

function player(allyCode: number, roster: SWAPIUnit[]): SWAPIPlayer {
    return { allyCode, name: `Player ${allyCode}`, roster } as unknown as SWAPIPlayer;
}

function runWorker(
    oldMembers: SWAPIPlayer[],
    updatedBare: SWAPIPlayer[],
    specialAbilities = new Map<string, SWAPIUnitAbility>(),
): Promise<{ cacheUpdatesOut: WorkerWrite[]; guildLogOut: SWAPIWorkerGuildLog }> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(WORKER_PATH, { workerData: { oldMembers, updatedBare, specialAbilities, chunkIx: 1 } });
        worker.once("message", (msg) => {
            resolve(msg);
            worker.terminate();
        });
        worker.once("error", reject);
        worker.once("exit", (code) => reject(new Error(`Worker exited with code ${code} before posting a result`)));
    });
}

describe("getPlayerUpdates worker", () => {
    // rawPlayers is aged out on `updated`, so it has to mean "last fetched": a tracked player whose
    // roster sits still must not look stale, or cleanup deletes the baseline /guildupdate diffs against
    it("stamps updated on every fetched player, and rewrites the baseline only when there is news", async () => {
        const UNCHANGED = 111111111;
        const LEVELED = 222222222;
        const NEW = 333333333;
        const before = Date.now();

        const { cacheUpdatesOut } = await runWorker(
            [player(UNCHANGED, [unit("VADER", 85)]), player(LEVELED, [unit("VADER", 84)])],
            [player(UNCHANGED, [unit("VADER", 85)]), player(LEVELED, [unit("VADER", 85)]), player(NEW, [unit("REY", 85)])],
        );

        const writeFor = (allyCode: number) => cacheUpdatesOut.find((w) => w.updateOne.filter.allyCode === allyCode)?.updateOne;
        for (const allyCode of [UNCHANGED, LEVELED, NEW]) {
            const stamped = writeFor(allyCode)?.update.$set.updated;
            assert.ok(typeof stamped === "number" && stamped >= before, `Expected ${allyCode} stamped with a fetch time, got ${stamped}`);
        }

        assert.deepStrictEqual(Object.keys(writeFor(UNCHANGED)?.update.$set ?? {}), ["updated"], "The unchanged baseline is kept");
        assert.ok(!writeFor(UNCHANGED)?.upsert, "A timestamp alone must never create a document");
        assert.strictEqual(writeFor(LEVELED)?.update.$set.roster?.[0].level, 85, "Expected the new baseline saved");
        assert.strictEqual(writeFor(NEW)?.upsert, true, "Expected a first-seen player inserted");
    });

    it("logs a skill reaching its zeta tier, looked up from the special ability list", async () => {
        const ZETAD = 444444444;
        const SKILL_ID = "uniqueskill_VADER01";
        const STORED_ZERO_BASED_ZETA_TIER = 7;
        const specialAbilities = new Map([[SKILL_ID, { skillId: SKILL_ID, zetaTier: STORED_ZERO_BASED_ZETA_TIER } as SWAPIUnitAbility]]);

        const { guildLogOut } = await runWorker(
            [player(ZETAD, [unit("VADER", 85, [{ id: SKILL_ID, tier: STORED_ZERO_BASED_ZETA_TIER }])])],
            [player(ZETAD, [unit("VADER", 85, [{ id: SKILL_ID, tier: STORED_ZERO_BASED_ZETA_TIER + 1 }])])],
            specialAbilities,
        );

        assert.deepStrictEqual(guildLogOut[`Player ${ZETAD}`]?.abilities, [`Zeta'd {VADER}'s **{${SKILL_ID}}**`]);
    });

    describe("roster comparison", () => {
        const ALLY = 555555555;
        const mod = (id: string, level: number) => ({ id, level, tier: 5, slot: 1, set: 1, pips: 6, primaryStat: {}, secondaryStat: [] });
        const fullUnit = (defId: string, fields: Partial<Record<string, unknown>> = {}) =>
            ({
                defId,
                level: 85,
                rarity: 7,
                gear: 12,
                skills: [],
                relic: { currentTier: 1 },
                purchasedAbilityId: [],
                equipped: [],
                mods: [mod(`${defId}-mod`, 15)],
                ...fields,
            }) as unknown as SWAPIUnit;
        const specialAbilities = new Map<string, SWAPIUnitAbility>([
            ["uniqueskill_ZETA", { skillId: "uniqueskill_ZETA", zetaTier: 7 } as SWAPIUnitAbility],
            ["leaderskill_OMI", { skillId: "leaderskill_OMI", omicronTier: 8, omicronMode: 7 } as SWAPIUnitAbility],
        ]);
        const oldRoster = [
            fullUnit("VADER", { level: 84, rarity: 6, gear: 11, relic: { currentTier: 3 }, skills: [{ id: "basicskill_VADER", tier: 3 }] }),
            fullUnit("ZETAUNIT", { skills: [{ id: "uniqueskill_ZETA", tier: 7 }] }),
            fullUnit("OMIUNIT", { skills: [{ id: "leaderskill_OMI", tier: 8 }] }),
            fullUnit("MODONLY"),
        ];
        const newRoster = [
            fullUnit("VADER", {
                relic: { currentTier: 5 },
                skills: [{ id: "basicskill_VADER", tier: 4 }],
                purchasedAbilityId: ["ultimateability_VADER"],
            }),
            fullUnit("ZETAUNIT", { skills: [{ id: "uniqueskill_ZETA", tier: 8 }] }),
            fullUnit("OMIUNIT", { skills: [{ id: "leaderskill_OMI", tier: 9 }] }),
            fullUnit("REY"),
            fullUnit("MODONLY", { mods: [mod("MODONLY-mod", 12)] }),
        ];

        it("logs every kind of change, and nothing for a unit whose only change is its mods", async () => {
            const { guildLogOut } = await runWorker([player(ALLY, oldRoster)], [player(ALLY, newRoster)], specialAbilities);

            assert.deepStrictEqual(guildLogOut[`Player ${ALLY}`], {
                abilities: [
                    "Upgraded {VADER}'s **{basicskill_VADER}** to level 4",
                    "Zeta'd {ZETAUNIT}'s **{uniqueskill_ZETA}**",
                    "Omicron'd {OMIUNIT}'s **{leaderskill_OMI}**",
                ],
                geared: ["Geared up {VADER} to G12!"],
                leveled: ["Leveled up {VADER} to 85!"],
                reliced: ["Upgraded {VADER} to relic 3!"],
                starred: ["Starred up {VADER} to 7 star!"],
                unlocked: ["Unlocked {REY}!", " - Upgraded to level 85", " - Upgraded to gear 12"],
                ultimate: ["Unlocked {VADER}'s **ultimate**"],
            });
        });

        it("asks for the names of exactly the units and skills its log mentions", async () => {
            const result = (await runWorker([player(ALLY, oldRoster)], [player(ALLY, newRoster)], specialAbilities)) as unknown as {
                defIds: string[];
                skills: string[];
            };

            assert.deepStrictEqual(result.defIds.sort(), ["OMIUNIT", "REY", "VADER", "ZETAUNIT"], "an unlocked unit needs its name too");
            assert.deepStrictEqual(result.skills.sort(), ["basicskill_VADER", "leaderskill_OMI", "uniqueskill_ZETA"]);
        });

        it("saves the fetched roster as the new baseline exactly as fetched", async () => {
            const { cacheUpdatesOut } = await runWorker([player(ALLY, oldRoster)], [player(ALLY, newRoster)], specialAbilities);

            const saved = cacheUpdatesOut.find((w) => w.updateOne.filter.allyCode === ALLY)?.updateOne.update.$set.roster;
            assert.deepStrictEqual(saved, newRoster, "zeta/omicron lookups must not be written into the stored roster");
        });
    });
});
