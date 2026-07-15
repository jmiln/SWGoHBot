import assert from "node:assert";
import { describe, it } from "node:test";
// buildCounterEmbed and filterUnitChoices are exported from the command module for isolated testing.
import Counter, { buildCounterEmbed, filterUnitChoices } from "../../slash/counter.ts";
import { createRealLanguage } from "../mocks/mockInteraction.ts";

const language = createRealLanguage();

describe("counter metadata", () => {
    it("is a free char/fleet lookup with required mode + leader", () => {
        const meta = Counter.metadata;
        assert.strictEqual(meta.permLevel, 0);
        const opt = (n: string) => meta.options.find((o) => o.name === n);
        assert.strictEqual(opt("mode")?.required, true);
        assert.strictEqual(opt("leader")?.required, true);
        assert.strictEqual(opt("member2")?.required ?? false, false);
    });
});

describe("buildCounterEmbed", () => {
    // nameOf is a plain (baseId -> display name) function passed in by the command.
    const nameOf = (id: string) => ({ GAS: "General Skywalker", ARC: "ARC Trooper", FIVES: "Fives", BOSSNASS: "Boss Nass", JARJAR: "Jar Jar" }[id] ?? id);
    const view = {
        kind: "variant" as const,
        defense: ["BOSSNASS", "JARJAR"],
        totalCounters: 12,
        doc: { mode: "5v5", season: 80, instanceId: "O1" },
        bucket: { sampleN: 40 },
        rows: [{ atkLeader: "GAS", others: ["ARC", "FIVES"], winPct: 90, n: 30 }],
    };

    it("marks the attack leader, lists others, shows win% and n, and top-10 note", () => {
        const embed = buildCounterEmbed(view as never, "Boss Nass", "5v5", "char", nameOf, language);
        assert.ok(embed.title.includes("Boss Nass"));
        assert.ok(embed.description.includes("General Skywalker (L)"));
        assert.ok(embed.description.includes("ARC Trooper"));
        assert.ok(embed.description.includes("90%"));
        assert.ok(embed.description.includes("n=30"));
        assert.ok(embed.description.includes("Showing top 10")); // totalCounters 12 > 10
        assert.ok(embed.footer.text.includes("gahistory.c3po.wtf"));
    });

    it("renders the battleType in the context line, and names the matched defense comp", () => {
        const embed = buildCounterEmbed(view as never, "Boss Nass", "5v5", "fleet", nameOf, language);
        assert.ok(embed.description.includes("fleet"), "context line should show the battleType");
        assert.ok(!embed.description.includes("char/fleet"), "must not render a kind label in the battleType slot");
        assert.ok(embed.description.includes("Boss Nass, Jar Jar"), "variant view names the defense comp");
    });

    it("omits the top-10 note when the bucket is not truncated", () => {
        const small = { ...view, totalCounters: 1 };
        const embed = buildCounterEmbed(small as never, "Boss Nass", "5v5", "char", nameOf, language);
        assert.ok(!embed.description.includes("Showing top 10"));
    });
});

describe("filterUnitChoices", () => {
    const candidates = [
        { name: "General Grievous", value: "GRIEVOUS", aliases: ["gg"], crew: [] },
        { name: "Malevolence", value: "CAPITALMALEVOLENCE", aliases: [], crew: ["General Grievous"] },
        { name: "Rey", value: "REY", aliases: [], crew: [] },
    ];

    it("matches on name", () => {
        assert.deepStrictEqual(
            filterUnitChoices(candidates, "rey").map((c) => c.value),
            ["REY"],
        );
    });

    it("matches an alias", () => {
        assert.deepStrictEqual(
            filterUnitChoices(candidates, "gg").map((c) => c.value),
            ["GRIEVOUS"],
        );
    });

    it("matches a captain name against both the character and the ship he crews", () => {
        const out = filterUnitChoices(candidates, "grievous");
        assert.deepStrictEqual(new Set(out.map((c) => c.value)), new Set(["GRIEVOUS", "CAPITALMALEVOLENCE"]));
    });

    it("returns only name/value pairs, dropping the match-only fields", () => {
        assert.deepStrictEqual(filterUnitChoices(candidates, "rey"), [{ name: "Rey", value: "REY" }]);
    });

    it("caps at the limit", () => {
        assert.strictEqual(filterUnitChoices(candidates, "", 2).length, 2);
    });
});
