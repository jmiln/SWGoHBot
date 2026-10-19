import assert from "node:assert";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import type { MongoClient } from "mongodb";
import cache from "../../modules/cache.ts";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import swgohAPI, { SwapiUserError } from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import GuildSearch from "../../slash/guildsearch.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import {
    createCommandContext,
    createMockGuild,
    createMockGuildMember,
    createMockInteraction,
    createMockUnit,
    createRealLanguage,
} from "../mocks/index.ts";

const originalGuild = swgohAPI.guild;
const originalGuildUnitStats = swgohAPI.guildUnitStats;
const originalGetCharacter = swgohAPI.getCharacter;
const originalGetPlayerCooldown = patreonFuncs.getPlayerCooldown;

/** A mock guild member roster for a guild containing ally code 123456789 */
function makeMockGuild() {
    return createMockGuild({
        name: "Test Guild",
        roster: [createMockGuildMember({ allyCode: 123456789 })],
    });
}

/** A mock guildUnitStats result - one player who has Darth Vader */
function makeMockGuildChar(overrides: Record<string, any> = {}) {
    return [
        {
            ...createMockUnit({ defId: "DARTHVADER", nameKey: "Darth Vader", combatType: 1, gear: 13, rarity: 7, gp: 28000 }),
            player: "GuildMember1",
            stats: { final: { Speed: 200 } },
            zetas: [],
            ...overrides,
        },
    ];
}

/** A minimal RawCharacter stub with no zeta/omicron abilities */
const mockRawChar = { skillReferenceList: [] } as any;

/**
 * Helper function to extract description from a reply embed.
 */
function getReplyDescription(reply: any): string | undefined {
    return reply?.embeds?.[0]?.data?.description || reply?.embeds?.[0]?.description;
}

describe("GuildSearch Command Functionality", () => {
    let mongoClient: MongoClient;

    before(async () => {
        mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        // No users cleanup: this file never writes to the users collection, and a
        // wholesale deleteMany races concurrent test files that do
        await closeMongoClient();
    });

    describe("command initialization", () => {
        it("should initialize with correct name and subcommands", () => {
            const command = new GuildSearch();

            assert.strictEqual(command.commandData.name, "guildsearch");
            assert.strictEqual(command.commandData.options.length, 2);

            const characterSubcmd = command.commandData.options.find((o) => o.name === "character");
            const shipSubcmd = command.commandData.options.find((o) => o.name === "ship");

            assert.ok(characterSubcmd, "Expected character subcommand");
            assert.ok(shipSubcmd, "Expected ship subcommand");
        });
    });

    describe("ally code validation", () => {
        it("should return error when no ally code is registered and none provided", async () => {
            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.strictEqual(replies.length, 1, "Expected one reply");
            const description = getReplyDescription(replies[0]);
            assert.ok(description?.includes("BASE_INVALID_ALLY_CODE"), "Expected error about no ally code");
        });
    });

    describe("input validation", () => {
        it("should reject invalid top values above maximum with specific error message", async () => {
            const command = new GuildSearch();

            const invalidTop = 100;
            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    top: invalidTop, // Invalid: max is 50
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);
            assert.ok(description?.includes("COMMAND_GUILDSEARCH_INVALID_TOP"), "Expected error about invalid top value");
        });

        it("should reject invalid top values below minimum with specific error message", async () => {
            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    top: -5, // Invalid: min is 0
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);
            assert.ok(description?.includes("COMMAND_GUILDSEARCH_INVALID_TOP"), "Expected error about invalid top value");
        });

        it("should reject invalid rarity values with specific error message", async () => {
            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    rarity: 10, // Invalid: max is 7
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);
            assert.ok(description && description.length > 0, "Expected error about invalid rarity value");
            // The error message should reference "star" since that's what rarity represents
            assert.ok(
                description?.toLowerCase().includes("star") || description?.toLowerCase().includes("rarity"),
                "Expected error to mention stars or rarity",
            );
        });

        it("should accept valid top values", async () => {
            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    top: 25, // Valid: within 1-50 range
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const description = getReplyDescription(lastReply);
            // Should NOT have the "COMMAND_GUILDSEARCH_INVALID_TOP" error
            assert.ok(!description?.includes("COMMAND_GUILDSEARCH_INVALID_TOP"), "Should not error on valid top value");
        });

        it("should accept valid rarity values", async () => {
            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                    allycode: "123456789",
                    rarity: 7, // Valid: within 0-7 range
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            // Should proceed to API call (which will fail, but that's expected)
            assert.ok(replies.length > 0, "Should attempt to proceed with valid rarity");
        });
    });

    describe("character/ship lookup", () => {
        it("should return specific error message for non-existent character", async () => {
            const command = new GuildSearch();

            const searchTerm = "NONEXISTENTCHARACTER12345";
            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: searchTerm,
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];

            assert.ok(lastReply.embeds && lastReply.embeds.length > 0, "Expected error embed for non-existent character");
            const description = getReplyDescription(lastReply);
            assert.ok(description && description.length > 0, "Expected error description for non-existent character");
        });

        it("should return specific error message for non-existent ship", async () => {
            const command = new GuildSearch();

            const searchTerm = "NONEXISTENTSHIP9999";
            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "ship",
                    ship: searchTerm,
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];

            assert.ok(lastReply.embeds && lastReply.embeds.length > 0, "Expected error embed for non-existent ship");
            const description = getReplyDescription(lastReply);
            assert.ok(description && description.length > 0, "Expected error description for non-existent ship");
        });

        it("should list all matching characters for ambiguous search", async () => {
            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Luke", // Matches multiple characters
                    allycode: "123456789",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected at least one reply");

            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds && lastReply.embeds.length > 0, "Expected error embed for ambiguous search");

            const description = getReplyDescription(lastReply);
            // Should list the matching characters
            assert.ok(description && description.length > 0, "Expected list of matching characters");
        });
    });

    describe("character name matching", () => {
        beforeEach(() => {
            swgohAPI.guild = async () => makeMockGuild() as any;
            swgohAPI.guildUnitStats = async () => makeMockGuildChar() as any;
            swgohAPI.getCharacter = async () => mockRawChar;
            patreonFuncs.getPlayerCooldown = async () => ({ player: 60000, guild: 3600000 }) as any;
        });

        afterEach(() => {
            swgohAPI.guild = originalGuild;
            swgohAPI.guildUnitStats = originalGuildUnitStats;
            swgohAPI.getCharacter = originalGetCharacter;
            patreonFuncs.getPlayerCooldown = originalGetPlayerCooldown;
        });

        it("should find character by exact name and return guild results with member data", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed in final reply");
            const embed = lastReply.embeds[0];
            const embedData = embed.data || embed;
            // Language mock returns the key; verify the right display key is used
            assert.ok(
                embedData.author?.name?.includes("BASE_SWGOH_NAMECHAR_HEADER_NUM"),
                "Expected results header language key in embed author",
            );
            // Guild member player name should appear in the field values
            assert.ok(
                embedData.fields?.some((f: any) => f.value?.includes("GuildMember1")),
                "Expected guild member name in results",
            );
        });

        it("should find character by partial name match and return same result as exact match", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "vader", allycode: "123456789" },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed - partial 'vader' should resolve to Darth Vader");
            const embedData = lastReply.embeds[0].data || lastReply.embeds[0];
            assert.ok(!lastReply.flags, "Expected non-error response - partial match should succeed");
            assert.ok(
                embedData.fields?.some((f: any) => f.value?.includes("GuildMember1")),
                "Expected guild member in partial match result",
            );
        });

        it("should be case-insensitive: 'DARTH VADER' resolves the same as 'Darth Vader'", async () => {
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "DARTH VADER", allycode: "123456789" },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed - uppercase search should resolve");
            assert.ok(!lastReply.flags, "Expected non-error response - case-insensitive match should succeed");
        });
    });

    describe("subcommand routing", () => {
        it("should handle character subcommand", async () => {
            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "character",
                    character: "Darth Vader",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected reply from character subcommand");
        });

        it("should handle ship subcommand", async () => {
            const command = new GuildSearch();

            const interaction = createMockInteraction({
                optionsData: {
                    _subcommand: "ship",
                    ship: "Hound's Tooth",
                },
            });

            const ctx = createCommandContext({ interaction });
            await command.run(ctx);

            const replies = (interaction as any)._getReplies();
            assert.ok(replies.length > 0, "Expected reply from ship subcommand");
        });
    });

    describe("option effects", () => {
        beforeEach(() => {
            swgohAPI.guild = async () => makeMockGuild() as any;
            swgohAPI.getCharacter = async () => mockRawChar;
            patreonFuncs.getPlayerCooldown = async () => ({ player: 60000, guild: 3600000 }) as any;
        });

        afterEach(() => {
            swgohAPI.guild = originalGuild;
            swgohAPI.guildUnitStats = originalGuildUnitStats;
            swgohAPI.getCharacter = originalGetCharacter;
            patreonFuncs.getPlayerCooldown = originalGetPlayerCooldown;
        });

        it("rarity filter: shows members at or above the specified star level", async () => {
            // Two members: one at 7*, one at 4*
            swgohAPI.guildUnitStats = async () =>
                [
                    { ...createMockUnit({ rarity: 7, gp: 28000 }), player: "SevenStar", zetas: [] },
                    { ...createMockUnit({ rarity: 4, gp: 10000 }), player: "FourStar", zetas: [] },
                ] as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", rarity: 7 },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const fields = lastReply.embeds?.[0]?.fields ?? lastReply.embeds?.[0]?.data?.fields ?? [];
            const content = fields.map((f: any) => f.value ?? "").join(" ");
            assert.ok(content.includes("SevenStar"), "Expected 7-star member in results");
            assert.ok(!content.includes("FourStar"), "Expected 4-star member to be filtered out");
        });

        // Discord shows <t:...> raw in an embed footer; only descriptions, field values and content render it
        it("puts the no-matches error's last-updated timestamp where Discord renders it, not in the footer", async () => {
            const updatedAt = new Date("2026-10-05T12:00:00.000Z");
            swgohAPI.guild = async () =>
                createMockGuild({ name: "Test Guild", roster: [createMockGuildMember({ allyCode: 123456789 })], updatedAt }) as any;
            swgohAPI.guildUnitStats = async () => [{ ...createMockUnit({ rarity: 4, gp: 10000 }), player: "FourStar", zetas: [] }] as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", rarity: 7 },
            });
            await new GuildSearch().run(createCommandContext({ interaction, language: createRealLanguage() }));

            const replies = (interaction as any)._getReplies();
            const embedData = replies[replies.length - 1].embeds[0].data;
            const stamp = `<t:${Math.floor(updatedAt.getTime() / 1000)}>`;
            assert.ok(
                embedData.description?.endsWith(`\n\nLast updated ${stamp}`),
                `Expected the timestamp in the description after a blank line, got ${JSON.stringify(embedData.description)}`,
            );
            assert.strictEqual(embedData.footer, undefined, `Expected no footer, got ${JSON.stringify(embedData.footer)}`);
        });

        it("rarity filter: returns error when no members meet the minimum star level", async () => {
            swgohAPI.guildUnitStats = async () => [{ ...createMockUnit({ rarity: 4, gp: 10000 }), player: "FourStar", zetas: [] }] as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", rarity: 7 },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected error embed when no members meet rarity filter");
            assert.ok(lastReply.flags, "Expected error to be ephemeral");
        });

        it("zetas filter: returns error when no members have zetas on the character", async () => {
            swgohAPI.guildUnitStats = async () =>
                [{ ...createMockUnit({ rarity: 7, gp: 28000 }), player: "NoZetaPlayer", zetas: [] }] as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", zetas: true },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.flags, "Expected ephemeral error when zetas filter finds no results");
        });

        it("stat option: shows stat values for each guild member in the output", async () => {
            swgohAPI.guildUnitStats = async () =>
                [
                    { ...createMockUnit({ rarity: 7, gp: 28000 }), player: "SpeedyPlayer", stats: { final: { Speed: 214 } }, zetas: [] },
                ] as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", stat: "Speed" },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            const fields = lastReply.embeds?.[0]?.fields ?? lastReply.embeds?.[0]?.data?.fields ?? [];
            const content = fields.map((f: any) => f.value ?? "").join(" ");
            assert.ok(content.includes("SpeedyPlayer"), "Expected player name in stat output");
            assert.ok(content.includes("214"), "Expected speed value 214 in stat output");
        });

        it("sort by GP: returns results without error when sort=gp is specified", async () => {
            swgohAPI.guildUnitStats = async () => makeMockGuildChar() as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", sort: "gp" },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed with sort=gp");
            assert.ok(!lastReply.flags, "Expected non-error response with sort=gp");
        });

        it("top option: returns results without error when top=5 is specified", async () => {
            swgohAPI.guildUnitStats = async () => makeMockGuildChar() as any;

            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", top: 5 },
            });
            await new GuildSearch().run(createCommandContext({ interaction }));

            const replies = (interaction as any)._getReplies();
            const lastReply = replies[replies.length - 1];
            assert.ok(lastReply.embeds?.length > 0, "Expected embed with top=5");
            assert.ok(!lastReply.flags, "Expected non-error response with top=5");
        });
    });

    describe("output", () => {
        afterEach(() => {
            swgohAPI.guild = originalGuild;
            swgohAPI.guildUnitStats = originalGuildUnitStats;
            swgohAPI.getCharacter = originalGetCharacter;
            patreonFuncs.getPlayerCooldown = originalGetPlayerCooldown;
        });

        const member = (player: string, overrides: Record<string, any> = {}) => ({
            ...createMockUnit({ rarity: 7, gp: 20000 }),
            player,
            omicrons: [],
            updatedAt: new Date("2026-10-01T00:00:00.000Z"),
            ...overrides,
        });

        // A maxed skill: guildsearch counts a zeta as tier === tiers
        const maxedSkill = (id: string, flags: Record<string, boolean>) => ({ id, tier: 8, tiers: 8, ...flags });

        async function search(
            options: Record<string, unknown>,
            { units, rawChar = mockRawChar, guild = makeMockGuild() }: { units: any[]; rawChar?: any; guild?: any },
        ) {
            swgohAPI.guild = async () => guild;
            swgohAPI.guildUnitStats = async () => units;
            swgohAPI.getCharacter = async () => rawChar;
            patreonFuncs.getPlayerCooldown = async () => ({ player: 60000, guild: 3600000 }) as any;
            const interaction = createMockInteraction({
                optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", ...options },
            });
            await new GuildSearch().run(createCommandContext({ interaction, language: createRealLanguage() }));
            const replies = (interaction as any)._getReplies();
            const reply = replies[replies.length - 1];
            const embed = reply.embeds?.[0]?.data ?? reply.embeds?.[0];
            const fields: { name: string; value: string }[] = (embed?.fields ?? []).map((f: any) => ({
                name: f.name,
                value: f.value.replaceAll("​", ""),
            }));
            return { reply, embed, fields, interaction };
        }

        const order = (text: string, names: string[]) => names.map((n) => text.indexOf(n));
        const isAscending = (nums: number[]) => nums.every((n, ix) => n >= 0 && (ix === 0 || n > nums[ix - 1]));

        describe("roster", () => {
            it("groups by star level and sorts by name, case-insensitively, by default", async () => {
                const { embed, fields } = await search(
                    {},
                    { units: [member("bob"), member("Alice"), member("carl", { rarity: 5 }), member("dan", { rarity: 0, gear: 0 })] },
                );

                assert.strictEqual(embed.author.name, "Test Guild's Darth Vader (3)", "the count is unlocked members only");
                assert.deepStrictEqual(
                    fields.map((f) => f.name),
                    ["Not Activated (1)", "5 Star (1)", "7 Star (2)", "​"],
                );
                assert.ok(isAscending(order(fields[2].value, ["Alice", "bob"])), fields[2].value);
                assert.strictEqual(fields[0].value, "dan");
            });

            it("sorts by gp when top is given and keeps the highest", async () => {
                const units = [member("low", { gp: 100 }), member("high", { gp: 300 }), member("mid", { gp: 200 })];

                const { fields } = await search({ top: 2 }, { units });

                assert.ok(isAscending(order(fields[0].value, ["mid", "high"])), fields[0].value);
                assert.ok(!fields[0].value.includes("low"), fields[0].value);
            });

            it("keeps the lowest and lists them highest first when reversed", async () => {
                const units = [member("low", { gp: 100 }), member("high", { gp: 300 }), member("mid", { gp: 200 })];

                const { fields } = await search({ top: 2, reverse: true }, { units });

                assert.ok(isAscending(order(fields[0].value, ["mid", "low"])), fields[0].value);
                assert.ok(!fields[0].value.includes("high"), fields[0].value);
            });

            it("lists star groups highest first when reversed", async () => {
                const { fields } = await search({ reverse: true }, { units: [member("seven"), member("five", { rarity: 5 })] });

                assert.deepStrictEqual(fields.map((f) => f.name).slice(0, 2), ["7 Star (1)", "5 Star (1)"]);
            });

            it("sorts by gear, breaking ties on equipped pieces", async () => {
                const units = [
                    member("g13", { gear: 13, relic: { currentTier: 0 } }),
                    member("g12plus2", { gear: 12, equipped: [{}, {}], relic: { currentTier: 0 } }),
                    member("g12plus1", { gear: 12, equipped: [{}], relic: { currentTier: 0 } }),
                ];

                const { fields } = await search({ sort: "gear" }, { units });

                assert.ok(isAscending(order(fields[0].value, ["g12plus1", "g12plus2", "g13"])), fields[0].value);
                assert.ok(fields[0].value.includes("12+2"), fields[0].value);
            });

            it("marks each zeta and omicron by its position, plus ultimates", async () => {
                const rawChar = {
                    skillReferenceList: [
                        { skillId: "zA", isZeta: true },
                        { skillId: "zB", isZeta: true },
                        { skillId: "oC", isOmicron: true },
                    ],
                };
                const units = [
                    member("zetaB", { gp: 1000, skills: [maxedSkill("zB", { isZeta: true })], omicrons: [{ id: "oC" }] }),
                    member("ult", { gp: 2000, purchasedAbilityId: ["ULT"] }),
                ];

                const { fields } = await search({ sort: "gp" }, { units, rawChar });

                const [zetaRow, ultRow] = fields[0].value.split("\n");
                assert.ok(zetaRow.includes("1,000 |   21]"), zetaRow);
                assert.ok(ultRow.includes("2,000 | u   ]"), ultRow);
            });

            it("shows only members with omicrons, and says so", async () => {
                const units = [member("withO", { omicrons: [{ id: "oC" }] }), member("withoutO")];

                const { embed, fields } = await search({ omicrons: true }, { units });

                assert.strictEqual(embed.description, "Showing characters with Omicron(s)");
                assert.ok(fields[0].value.includes("withO") && !fields[0].value.includes("withoutO"), fields[0].value);
            });

            it("shows only members with both when zetas and omicrons are set", async () => {
                const units = [
                    member("both", { skills: [maxedSkill("zA", { isZeta: true })], omicrons: [{ id: "oC" }] }),
                    member("zetaOnly", { skills: [maxedSkill("zA", { isZeta: true })] }),
                ];

                const { embed, fields } = await search({ zetas: true, omicrons: true }, { units });

                assert.strictEqual(embed.description, "Showing characters with both Zeta(s) & Omicron(s)");
                assert.ok(fields[0].value.includes("both"), fields[0].value);
            });

            it("describes a zetas-only search", async () => {
                const { embed } = await search({ zetas: true }, { units: [member("z", { skills: [maxedSkill("zA", { isZeta: true })] })] });

                assert.strictEqual(embed.description, "Showing characters with Zeta(s)");
            });

            it("adds the roster warnings, trimmed to fit a field", async () => {
                const guild = createMockGuild({
                    name: "Test Guild",
                    roster: [createMockGuildMember({ allyCode: 123456789 })],
                    warnings: ["w".repeat(1100)],
                } as any);

                const { fields } = await search({}, { units: [member("a")], guild });

                const warnings = fields.find((f) => f.name === "Guild Roster Warnings");
                assert.strictEqual(warnings?.value, `${"w".repeat(1000)}...`);
            });

            it("reports a failed ability lookup", async () => {
                swgohAPI.getCharacter = async () => {
                    throw new Error("no abilities");
                };

                const interaction = createMockInteraction({
                    optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
                });
                swgohAPI.guild = async () => makeMockGuild() as any;
                swgohAPI.guildUnitStats = async () => [member("a")] as any;
                patreonFuncs.getPlayerCooldown = async () => ({ player: 60000, guild: 3600000 }) as any;
                await new GuildSearch().run(createCommandContext({ interaction, language: createRealLanguage() }));

                assert.ok(
                    getReplyDescription((interaction as any)._getReplies().at(-1))?.includes(
                        "Couldn't get the character - Error: no abilities",
                    ),
                );
            });

            it("shows ship rows by level", async () => {
                swgohAPI.guild = async () => makeMockGuild() as any;
                swgohAPI.guildUnitStats = async () => [member("pilot", { level: 85, gp: 50000 })] as any;
                swgohAPI.getCharacter = async () => mockRawChar;
                patreonFuncs.getPlayerCooldown = async () => ({ player: 60000, guild: 3600000 }) as any;
                const interaction = createMockInteraction({
                    optionsData: { _subcommand: "ship", ship: "Hound's Tooth", allycode: "123456789" },
                });

                await new GuildSearch().run(createCommandContext({ interaction, language: createRealLanguage() }));

                const embed = (interaction as any)._getReplies().at(-1).embeds[0];
                assert.ok(embed.fields[0].value.replaceAll("​", "").includes("[Lvl 85 | 50,000]"), embed.fields[0].value);
            });
        });

        describe("no matching members", () => {
            for (const [label, options, units, expected] of [
                ["character", {}, [], "no one in your guild has this character unlocked."],
                ["character at a star level", { rarity: 7 }, [member("four", { rarity: 4 })], "this character unlocked at 7* or higher"],
                ["zetas", { zetas: true }, [member("none")], "applied any zetas"],
            ] as const) {
                it(`explains an empty ${label} search`, async () => {
                    const { reply } = await search(options, { units: [...units] });

                    assert.ok(getReplyDescription(reply)?.includes(expected), getReplyDescription(reply));
                });
            }

            for (const [label, options, expected] of [
                ["ship", {}, "no one in your guild has this ship unlocked."],
                ["ship at a star level", { rarity: 7 }, "this ship unlocked at 7* or higher"],
            ] as const) {
                it(`explains an empty ${label} search`, async () => {
                    swgohAPI.guild = async () => makeMockGuild() as any;
                    swgohAPI.guildUnitStats = async () => (options.rarity ? [member("four", { rarity: 4 })] : []) as any;
                    swgohAPI.getCharacter = async () => mockRawChar;
                    patreonFuncs.getPlayerCooldown = async () => ({ player: 60000, guild: 3600000 }) as any;
                    const interaction = createMockInteraction({
                        optionsData: { _subcommand: "ship", ship: "Hound's Tooth", allycode: "123456789", ...options },
                    });

                    await new GuildSearch().run(createCommandContext({ interaction, language: createRealLanguage() }));

                    const description = getReplyDescription((interaction as any)._getReplies().at(-1));
                    assert.ok(description?.includes(expected), description);
                });
            }
        });

        describe("fetch failures", () => {
            async function failingSearch(setup: () => void) {
                swgohAPI.guild = async () => makeMockGuild() as any;
                swgohAPI.guildUnitStats = async () => [member("a")] as any;
                swgohAPI.getCharacter = async () => mockRawChar;
                patreonFuncs.getPlayerCooldown = async () => ({ player: 60000, guild: 3600000 }) as any;
                setup();
                const interaction = createMockInteraction({
                    optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789" },
                });
                await new GuildSearch().run(createCommandContext({ interaction, language: createRealLanguage() }));
                const reply = (interaction as any)._getReplies().at(-1);
                return { reply, description: getReplyDescription(reply) ?? reply.content };
            }

            it("says when the player is not in a guild", async () => {
                const { description } = await failingSearch(() => {
                    swgohAPI.guild = async () => {
                        throw new Error("player is not in a guild");
                    };
                });

                assert.strictEqual(description, "Sorry, but it looks like that player is not in a guild");
            });

            it("passes a user-facing API error through and hides any other", async () => {
                const userError = await failingSearch(() => {
                    swgohAPI.guild = async () => {
                        throw new SwapiUserError("That ally code is not valid");
                    };
                });
                const otherError = await failingSearch(() => {
                    swgohAPI.guild = async () => {
                        throw new Error("socket hang up");
                    };
                });

                assert.strictEqual(userError.description, "That ally code is not valid");
                assert.strictEqual(
                    otherError.description,
                    "Sorry, I couldn't fetch that guild's data right now. Please try again in a bit.",
                );
            });

            it("says when the guild has no members", async () => {
                const { description } = await failingSearch(() => {
                    swgohAPI.guild = async () => createMockGuild({ name: "Empty", roster: [] }) as any;
                });

                assert.ok(description.startsWith("I cannot find any users for that guild."), description);
            });

            it("reports a failed unit lookup", async () => {
                const { reply, description } = await failingSearch(() => {
                    swgohAPI.guildUnitStats = async () => {
                        throw new Error("timeout");
                    };
                });

                assert.strictEqual(
                    description,
                    "Sorry, I couldn't fetch that guild's data right now. Please try again in a bit.\n\nPlease try again in a bit",
                );
                assert.strictEqual(
                    (reply.embeds[0].data ?? reply.embeds[0]).author?.name,
                    "Something Broke while getting your guild's characters",
                );
            });
        });

        describe("stat", () => {
            it("lists members by the stat, highest first, with percentages for fractional stats", async () => {
                const units = [
                    member("slow", { gp: 1000, stats: { final: { Speed: 150, Potency: 0.5 } } }),
                    member("fast", { gp: 2000, stats: { final: { Speed: 300, Potency: 0.75 } } }),
                    member("locked", { gp: 0, stats: { final: { Speed: 999 } } }),
                ];

                const { fields } = await search({ stat: "Potency" }, { units });

                assert.strictEqual(fields[0].name, "Darth Vader (Sorted by Potency)");
                assert.ok(isAscending(order(fields[0].value, ["fast", "slow"])), fields[0].value);
                assert.ok(fields[0].value.includes("75.00%") && fields[0].value.includes("50.00%"), fields[0].value);
                assert.ok(!fields[0].value.includes("locked"), "members without gp are left out");
            });

            it("keeps the lowest, lowest first, when reversed with top", async () => {
                const units = [100, 300, 200].map((speed) => member(`spd${speed}`, { gp: speed, stats: { final: { Speed: speed } } }));

                const { fields } = await search({ stat: "Speed", top: 2, reverse: true }, { units });

                assert.strictEqual(fields[0].name, "Darth Vader (Sorted by lowest Speed first)");
                assert.ok(isAscending(order(fields[0].value, ["spd100", "spd200"])), fields[0].value);
                assert.ok(!fields[0].value.includes("spd300"), fields[0].value);
            });

            it("says when no member has the character", async () => {
                const { fields } = await search({ stat: "Speed" }, { units: [member("locked", { gp: 0 })] });

                assert.deepStrictEqual(fields[0], {
                    name: "Darth Vader",
                    value: "It seems that no one in your guild has this character unlocked.",
                });
            });

            it("falls back to posting in the channel when the reply edit fails", async () => {
                swgohAPI.guild = async () => makeMockGuild() as any;
                swgohAPI.guildUnitStats = async () => [member("a", { stats: { final: { Speed: 100 } } })] as any;
                swgohAPI.getCharacter = async () => mockRawChar;
                patreonFuncs.getPlayerCooldown = async () => ({ player: 60000, guild: 3600000 }) as any;
                const sent: any[] = [];
                const interaction = createMockInteraction({
                    optionsData: { _subcommand: "character", character: "Darth Vader", allycode: "123456789", stat: "Speed" },
                });
                let edits = 0;
                const originalEdit = interaction.editReply.bind(interaction);
                (interaction as any).editReply = async (data: any) => {
                    edits++;
                    if (data.embeds) throw new Error("Unknown Message");
                    return originalEdit(data);
                };
                (interaction as any).channel = { isSendable: () => true, send: async (m: any) => sent.push(m) };

                await new GuildSearch().run(createCommandContext({ interaction, language: createRealLanguage() }));

                assert.ok(edits >= 1);
                assert.strictEqual(sent.length, 1);
                assert.strictEqual(sent[0].embeds[0].author.name, "Test Guild");
            });
        });
    });
});
