import assert from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { refreshDatacronData } from "../../modules/datacrons.ts";
import MyDatacrons, { buildPlayerDatacronMessages } from "../../slash/mydatacrons.ts";
import type { DatacronAbilityRef, PlayerDatacron } from "../../types/datacron_types.ts";
import { createRealLanguage } from "../mocks/mockInteraction.ts";

const language = createRealLanguage();

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_SET_ID = 50;
const EXPIRED_SET_ID = 48;
const RETIRED_SET_ID = EXPIRED_SET_ID - 1;
const UNSEEN_SET_ID = LIVE_SET_ID + 1;

let fixtureDir: string;

before(async () => {
    fixtureDir = await mkdtemp(path.join(tmpdir(), "mydatacrons-"));
    const set = (setId: number, expiresInDays: number) => ({
        setId,
        nameKey: `DATACRON_SET_${setId}_NAME`,
        expirationTimeMs: Date.now() + expiresInDays * DAY_MS,
        allowReroll: true,
        tiers: [],
    });
    const sets = [set(LIVE_SET_ID, 30), set(49, -10), set(EXPIRED_SET_ID, -40)];
    await writeFile(path.join(fixtureDir, "datacrons.json"), JSON.stringify({ sets, abilities: {} }));
    await writeFile(path.join(fixtureDir, "unitMap.json"), "{}");
    await refreshDatacronData(fixtureDir);
});

after(async () => {
    await refreshDatacronData();
    await rm(fixtureDir, { recursive: true, force: true });
});

function charsIn(embeds: { title?: string; description?: string; fields?: { name: string; value: string }[] }[]): number {
    return embeds.reduce(
        (sum, e) =>
            sum +
            (e.title?.length ?? 0) +
            (e.description?.length ?? 0) +
            (e.fields ?? []).reduce((s, f) => s + f.name.length + f.value.length, 0),
        0,
    );
}

const datacron: PlayerDatacron = {
    id: "a",
    setId: LIVE_SET_ID,
    templateId: `datacron_set_${LIVE_SET_ID}_base`,
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
    [`DATACRON_SET_${LIVE_SET_ID}_NAME`, "Necessary Means"],
    ["DATACRON_ROLE_HEALER_003_DESC", "Whenever {0} allies use a Special ability, they recover Protection."],
]);

describe("/mydatacrons metadata", () => {
    it("is free, scouts any ally code, and shows everything with no set drill-down option", () => {
        assert.strictEqual(MyDatacrons.metadata.permLevel, 0);
        const allycode = MyDatacrons.metadata.options.find((o) => o.name === "allycode");
        assert.ok(allycode);
        assert.strictEqual(allycode?.required ?? false, false);
        assert.strictEqual(allycode?.autocomplete, true);
        assert.strictEqual(
            MyDatacrons.metadata.options.find((o) => o.name === "set"),
            undefined,
            "no set filter - shows everything",
        );
    });
});

describe("buildPlayerDatacronMessages", () => {
    it("distinguishes a stale roster (needs refresh) from a genuinely empty one", () => {
        const stale = JSON.stringify(buildPlayerDatacronMessages({ name: "Bob" }, textMap, abilities, language, "eng_us"));
        const none = JSON.stringify(buildPlayerDatacronMessages({ name: "Bob", datacron: [] }, textMap, abilities, language, "eng_us"));
        assert.ok(stale.includes("refresh"), `stale roster should mention a refresh: ${stale}`);
        assert.ok(!none.includes("refresh"), `an empty roster should not: ${none}`);
        assert.notStrictEqual(stale, none);
    });

    it("shows every datacron with full affix detail by default (no drill-down needed)", () => {
        const messages = buildPlayerDatacronMessages({ name: "Bob", datacron: [datacron] }, textMap, abilities, language, "eng_us");
        const text = JSON.stringify(messages);
        assert.ok(text.includes("Necessary Means"), "set name shown");
        assert.ok(text.includes("Healer"), "headline target resolved and shown");
        assert.ok(text.includes("Whenever Healer allies"), `{0} filled with the target: ${text}`);
        assert.ok(text.includes("26.81"), "de-scaled stat shown");
        assert.ok(!text.includes("{0}"), "no unfilled placeholder");
        assert.ok(!text.includes("datacron_role_healer"), "no internal id");
    });

    it("puts live datacrons first and marks expired ones, so dead sets don't bury the current one", () => {
        const expiredOne: PlayerDatacron = { ...datacron, id: "old", setId: EXPIRED_SET_ID, focused: false };
        const [embeds] = buildPlayerDatacronMessages(
            { name: "Bob", datacron: [expiredOne, datacron] },
            textMap,
            abilities,
            language,
            "eng_us",
        );
        const fields = embeds[0].fields ?? [];
        assert.ok(fields[0].name.includes("Necessary Means"), `live set should sort first: ${fields[0].name}`);
        const expiredField = fields.find((f) => f.name.includes(String(EXPIRED_SET_ID)));
        assert.ok(expiredField?.name.includes("expired"), `expired datacron must be flagged: ${expiredField?.name}`);
    });

    it("treats a datacron whose set has rotated out of the game data as expired", () => {
        const retired: PlayerDatacron = { ...datacron, id: "retired", setId: RETIRED_SET_ID, focused: false };
        const [embeds] = buildPlayerDatacronMessages(
            { name: "Bob", datacron: [retired, datacron] },
            textMap,
            abilities,
            language,
            "eng_us",
        );
        const fields = embeds[0].fields ?? [];
        assert.ok(fields[0].name.includes("Necessary Means"), `the live set should sort ahead of a retired one: ${fields[0].name}`);
        const retiredField = fields.find((f) => f.name.includes(String(RETIRED_SET_ID)));
        assert.ok(retiredField?.name.includes("expired"), `a retired set must be flagged expired: ${retiredField?.name}`);
    });

    it("treats a set newer than the game data as live, since the data has not caught up yet", () => {
        const brandNew: PlayerDatacron = { ...datacron, id: "new", setId: UNSEEN_SET_ID, focused: false };
        const [embeds] = buildPlayerDatacronMessages({ name: "Bob", datacron: [brandNew] }, textMap, abilities, language, "eng_us");
        const field = (embeds[0].fields ?? [])[0];
        assert.ok(!field?.name.includes("expired"), `a set the data has not seen yet must not be flagged expired: ${field?.name}`);
    });

    it("shows an 'expires' line as a live relative timestamp in the field body, not the field name", () => {
        // The line goes in the value (which renders <t:...:R> as "in 3 days"), never the name (embed
        // names don't render timestamps).
        const [embeds] = buildPlayerDatacronMessages({ name: "Bob", datacron: [datacron] }, textMap, abilities, language, "eng_us");
        const field = (embeds[0].fields ?? [])[0];
        assert.ok(/<t:\d+:R>/.test(field.value), `expiry should be a relative timestamp in the value: ${field.value}`);
        assert.ok(!field.name.includes("<t:"), `expiry timestamp must not be in the field name: ${field.name}`);
    });

    it("points at /datacron for the full set detail", () => {
        const [embeds] = buildPlayerDatacronMessages({ name: "Bob", datacron: [datacron] }, textMap, abilities, language, "eng_us");
        assert.ok(embeds[0].description?.includes("/datacron"), `expected a cross-link: ${embeds[0].description}`);
    });

    it("spreads many datacrons across multiple embeds (Discord's 10-per-message cap)", () => {
        const many = Array.from({ length: 45 }, (_, i) => ({ ...datacron, id: `d${i}` }));
        const messages = buildPlayerDatacronMessages({ name: "Bob", datacron: many }, textMap, abilities, language, "eng_us");
        assert.ok(messages.flat().length > 1, "should paginate into multiple embeds");
        for (const embeds of messages) {
            assert.ok(embeds.length <= 10, "must not exceed Discord's 10-embed limit");
        }
        assert.ok(messages[0][0].title, "first embed carries the title");
    });

    it("keeps every message under Discord's 6000-char total, sending the rest as follow-ups", () => {
        // A levelled datacron saturates its own 1024-char field cap, so six of them clear 6000 and
        // the API rejects the whole reply with 50035 rather than truncating it.
        const many = Array.from({ length: 45 }, (_, i) => ({ ...datacron, id: `d${i}` }));
        const messages = buildPlayerDatacronMessages({ name: "Bob", datacron: many }, textMap, abilities, language, "eng_us");

        assert.ok(messages.length > 1, "45 datacrons should not be crammed into one message");
        for (const embeds of messages) {
            assert.ok(charsIn(embeds) <= 6000, `message held ${charsIn(embeds)} chars, over Discord's 6000 cap`);
        }
        const totalFields = messages.flat().reduce((n, e) => n + (e.fields ?? []).length, 0);
        assert.strictEqual(totalFields, 45, "every datacron must survive pagination");
    });
});
