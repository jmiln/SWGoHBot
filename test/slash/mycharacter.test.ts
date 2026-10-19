import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import constants from "../../data/constants/constants.ts";
import cache from "../../modules/cache.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import MyCharacter from "../../slash/mycharacter.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createMockPlayer, createMockUnit, createRealLanguage } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("MyCharacter", () => {
    const originalPlayer = swgohAPI.player;
    const originalLangChar = swgohAPI.langChar;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        swgohAPI.player = originalPlayer;
        swgohAPI.langChar = originalLangChar;
        await closeMongoClient();
    });

    beforeEach(() => {
        swgohAPI.player = originalPlayer;
        swgohAPI.langChar = originalLangChar;
    });

    it("should have character and ship subcommands", () => {
        const command = new MyCharacter();
        const subcommandNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(subcommandNames.includes("character"), "Expected character subcommand");
        assert.ok(subcommandNames.includes("ship"), "Expected ship subcommand");
    });

    it("should return error for character search with no ally code registered", async () => {
        // No allycode provided and user not registered → getAllyCode returns null → error before reply
        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "Darth Vader" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new MyCharacter();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_INVALID_ALLY_CODE");
    });

    it("should return error when character search yields no matches", async () => {
        // Literal allycode bypasses MongoDB. Invalid character name fails findChar before reply
        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "NONEXISTENT_UNIT_ZZZ_999", allycode: "123456789" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new MyCharacter();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_SWGOH_NO_CHAR_FOUND");
    });

    it("should return error when player does not have the character unlocked", async () => {
        swgohAPI.player = async () =>
            createMockPlayer({
                allyCode: 123456789,
                name: "TestPlayer",
                updatedAt: new Date(),
                roster: [], // Empty roster → character is locked
            });

        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new MyCharacter();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_SWGOH_LOCKED_CHAR");
    });

    // Discord shows <t:...> raw in an embed footer; only descriptions, field values and content render it
    it("puts the locked-character error's last-updated timestamp where Discord renders it, not in the footer", async () => {
        const updatedAt = new Date("2026-10-05T12:00:00.000Z");
        swgohAPI.player = async () => createMockPlayer({ allyCode: 123456789, name: "TestPlayer", updatedAt, roster: [] });

        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
        });
        await new MyCharacter().run(createCommandContext({ interaction, language: createRealLanguage() }));

        const embedData = getLastReply(interaction).embeds[0].data;
        const stamp = `<t:${Math.floor(updatedAt.getTime() / 1000)}>`;
        assert.ok(
            embedData.description?.endsWith(`\n\nLast updated ${stamp}`),
            `Expected the timestamp in the description after a blank line, got ${JSON.stringify(embedData.description)}`,
        );
        assert.strictEqual(embedData.footer, undefined, `Expected no footer, got ${JSON.stringify(embedData.footer)}`);
    });

    it("should display character stats when player has the unit", async () => {
        const vaderUnit = createMockUnit({
            defId: "VADER",
            nameKey: "Darth Vader",
            combatType: 1,
            level: 85,
            rarity: 7,
            gear: 13,
            gp: 25000,
            skills: [{ id: "basicskill", tier: 8, tiers: 8, isZeta: false, isOmicron: false, nameKey: "Basic" } as any],
            equipped: [],
            stats: {
                final: {
                    Speed: 180,
                    Health: 50000,
                    Protection: 20000,
                    Strength: 100,
                    Agility: 100,
                    Intelligence: 100,
                } as any,
                mods: {} as any,
                gp: 25000,
            },
        });

        swgohAPI.player = async () =>
            createMockPlayer({
                allyCode: 123456789,
                name: "TestPlayer",
                updatedAt: new Date(),
                roster: [vaderUnit],
            });
        swgohAPI.langChar = async (char) => char;

        const interaction = createMockInteraction({
            optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
        });
        // Real language so BASE_STAT_NAMES resolves to an object and the stat rows render; with
        // the key-echoing mock the lookups miss and the values never appear.
        const ctx = createCommandContext({ interaction, language: createRealLanguage() });
        const command = new MyCharacter();
        await command.run(ctx);

        const reply = getLastReply(interaction);
        assert.ok(reply.embeds?.length > 0, "Expected embed in reply");
        assert.ok(!reply.flags?.length, "Expected non-ephemeral reply");

        const embedData = reply.embeds[0].data || reply.embeds[0];

        // Author is "<player>'s <unit>"; description carries level/rarity/gp and the gear line.
        assert.ok(embedData.author?.name?.includes("TestPlayer"), "Expected the player name in the author");
        assert.ok(embedData.author?.name?.includes("Darth Vader"), "Expected the character name in the author");
        assert.match(embedData.description, /lvl 85 \| 7\* \| 25000 gp/, "Expected the rendered level/rarity/gp line");
        assert.match(embedData.description, /Gear: 13/, "Expected the rendered gear line");

        const fieldValue = (match: string): string =>
            embedData.fields?.find((f: { name: string; value: string }) => f.name.includes(match))?.value ?? "";

        // Abilities field lists the maxed basic ability.
        assert.ok(fieldValue("Abilities").includes("Basic"), "Expected the ability name in the Abilities field");

        // expandSpaces pads the stat labels with zero-width spaces, so assert the label and its
        // ":: value" separately rather than with a \s* bridge.
        const stats = fieldValue("Stats");
        assert.ok(stats.includes("Speed"), "Expected the Speed stat label");
        assert.ok(stats.includes(":: 180"), "Expected the rendered Speed value");
        assert.ok(stats.includes("Health"), "Expected the Health stat label");
        assert.ok(stats.includes(":: 50,000"), "Expected the rendered Health value with a locale comma");
        assert.ok(stats.includes("Protection"), "Expected the Protection stat label");
        assert.ok(stats.includes(":: 20,000"), "Expected the rendered Protection value");
    });

    describe("output", () => {
        const ZETA_STAR = String.fromCodePoint(0x2726);
        const OMEGA = String.fromCodePoint(0x2b53);

        const vader = (overrides: Record<string, any> = {}) =>
            createMockUnit({
                defId: "VADER",
                combatType: 1,
                level: 85,
                rarity: 7,
                gear: 12,
                gp: 25000,
                equipped: [],
                skills: [],
                stats: { final: { Speed: 180, Health: 50000 } as any, mods: {} as any, gp: 25000 },
                ...overrides,
            });

        const stubImageServer = (
            t: { mock: { method: (obj: any, name: string, impl: (...args: any[]) => any) => unknown } },
            hasImage: boolean,
        ) =>
            t.mock.method(globalThis, "fetch", async () =>
                hasImage ? new Response(new Uint8Array([1, 2, 3])) : new Response(null, { status: 503 }),
            );

        async function show(
            t: { mock: { method: (obj: any, name: string, impl: (...args: any[]) => any) => unknown } },
            options: Record<string, unknown>,
            { roster = [vader()], player = {}, image = false, langChar = (c: any) => c }: Record<string, any> = {},
        ) {
            stubImageServer(t, image);
            swgohAPI.player = async () =>
                createMockPlayer({
                    allyCode: 123456789,
                    name: "TestPlayer",
                    updatedAt: new Date("2030-06-01T00:00:00Z"),
                    roster,
                    ...player,
                });
            swgohAPI.langChar = async (c) => langChar(c);
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", ...options },
            });
            await new MyCharacter().run(createCommandContext({ interaction, language: createRealLanguage() }));
            const reply = getLastReply(interaction);
            const embed = reply.embeds?.[0]?.data ?? reply.embeds?.[0];
            const field = (name: string): string =>
                (embed?.fields?.find((f: { name: string }) => f.name.includes(name))?.value ?? "").replaceAll(constants.zws, "");
            return { reply, embed, field, description: (embed?.description ?? "").replaceAll(constants.zws, "") };
        }

        it("lists the close matches when the search is ambiguous", async (t) => {
            const { description } = await show(t, { character: "Darth" });

            assert.ok(description.startsWith("Your search came up with too many results"), description);
        });

        it("reports a failed player fetch", async (t) => {
            stubImageServer(t, false);
            swgohAPI.player = async () => {
                throw new Error("timeout");
            };
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
            });

            await new MyCharacter().run(createCommandContext({ interaction, language: createRealLanguage() }));

            const embed = getLastReply(interaction).embeds[0].data;
            assert.strictEqual(embed.author.name, "Something Broke");
            assert.strictEqual(embed.description, "Sorry, I couldn't fetch player data right now. Please try again later.");
        });

        it("says when the ally code has no roster", async (t) => {
            const { description } = await show(t, {}, { player: { roster: undefined } });

            assert.strictEqual(description, "I could not find any player with that ally code, please double check that it's correct");
        });

        it("marks each equipped gear slot", async (t) => {
            const { description } = await show(
                t,
                {},
                {
                    roster: [
                        vader({
                            equipped: [
                                { equipmentId: 1, slot: 0 },
                                { equipmentId: 2, slot: 4 },
                            ],
                        }),
                    ],
                },
            );

            assert.ok(description.includes("Gear: 12\n   [X]  [  ]\n[  ]       [X]\n   [  ]  [  ]"), description);
        });

        it("labels each ability by type and how far it is upgraded", async (t) => {
            const skills = [
                { id: "uniqueskill_VADER01", nameKey: "Inspiring", tier: 9, tiers: 9, isOmicron: true },
                { id: "leaderskill_VADER", nameKey: "Inspiring Through Fear", tier: 8, tiers: 8, isZeta: true },
                { id: "specialskill_VADER01", nameKey: "Mass Choke", tier: 5, tiers: 8 },
                { id: "basicskill_VADER", nameKey: "Terrifying Swing", tier: 8, tiers: 8 },
                { id: "mysteryskill_VADER", nameKey: "Unknown Type", tier: 1, tiers: 8 },
            ];

            const { field } = await show(t, {}, { roster: [vader({ skills })] });

            assert.strictEqual(
                field("Abilities"),
                [
                    `\`Max ${OMEGA} [B]\` Terrifying Swing`,
                    "`Lvl 5 [S]` Mass Choke",
                    `\`Max ${ZETA_STAR} [L]\` Inspiring Through Fear`,
                    "`Max O [U]` Inspiring",
                ].join("\n"),
                "abilities come in basic, special, leader, unique order, and unknown types are left out",
            );
        });

        it("says when no abilities could be loaded", async (t) => {
            const { field } = await show(t, {}, { langChar: (c: any) => ({ ...c, skills: undefined }) });

            assert.strictEqual(field("Abilities"), "Couldn't find abilities");
        });

        it("errors when the unit has no stats, or no final stats", async (t) => {
            const noStats = await show(t, {}, { roster: [vader({ stats: undefined })] });
            const noFinal = await show(t, {}, { roster: [vader({ stats: { mods: {} } })] });

            assert.strictEqual(noStats.description, "Something went wrong. Please make sure you have that character unlocked");
            assert.strictEqual(noFinal.description, "Something went wrong, I couldn't get the stats for that character");
        });

        it("formats percentages, mod bonuses, and the fixed dodge chance", async (t) => {
            const stats = { final: { Speed: 300, Potency: 0.5, Health: 40000 }, mods: { Speed: 30, Potency: 0.1 }, gp: 25000 };

            const { field } = await show(t, {}, { roster: [vader({ stats })] });

            const statLines = field("Stats").split("\n");
            const line = (label: string) => (statLines.find((l) => l.startsWith(label)) ?? "").trimEnd();
            assert.match(line("Speed"), /:: 300 *\(30\)$/);
            assert.match(line("Potency"), /:: 50\.00% *\(10\.00%\)$/);
            assert.match(line("Health"), /:: 40,000$/);
            assert.match(line("Dodge"), /:: 2\.00%$/);
        });

        it("adds the player's roster warnings", async (t) => {
            const { field } = await show(t, {}, { player: { warnings: ["Roster is from cache", "Mods are stale"] } });

            assert.strictEqual(field("Warnings"), "Roster is from cache\nMods are stale");
        });

        it("attaches the unit image when the image server returns one", async (t) => {
            const { reply, embed } = await show(t, {}, { image: true });

            assert.deepStrictEqual(
                reply.files?.map((f: { name: string }) => f.name),
                ["image.png"],
            );
            assert.strictEqual(embed.thumbnail?.url, "attachment://image.png");
            assert.strictEqual(embed.author.name, "TestPlayer's Darth Vader");
        });

        it("falls back to the unit's avatar when there is no image", async (t) => {
            const { reply, embed } = await show(t, {}, { image: false });

            assert.strictEqual(reply.files, undefined);
            assert.strictEqual(embed.thumbnail, undefined);
            assert.ok(embed.author.icon_url, "expected the avatar URL as the author icon");
            assert.strictEqual(embed.author.name, "TestPlayer's Darth Vader");
        });

        it("shows a ship without gear or mod bonuses", async (t) => {
            const houndsTooth = createMockUnit({
                defId: "HOUNDSTOOTH",
                combatType: 2,
                level: 85,
                rarity: 7,
                gear: 1,
                gp: 50000,
                equipped: [],
                skills: [{ id: "basicskill_HOUNDSTOOTH", nameKey: "Big Shot", tier: 8, tiers: 8 } as any],
                stats: { final: { Speed: 150 } as any, mods: { Speed: 10 } as any, gp: 50000 },
            });

            const { description, field } = await show(
                t,
                { _subcommand: "ship", ship: "Hound's Tooth", character: undefined },
                { roster: [houndsTooth] },
            );

            assert.ok(!description.includes("Gear"), description);
            assert.strictEqual(field("Abilities"), "`Max [B]` Big Shot");
            const speed = field("Stats")
                .split("\n")
                .find((l) => l.startsWith("Speed"))
                ?.trimEnd();
            assert.match(speed ?? "", /:: 150$/);
        });
    });
});
