import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { Collection } from "discord.js";
import { env } from "../../config/config.ts";
import constants from "../../data/constants/constants.ts";
import arenaPlayerRegistry from "../../modules/arenaPlayerRegistry.ts";
import cache from "../../modules/cache.ts";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import swgohAPI from "../../modules/swapi.ts";
import userReg from "../../modules/users.ts";
import UserConf from "../../slash/userconf.ts";
import type { UserConfig } from "../../types/types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createRealLanguage } from "../mocks/index.ts";
import { createMockPlayer, MockSWAPI } from "../mocks/mockSwapi.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

const testDbName = env.MONGODB_SWGOHBOT_DB;

// File-unique keys: the users and arenaPlayers collections are shared with concurrently running test files
const UC_USER = { id: "userconf-test-user", username: "UcTester" } as any;
const AC_A = 744111111;
const AC_B = 744222222;
const AC_C = 744333333;
const USER_FILTER = { id: UC_USER.id };
const PLAYER_FILTER = { allyCode: { $gte: 744000000, $lt: 745000000 } };

async function clearTestDocs() {
    const client = await getMongoClient();
    await client.db(testDbName).collection("users").deleteMany(USER_FILTER);
    await client.db(testDbName).collection("arenaPlayers").deleteMany(PLAYER_FILTER);
}

async function seedUser(overrides: Partial<UserConfig>) {
    const base = structuredClone(constants.defaultUserConf) as unknown as UserConfig;
    await userReg.updateUser(UC_USER.id, { ...base, id: UC_USER.id, ...overrides } as UserConfig);
}

function createViewClient() {
    return {
        users: { fetch: async () => ({ username: UC_USER.username }) },
        guilds: { cache: new Collection([["userconf-bonus-guild", { name: "Bonus Guild" }]]) },
    } as any;
}

async function runUserConf(optionsData: Record<string, unknown>, client?: any) {
    const interaction = createMockInteraction({ user: UC_USER, optionsData, ...(client ? { client } : {}) });
    const ctx = createCommandContext({ interaction, language: createRealLanguage() });
    await new UserConf().run(ctx);
    return interaction;
}

function lastEmbed(interaction: any) {
    const embed = getLastReply(interaction).embeds[0];
    return embed.data ?? embed;
}

function viewFields(interaction: any): { name: string; value: string }[] {
    return lastEmbed(interaction).fields;
}

describe("UserConf", () => {
    let mockSwapi: MockSWAPI;

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
        arenaPlayerRegistry.init(cache);
    });

    beforeEach(async () => {
        mockSwapi = new MockSWAPI();
        (swgohAPI as any).unitStats = mockSwapi.unitStats.bind(mockSwapi);
        (patreonFuncs as any).getPlayerCooldown = async () => ({ player: 180, guild: 360 });
        (patreonFuncs as any).getPatronUser = async () => null;
        await clearTestDocs();
    });

    after(async () => {
        await clearTestDocs();
        await closeMongoClient();
    });

    it("should initialize with correct name", () => {
        const command = new UserConf();
        assert.strictEqual(command.commandData.name, "userconf");
    });

    it("should have allycodes subcommand group with add, remove, make_primary", () => {
        const command = new UserConf();
        const allycodesGroup = command.commandData.options.find((o: any) => o.name === "allycodes");
        assert.ok(allycodesGroup, "Expected allycodes subcommand group");
        const subNames = allycodesGroup.options.map((o: any) => o.name);
        assert.ok(subNames.includes("add"), "Expected add subcommand");
        assert.ok(subNames.includes("remove"), "Expected remove subcommand");
        assert.ok(subNames.includes("make_primary"), "Expected make_primary subcommand");
    });

    it("should have lang and view subcommands but not arenaalert", () => {
        const command = new UserConf();
        const optionNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(!optionNames.includes("arenaalert"), "arenaalert moved to /arenaalert command");
        assert.ok(optionNames.includes("lang"), "Expected lang subcommand");
        assert.ok(optionNames.includes("view"), "Expected view subcommand");
    });

    it("should return error when ally code format is invalid", async () => {
        // patreonFuncs.getPlayerCooldown + userReg.getUser run first (MongoDB), then isAllyCode check
        const interaction = createMockInteraction({
            optionsData: { _subcommandGroup: "allycodes", _subcommand: "add", allycode: "not-a-code" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new UserConf();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_INVALID_ALLY_CODE_AC");
    });

    describe("allycodes add", () => {
        const addOptions = (allycode: string) => ({ _subcommandGroup: "allycodes", _subcommand: "add", allycode });

        it("registers a first code as primary and records the player's name", async () => {
            mockSwapi.setPlayerData(
                createMockPlayer({
                    allyCode: AC_A,
                    name: "AddedPlayer",
                    stats: [{ nameKey: "STAT_GALACTIC_POWER_ACQUIRED_NAME", value: 5000000 }],
                }),
            );

            const interaction = await runUserConf(addOptions("744-111-111"));

            const user = await userReg.getUser(UC_USER.id);
            assert.deepStrictEqual(user?.accounts, [AC_A], "dashed input should be stored as the bare number");
            assert.strictEqual(user?.primaryAllyCode, AC_A);
            assert.strictEqual((await arenaPlayerRegistry.getPlayer(AC_A))?.name, "AddedPlayer");
            assert.ok(interaction.deferred, "must defer before the API lookup");
            const embed = lastEmbed(interaction);
            assert.strictEqual(embed.author?.name, "Registration for AddedPlayer successful!");
            assert.ok(embed.description.includes("744-111-111"), `expected formatted code, got: ${embed.description}`);
            assert.ok(embed.description.includes("5,000,000"), `expected GP, got: ${embed.description}`);
        });

        it("keeps the existing primary when adding another code", async () => {
            await seedUser({ accounts: [AC_A], primaryAllyCode: AC_A });
            mockSwapi.setPlayerData(createMockPlayer({ allyCode: AC_B, name: "SecondPlayer" }));

            await runUserConf(addOptions(String(AC_B)));

            const user = await userReg.getUser(UC_USER.id);
            assert.deepStrictEqual(user?.accounts, [AC_A, AC_B]);
            assert.strictEqual(user?.primaryAllyCode, AC_A);
        });

        it("rejects a code that is already registered", async () => {
            await seedUser({ accounts: [AC_A], primaryAllyCode: AC_A });

            const interaction = await runUserConf(addOptions(String(AC_A)));

            assertErrorReply(interaction, "You already have this ally code registered");
        });

        it("rejects an eleventh code", async () => {
            const tenCodes = Array.from({ length: 10 }, (_, ix) => 744000001 + ix);
            await seedUser({ accounts: tenCodes, primaryAllyCode: tenCodes[0] });

            const interaction = await runUserConf(addOptions(String(AC_A)));

            assertErrorReply(interaction, "cannot have more than 10 accounts");
            assert.deepStrictEqual((await userReg.getUser(UC_USER.id))?.accounts, tenCodes);
        });

        it("reports a registration failure and saves nothing when no player is found", async () => {
            const interaction = await runUserConf(addOptions(String(AC_A)));

            assertErrorReply(interaction, "Registration failed");
            assert.strictEqual(await userReg.getUser(UC_USER.id), null);
        });

        it("reports the API error and saves nothing when the lookup throws", async () => {
            (swgohAPI as any).unitStats = async () => {
                throw new Error("comlink unavailable");
            };

            const interaction = await runUserConf(addOptions(String(AC_A)));

            assertErrorReply(interaction, "Something broke");
            assertErrorReply(interaction, "comlink unavailable");
            assert.strictEqual(await userReg.getUser(UC_USER.id), null);
        });
    });

    describe("allycodes remove", () => {
        const removeOptions = (allycode: number) => ({ _subcommandGroup: "allycodes", _subcommand: "remove", allycode: String(allycode) });

        it("rejects a code that is not registered", async () => {
            await seedUser({ accounts: [AC_A], primaryAllyCode: AC_A });

            const interaction = await runUserConf(removeOptions(AC_B));

            assertErrorReply(interaction, "You do not have this ally code registered");
        });

        it("removes the primary code, promotes the next one, and names the removed player", async () => {
            await seedUser({ accounts: [AC_A, AC_B], primaryAllyCode: AC_A });
            await arenaPlayerRegistry.upsertPlayer({ allyCode: AC_A, name: "LeavingPlayer" });

            const interaction = await runUserConf(removeOptions(AC_A));

            const user = await userReg.getUser(UC_USER.id);
            assert.deepStrictEqual(user?.accounts, [AC_B]);
            assert.strictEqual(user?.primaryAllyCode, AC_B);
            assert.strictEqual(lastEmbed(interaction).description, `Removed LeavingPlayer (${AC_A}) from your config`);
        });

        it("names the removed code by its number when no player name is stored", async () => {
            await seedUser({ accounts: [AC_A], primaryAllyCode: AC_A });

            const interaction = await runUserConf(removeOptions(AC_A));

            assert.strictEqual(lastEmbed(interaction).description, `Removed ${AC_A} (${AC_A}) from your config`);
        });
    });

    describe("allycodes make_primary", () => {
        const primaryOptions = (allycode: number) => ({
            _subcommandGroup: "allycodes",
            _subcommand: "make_primary",
            allycode: String(allycode),
        });

        it("rejects a code that is not registered", async () => {
            await seedUser({ accounts: [AC_A], primaryAllyCode: AC_A });

            const interaction = await runUserConf(primaryOptions(AC_B));

            assertErrorReply(interaction, "You do not have this ally code registered");
        });

        it("rejects a code that is already primary", async () => {
            await seedUser({ accounts: [AC_A, AC_B], primaryAllyCode: AC_A });

            const interaction = await runUserConf(primaryOptions(AC_A));

            assertErrorReply(interaction, "already marked as the primary");
        });

        it("switches the primary and names both players", async () => {
            await seedUser({ accounts: [AC_A, AC_B], primaryAllyCode: AC_A });
            await arenaPlayerRegistry.upsertPlayer({ allyCode: AC_A, name: "OldMain" });
            await arenaPlayerRegistry.upsertPlayer({ allyCode: AC_B, name: "NewMain" });

            const interaction = await runUserConf(primaryOptions(AC_B));

            assert.strictEqual((await userReg.getUser(UC_USER.id))?.primaryAllyCode, AC_B);
            assert.strictEqual(
                lastEmbed(interaction).description,
                `Changed your primary from **OldMain** (${AC_A}) to **NewMain** (${AC_B})`,
            );
        });
    });

    describe("lang", () => {
        it("saves both languages and lists each change", async () => {
            const interaction = await runUserConf({ _subcommand: "lang", bot_language: "de_DE", swgoh_language: "ger_de" });

            const user = await userReg.getUser(UC_USER.id);
            assert.strictEqual(user?.lang?.language, "de_DE");
            assert.strictEqual(user?.lang?.swgohLanguage, "ger_de");
            const description = lastEmbed(interaction).description;
            assert.ok(description.includes("Updated the bot's language to de_DE"), description);
            assert.ok(description.includes("Updated the game data language to ger_de"), description);
        });

        it("errors and saves nothing when neither language is chosen", async () => {
            const interaction = await runUserConf({ _subcommand: "lang" });

            assertErrorReply(interaction, "Nothing was updated");
            assert.strictEqual(await userReg.getUser(UC_USER.id), null);
        });
    });

    describe("view", () => {
        const fullPatronConfig: Partial<UserConfig> = {
            accounts: [AC_A],
            primaryAllyCode: AC_A,
            arenaAlert: { enableRankDMs: "primary", arena: "both", payoutWarning: 15, enablePayoutResult: true },
            arenaWatch: {
                allyCodes: [{ allyCode: AC_C }, { allyCode: AC_B }] as any,
                channel: "aw-channel",
                arena: { char: { enabled: true, channel: "aw-char" }, fleet: { enabled: false, channel: null } },
                payout: {
                    char: { enabled: true, channel: "po-char", msgID: null },
                    fleet: { enabled: false, channel: null, msgID: null },
                },
                useMarksInLog: true,
            },
            guildUpdate: { enabled: true, channel: "gu-channel", allyCode: AC_A },
            guildTickets: { enabled: true, channel: "gt-channel", allyCode: AC_A, sortBy: "tickets" },
            bonusServer: "userconf-bonus-guild",
        };

        it("shows ally codes, language, and the Patreon promo for a non-patron", async () => {
            const interaction = await runUserConf({ _subcommand: "view" }, createViewClient());

            const embed = lastEmbed(interaction);
            assert.strictEqual(embed.author.name, UC_USER.username);
            const fields = viewFields(interaction);
            assert.deepStrictEqual(
                fields.map((f) => f.name),
                ["Ally Codes", "Language Settings", "Patreon"],
            );
            assert.ok(fields[0].value.includes("No linked ally codes."), fields[0].value);
            assert.ok(fields[1].value.includes("Language: **N/A**"), fields[1].value);
            assert.ok(fields[2].value.includes("patreon.com/swgohbot"), fields[2].value);
        });

        it("bolds the primary, names codes from stored players, and truncates past 20 codes", async () => {
            const codes = Array.from({ length: 21 }, (_, ix) => 744000001 + ix);
            await seedUser({ accounts: codes, primaryAllyCode: codes[1], lang: { language: "en_US", swgohLanguage: "eng_us" } });
            await arenaPlayerRegistry.upsertPlayer({ allyCode: codes[1], name: "MainAcct" });

            const interaction = await runUserConf({ _subcommand: "view" }, createViewClient());

            const [allyField, langField] = viewFields(interaction);
            assert.ok(allyField.value.includes(`\`[1] ${codes[0]}\`: ${codes[0]}`), allyField.value);
            assert.ok(allyField.value.includes(`\`[2] ${codes[1]}\`: **MainAcct**`), allyField.value);
            assert.ok(allyField.value.includes("Not displaying 1 codes"), allyField.value);
            assert.ok(!allyField.value.includes(String(codes[20])), "the 21st code should not be listed");
            assert.ok(langField.value.includes("swgohLanguage: **ENG_US**"), langField.value);
        });

        it("treats a pledge under $1 as a non-patron", async () => {
            (patreonFuncs as any).getPatronUser = async () => ({ amount_cents: 50 });
            await seedUser(fullPatronConfig);

            const interaction = await runUserConf({ _subcommand: "view" }, createViewClient());

            assert.deepStrictEqual(
                viewFields(interaction).map((f) => f.name),
                ["Ally Codes", "Language Settings", "Patreon"],
            );
        });

        it("shows every configured section, sorted ArenaWatch codes, and the tier for a patron", async () => {
            (patreonFuncs as any).getPatronUser = async () => ({ amount_cents: 500 });
            await seedUser(fullPatronConfig);
            await arenaPlayerRegistry.upsertPlayer({ allyCode: AC_C, name: "Zed" });
            await arenaPlayerRegistry.upsertPlayer({ allyCode: AC_B, name: "Alpha" });

            const interaction = await runUserConf({ _subcommand: "view" }, createViewClient());

            const fields = viewFields(interaction);
            assert.deepStrictEqual(
                fields.map((f) => f.name),
                [
                    "Ally Codes",
                    "Language Settings",
                    "Arena Rank DMs",
                    "Arenawatch",
                    "Arenawatch Allycodes",
                    "Arenawatch Payouts",
                    "Guild Updates",
                    "Guild Tickets",
                    "Patreon",
                ],
            );
            const byName = new Map(fields.map((f) => [f.name, f.value]));
            const arenaAlert = byName.get("Arena Rank DMs") ?? "";
            assert.ok(arenaAlert.includes("DM for rank drops: **primary**"), arenaAlert);
            assert.ok(arenaAlert.includes("Payout warning: **15 min**"), arenaAlert);
            assert.ok(arenaAlert.includes("Payout result alert: **ON**"), arenaAlert);

            const aw = byName.get("Arenawatch") ?? "";
            assert.ok(aw.includes("Char Channel: **<#aw-char>**"), aw);
            assert.ok(aw.includes("Fleet Channel: **N/A**"), aw);
            assert.ok(aw.includes("Marks in log: **ON**"), aw);

            const awCodes = byName.get("Arenawatch Allycodes") ?? "";
            assert.ok(awCodes.indexOf("Alpha") < awCodes.indexOf("Zed"), `expected name order, got: ${awCodes}`);

            assert.ok((byName.get("Arenawatch Payouts") ?? "").includes("Char Channel: **<#po-char>**"));
            assert.ok((byName.get("Guild Updates") ?? "").includes("Channel:  <#gu-channel>"));
            assert.ok((byName.get("Guild Tickets") ?? "").includes("SortBy:   **tickets**"));

            const patreon = byName.get("Patreon") ?? "";
            assert.ok(patreon.includes("Tier: **Padawan** ($5/mo)"), patreon);
            assert.ok(patreon.includes("Bonus server: **Bonus Guild**"), patreon);
            assert.ok(patreon.includes("__Benefits:__"), patreon);
        });

        it("omits unconfigured patron sections and shows no bonus server", async () => {
            (patreonFuncs as any).getPatronUser = async () => ({ amount_cents: 100 });
            await seedUser({ accounts: [AC_A], primaryAllyCode: AC_A });

            const interaction = await runUserConf({ _subcommand: "view" }, createViewClient());

            const fields = viewFields(interaction);
            assert.deepStrictEqual(
                fields.map((f) => f.name),
                ["Ally Codes", "Language Settings", "Arena Rank DMs", "Patreon"],
            );
            const patreon = fields[3].value;
            assert.ok(patreon.includes("Tier: **Youngling** ($1/mo)"), patreon);
            assert.ok(patreon.includes("Bonus server: **None set**"), patreon);
        });
    });
});
