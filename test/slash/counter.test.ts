import assert from "node:assert";
import { describe, it } from "node:test";
import { ApplicationCommandOptionType } from "discord.js";
// buildCounterEmbed and filterUnitChoices are exported from the command module for isolated testing.
import Counter, { buildCounterEmbed, filterUnitChoices } from "../../slash/counter.ts";
import { createRealLanguage } from "../mocks/mockInteraction.ts";

const language = createRealLanguage();

describe("counter metadata", () => {
    const meta = Counter.metadata;
    // biome-ignore lint/suspicious/noExplicitAny: metadata is a literal union; tests index it structurally
    const sub = (name: string) => meta.options.find((o: any) => o.name === name) as any;

    it("is free for everyone", () => {
        assert.strictEqual(meta.permLevel, 0);
    });

    it("exposes 5v5 and 3v3 as subcommands, since mode is always required", () => {
        assert.deepStrictEqual(
            // biome-ignore lint/suspicious/noExplicitAny: see above
            meta.options.map((o: any) => o.name),
            ["5v5", "3v3"],
        );
        for (const mode of ["5v5", "3v3"]) {
            assert.strictEqual(sub(mode).type, ApplicationCommandOptionType.Subcommand, `${mode} should be a subcommand`);
        }
    });

    it("gives each mode a required leader and optional members", () => {
        for (const mode of ["5v5", "3v3"]) {
            // biome-ignore lint/suspicious/noExplicitAny: see above
            const opt = (n: string) => sub(mode).options.find((o: any) => o.name === n);
            assert.strictEqual(opt("leader")?.required, true, `${mode} leader should be required`);
            assert.strictEqual(opt("leader")?.autocomplete, true, `${mode} leader should autocomplete`);
            assert.strictEqual(opt("member2")?.required ?? false, false);
            assert.strictEqual(opt("member5")?.required ?? false, false);
            assert.strictEqual(opt("battletype")?.required ?? false, false);
        }
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

    it("gives each counter its own field: attack leader as the name, team then stats below", () => {
        const embed = buildCounterEmbed(view as never, "Boss Nass", "5v5", "char", nameOf, language);
        assert.ok(embed.title.includes("Boss Nass"));

        const row = embed.fields[0];
        // Leader is the field name (Discord renders field names bold) — not crammed into the team line.
        assert.strictEqual(row.name, "General Skywalker");
        // Team on its own line, stats on the line after it.
        assert.strictEqual(row.value, "ARC Trooper, Fives\n**90% win** · 30 battles");
        assert.ok(embed.footer.text.includes("gahistory.c3po.wtf"));
    });

    it("renders the battleType in the context line, and names the matched defense comp", () => {
        const embed = buildCounterEmbed(view as never, "Boss Nass", "5v5", "fleet", nameOf, language);
        assert.ok(embed.description.includes("fleet"), "context line should show the battleType");
        assert.ok(!embed.description.includes("char/fleet"), "must not render a kind label in the battleType slot");
        assert.ok(embed.description.includes("Boss Nass, Jar Jar"), "variant view names the defense comp");
    });

    it("appends a top-10 note field only when the bucket is truncated", () => {
        const truncated = buildCounterEmbed(view as never, "Boss Nass", "5v5", "char", nameOf, language);
        assert.ok(
            truncated.fields.some((f) => f.value.includes("Showing top 10")),
            "totalCounters 12 > 1 row shown",
        );

        const small = { ...view, totalCounters: 1 };
        const whole = buildCounterEmbed(small as never, "Boss Nass", "5v5", "char", nameOf, language);
        assert.ok(!whole.fields.some((f) => f.value.includes("Showing top 10")));
    });

    it("omits the team line for a solo attacker rather than leaving a blank line", () => {
        const solo = { ...view, rows: [{ atkLeader: "GAS", others: [], winPct: 75, n: 8 }] };
        const embed = buildCounterEmbed(solo as never, "Boss Nass", "5v5", "char", nameOf, language);
        assert.strictEqual(embed.fields[0].value, "**75% win** · 8 battles");
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
