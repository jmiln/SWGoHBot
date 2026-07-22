import assert from "node:assert";
import { describe, it } from "node:test";
import MyDatacrons, { buildPlayerDatacronEmbeds } from "../../slash/mydatacrons.ts";
import type { DatacronAbilityRef, PlayerDatacron } from "../../types/datacron_types.ts";
import { createRealLanguage } from "../mocks/mockInteraction.ts";

const language = createRealLanguage();

// setId 32 exists in the derived data/datacrons.json, so getDatacronSet(32).nameKey resolves.
const datacron: PlayerDatacron = {
    id: "a",
    setId: 32,
    templateId: "datacron_set_32_base",
    tag: [],
    locked: false,
    focused: true,
    affix: [
        { statType: 49, statValue: 26807422 },
        { abilityId: "datacron_role_healer_003", targetRule: "target_datacron_healer" },
    ],
};
const abilities: Record<string, DatacronAbilityRef> = {
    datacron_role_healer_003: { nameKey: "DATACRON_ROLE_MECHANIC_NAME", descKey: "DATACRON_ROLE_HEALER_003_DESC" },
};
const textMap = new Map<string, string>([
    ["DATACRON_SET_32_NAME", "Necessary Means"],
    ["DATACRON_ROLE_HEALER_003_DESC", "Whenever {0} allies use a Special ability, they recover Protection."],
]);

describe("/mydatacrons metadata", () => {
    it("is free, scouts any ally code, and shows everything with no set drill-down option", () => {
        assert.strictEqual(MyDatacrons.metadata.permLevel, 0);
        const allycode = MyDatacrons.metadata.options.find((o) => o.name === "allycode");
        assert.ok(allycode);
        assert.strictEqual(allycode?.required ?? false, false);
        assert.strictEqual(allycode?.autocomplete, true);
        assert.strictEqual(MyDatacrons.metadata.options.find((o) => o.name === "set"), undefined, "no set filter - shows everything");
    });
});

describe("buildPlayerDatacronEmbeds", () => {
    it("distinguishes a stale roster (needs refresh) from a genuinely empty one", () => {
        const stale = JSON.stringify(buildPlayerDatacronEmbeds({ name: "Bob" }, textMap, abilities, language, "eng_us"));
        const none = JSON.stringify(buildPlayerDatacronEmbeds({ name: "Bob", datacron: [] }, textMap, abilities, language, "eng_us"));
        assert.ok(stale.includes("refresh"), `stale roster should mention a refresh: ${stale}`);
        assert.ok(!none.includes("refresh"), `an empty roster should not: ${none}`);
        assert.notStrictEqual(stale, none);
    });

    it("shows every datacron with full affix detail by default (no drill-down needed)", () => {
        const embeds = buildPlayerDatacronEmbeds({ name: "Bob", datacron: [datacron] }, textMap, abilities, language, "eng_us");
        const text = JSON.stringify(embeds);
        assert.ok(text.includes("Necessary Means"), "set name shown");
        assert.ok(text.includes("Healer"), "headline target resolved and shown");
        assert.ok(text.includes("Whenever Healer allies"), `{0} filled with the target: ${text}`);
        assert.ok(text.includes("26.81"), "de-scaled stat shown");
        assert.ok(!text.includes("{0}"), "no unfilled placeholder");
        assert.ok(!text.includes("datacron_role_healer"), "no internal id");
    });

    it("spreads many datacrons across multiple embeds (Discord's 10-per-message cap)", () => {
        const many = Array.from({ length: 45 }, (_, i) => ({ ...datacron, id: `d${i}` }));
        const embeds = buildPlayerDatacronEmbeds({ name: "Bob", datacron: many }, textMap, abilities, language, "eng_us");
        assert.ok(embeds.length > 1, "should paginate into multiple embeds");
        assert.ok(embeds.length <= 10, "must not exceed Discord's 10-embed limit");
        assert.ok(embeds[0].title, "first embed carries the title");
    });
});
