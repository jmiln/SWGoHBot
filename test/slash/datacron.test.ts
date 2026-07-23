import assert from "node:assert";
import { describe, it } from "node:test";
import Datacron, { buildDatacronSetEmbeds, buildSetChoices } from "../../slash/datacron.ts";
import type { DatacronAbilityRef, DatacronSetRef } from "../../types/datacron_types.ts";
import { createRealLanguage } from "../mocks/mockInteraction.ts";

const language = createRealLanguage();

// statType 49 (Defense) is a percentage stat -> de-scales by 1e6 (10000000 -> 10, 25000000 -> 25).
const set: DatacronSetRef = {
    setId: 32,
    nameKey: "DATACRON_SET_32_NAME",
    expirationTimeMs: 1900000000000,
    allowReroll: true,
    tiers: [
        { tier: 1, affixPool: [{ statType: 49, statValueMin: 10000000, statValueMax: 25000000 }] },
        {
            tier: 3,
            requiredRelicTier: 5,
            affixPool: [{ abilityId: "datacron_role_healer_003", targetRule: "target_datacron_healer" }],
        },
    ],
};
const abilities: Record<string, DatacronAbilityRef> = {
    datacron_role_healer_003: { nameKey: "DATACRON_ROLE_MECHANIC_NAME", descKey: "DATACRON_ROLE_HEALER_003_DESC" },
};
const textMap = new Map<string, string>([
    ["DATACRON_SET_32_NAME", "Necessary Means"],
    ["DATACRON_ROLE_HEALER_003_DESC", "Whenever {0} allies use a Special ability, they recover Protection."],
]);

describe("/datacron metadata", () => {
    it("is free, and the set option is optional (defaults to current) with name autocomplete", () => {
        assert.strictEqual(Datacron.metadata.permLevel, 0);
        const opt = (n: string) => Datacron.metadata.options.find((o) => o.name === n);
        assert.strictEqual(opt("set")?.required ?? false, false, "set is optional - defaults to current");
        assert.strictEqual(opt("set")?.autocomplete, true);
        assert.strictEqual(opt("tier")?.required ?? false, false);
    });
});

describe("buildSetChoices", () => {
    // Mirrors the real spread: a few active sets and a pile of long-expired ones.
    const choicesIn = [
        { id: 33, name: "Supremacy Directive", expired: false },
        { id: 32, name: "Necessary Means", expired: false },
        { id: 29, name: "Edict and Uprising", expired: true },
        { id: 26, name: "Bounty Protocol", expired: true },
    ];

    it("labels every choice with the set name, since the number means nothing to a player", () => {
        const choices = buildSetChoices(choicesIn, "", "expired");
        assert.strictEqual(choices.length, 4);
        for (const c of choices) {
            assert.ok(/^\d+ - .+/.test(c.name), `choice should be "num - name", got: ${c.name}`);
        }
        assert.strictEqual(choices[0].value, 33, "newest active set first");
    });

    it("marks expired sets and sorts them below the active ones", () => {
        const choices = buildSetChoices(choicesIn, "", "expired");
        assert.deepStrictEqual(
            choices.map((c) => c.value),
            [33, 32, 29, 26],
            "active sets first, each group newest-first",
        );
        assert.ok(!choices[0].name.includes("expired"), `active set should not be marked: ${choices[0].name}`);
        assert.ok(choices[2].name.includes("expired"), `expired set must be marked: ${choices[2].name}`);
    });

    it("matches on the name, so a player who only knows the name can find it", () => {
        assert.deepStrictEqual(
            buildSetChoices(choicesIn, "bounty", "expired").map((c) => c.value),
            [26],
        );
    });

    it("still matches on the set number", () => {
        assert.deepStrictEqual(
            buildSetChoices(choicesIn, "32", "expired").map((c) => c.value),
            [32],
        );
    });

    it("falls back to 'Set N' only when a name is genuinely missing", () => {
        const choices = buildSetChoices([{ id: 29, name: "", expired: false }], "", "expired");
        assert.strictEqual(choices[0].name, "Set 29");
    });

    it("uses the caller-supplied (localizable) expired marker, not a hardcoded English one", () => {
        const choices = buildSetChoices([{ id: 26, name: "Bounty Protocol", expired: true }], "", "abgelaufen");
        assert.ok(choices[0].name.includes("abgelaufen"), `expected the passed marker: ${choices[0].name}`);
    });
});

describe("buildDatacronSetEmbeds", () => {
    it("titles with the localized set name and shows expiry + rerollable", () => {
        const embeds = buildDatacronSetEmbeds(set, null, textMap, abilities, language, "eng_us");
        assert.ok(embeds[0].title?.includes("Necessary Means"), `expected localized name in: ${embeds[0].title}`);
        assert.ok(JSON.stringify(embeds).includes("<t:"), "expiry should be a Discord timestamp");
    });

    it("overview shows what each tier can boost (target names), not raw pools", () => {
        const text = JSON.stringify(buildDatacronSetEmbeds(set, null, textMap, abilities, language, "eng_us"));
        assert.ok(text.includes("Healer"), `ability tier should list its target: ${text}`);
        assert.ok(!text.includes("Whenever Healer allies"), "overview should not dump full ability text");
    });

    it("a specific tier shows the de-scaled stat pool", () => {
        const text = JSON.stringify(buildDatacronSetEmbeds(set, 1, textMap, abilities, language, "eng_us"));
        assert.ok(text.includes("10") && text.includes("25"), `expected de-scaled range in: ${text}`);
        assert.ok(!text.includes("10000000"), "raw scaled value leaked");
    });

    it("a specific ability tier shows full text with {0} filled, one field per option", () => {
        const embeds = buildDatacronSetEmbeds(set, 3, textMap, abilities, language, "eng_us");
        const text = JSON.stringify(embeds);
        assert.ok(text.includes("Whenever Healer allies"), `expected {0} filled in: ${text}`);
        assert.ok(!text.includes("{0}"), "no unfilled placeholder");
        assert.ok(!text.includes("datacron_role_healer"), "no internal id");
        // The option's target heads its own field, so you can see which target each ability is for.
        assert.ok(
            embeds[0].fields?.some((f) => f.name.includes("Healer")),
            `expected a per-option field named for its target: ${text}`,
        );
    });

    it("never truncates ability text: a tier with many long abilities keeps every one intact", () => {
        // Real tier 9s carry ~10 abilities of 200-500 chars each, far past Discord's 1024-per-field
        // limit. Cramming them into one field chopped the last one mid-word.
        const longAbilities = Array.from({ length: 10 }, (_, i) => ({
            abilityId: `ability_${i}`,
            targetRule: `target_datacron_char${i}`,
        }));
        const bigAbilities: Record<string, DatacronAbilityRef> = {};
        const bigText = new Map<string, string>([["DATACRON_SET_32_NAME", "Necessary Means"]]);
        for (let i = 0; i < 10; i++) {
            bigAbilities[`ability_${i}`] = { nameKey: "DATACRON_ROLE_MECHANIC_NAME", descKey: `DESC_${i}` };
            bigText.set(`DESC_${i}`, `Ability ${i}: ${"x".repeat(400)} END${i}`);
        }
        const bigSet: DatacronSetRef = {
            setId: 32,
            nameKey: "DATACRON_SET_32_NAME",
            allowReroll: true,
            tiers: [{ tier: 9, requiredRelicTier: 8, affixPool: longAbilities }],
        };

        const embeds = buildDatacronSetEmbeds(bigSet, 9, bigText, bigAbilities, language, "eng_us");
        const text = JSON.stringify(embeds);
        for (let i = 0; i < 10; i++) {
            assert.ok(text.includes(`END${i}`), `ability ${i} was truncated - its tail is missing`);
        }
        // Every field must respect Discord's own limit rather than being sliced mid-sentence.
        for (const embed of embeds) {
            for (const f of embed.fields ?? []) {
                assert.ok(f.value.length <= 1024, `field value exceeds Discord's 1024 limit: ${f.value.length}`);
            }
            assert.ok((embed.fields ?? []).length <= 25, "embed exceeds Discord's 25-field limit");
        }
    });

    it("states possibilities, never instructions (presentation rule)", () => {
        const text = JSON.stringify(buildDatacronSetEmbeds(set, 1, textMap, abilities, language, "eng_us")).toLowerCase();
        for (const banned of ["you should", "recommend", "best choice", "worth rerolling", "don't reroll"]) {
            assert.ok(!text.includes(banned), `presentation rule violated by: "${banned}"`);
        }
    });
});
