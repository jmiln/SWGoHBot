import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import arenaPlayerRegistry from "../../modules/arenaPlayerRegistry.ts";
import cache from "../../modules/cache.ts";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import ArenaHist from "../../slash/arenahist.ts";
import type { ArenaPlayer, PatronUser, UserConfig } from "../../types/types.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("ArenaHist", () => {
    // Save the real singleton methods so each test can stub them in isolation
    const originalGetPatronUser = patreonFuncs.getPatronUser;
    const originalGetOne = cache.getOne;
    const originalGetPlayer = arenaPlayerRegistry.getPlayer;
    const originalFetch = globalThis.fetch;

    // A patron at exactly the 100-cent threshold (the gate is `< 100`)
    function stubPatron(amount_cents = 500): void {
        patreonFuncs.getPatronUser = async () => ({ amount_cents } as PatronUser);
    }

    // A registered user owning a single ally code as their primary account
    function stubUser(user: Partial<UserConfig> | null): void {
        cache.getOne = (async () => user) as typeof cache.getOne;
    }

    function stubPlayer(player: Partial<ArenaPlayer> | null): void {
        arenaPlayerRegistry.getPlayer = async () => player as ArenaPlayer | null;
    }

    beforeEach(() => {
        // Default happy-path stubs; individual tests override as needed
        stubPatron();
        stubUser({ id: "123456789", accounts: [123456789], primaryAllyCode: 123456789 });
        stubPlayer({ name: "Tester", charHist: [{ rank: 50, ts: Date.now() - DAY_MS }], shipHist: [] });
    });

    afterEach(() => {
        patreonFuncs.getPatronUser = originalGetPatronUser;
        cache.getOne = originalGetOne;
        arenaPlayerRegistry.getPlayer = originalGetPlayer;
        globalThis.fetch = originalFetch;
    });

    it("should initialize with correct name", () => {
        const command = new ArenaHist();
        assert.strictEqual(command.commandData.name, "arenahist");
    });

    describe("Patreon gate", () => {
        it("shows the Patreon teaser embed when the user is not a patron", async () => {
            patreonFuncs.getPatronUser = async () => null;

            const interaction = createMockInteraction({ optionsData: {} });
            const command = new ArenaHist();
            await command.run(createCommandContext({ interaction }));

            // Teaser is a plain (non-deferred, non-error) reply, not super.error()
            assert.strictEqual(interaction.deferred, false, "should not defer for non-patrons");
            const reply = getLastReply(interaction);
            assert.strictEqual(reply.embeds[0].title, "COMMAND_ARENAHIST_PATREON_TITLE");
            assert.strictEqual(reply.embeds[0].description, "COMMAND_ARENAHIST_PATREON_DESC");
        });

        it("shows the Patreon teaser when the pledge is below the 100-cent threshold", async () => {
            patreonFuncs.getPatronUser = async () => ({ amount_cents: 99 } as PatronUser);

            const interaction = createMockInteraction({ optionsData: {} });
            const command = new ArenaHist();
            await command.run(createCommandContext({ interaction }));

            assert.strictEqual(interaction.deferred, false);
            const reply = getLastReply(interaction);
            assert.strictEqual(reply.embeds[0].title, "COMMAND_ARENAHIST_PATREON_TITLE");
        });
    });

    describe("Account resolution", () => {
        it("errors when the patron has no user record", async () => {
            stubUser(null);

            const interaction = createMockInteraction({ optionsData: {} });
            const command = new ArenaHist();
            await command.run(createCommandContext({ interaction }));

            assert.strictEqual(interaction.deferred, true, "should defer once past the Patreon gate");
            assertErrorReply(interaction, "COMMAND_ARENAHIST_NOT_REGISTERED");
        });

        it("errors when no ally code is given and the user has no primary account", async () => {
            stubUser({ id: "123456789", accounts: [], primaryAllyCode: undefined });

            const interaction = createMockInteraction({ optionsData: {} });
            const command = new ArenaHist();
            await command.run(createCommandContext({ interaction }));

            assertErrorReply(interaction, "COMMAND_ARENAHIST_NO_ACCOUNT");
        });

        it("errors when the requested ally code is not owned by the user", async () => {
            stubUser({ id: "123456789", accounts: [123456789], primaryAllyCode: 123456789 });

            const interaction = createMockInteraction({ optionsData: { allycode: "999999999" } });
            const command = new ArenaHist();
            await command.run(createCommandContext({ interaction }));

            assertErrorReply(interaction, "COMMAND_ARENAHIST_NO_ACCOUNT");
        });
    });

    describe("History data", () => {
        it("errors when the account has no in-window history", async () => {
            stubPlayer({ name: "Tester", charHist: [], shipHist: [] });

            const interaction = createMockInteraction({ optionsData: {} });
            const command = new ArenaHist();
            await command.run(createCommandContext({ interaction }));

            assertErrorReply(interaction, "COMMAND_ARENAHIST_NO_DATA");
        });

        it("errors when no arenaPlayers doc exists for the account", async () => {
            stubPlayer(null);

            const interaction = createMockInteraction({ optionsData: {} });
            const command = new ArenaHist();
            await command.run(createCommandContext({ interaction }));

            assertErrorReply(interaction, "COMMAND_ARENAHIST_NO_DATA");
        });
    });

    describe("Image server", () => {
        it("errors when the image server responds with a non-OK status", async () => {
            globalThis.fetch = (async () => ({ ok: false, status: 502, statusText: "Bad Gateway" })) as unknown as typeof fetch;

            const interaction = createMockInteraction({ optionsData: {} });
            const command = new ArenaHist();
            await command.run(createCommandContext({ interaction }));

            assertErrorReply(interaction, "COMMAND_ARENAHIST_IMAGE_ERROR");
        });

        it("errors when the image server is unreachable", async () => {
            globalThis.fetch = (async () => {
                throw new Error("ECONNREFUSED");
            }) as typeof fetch;

            const interaction = createMockInteraction({ optionsData: {} });
            const command = new ArenaHist();
            await command.run(createCommandContext({ interaction }));

            assertErrorReply(interaction, "COMMAND_ARENAHIST_IMAGE_ERROR");
        });

        it("replies with the rendered chart image on success", async () => {
            const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
            globalThis.fetch = (async () => ({
                ok: true,
                status: 200,
                statusText: "OK",
                arrayBuffer: async () => pngBytes.buffer,
            })) as unknown as typeof fetch;

            const interaction = createMockInteraction({ optionsData: {} });
            const command = new ArenaHist();
            await command.run(createCommandContext({ interaction }));

            const reply = getLastReply(interaction);
            assert.ok(reply.files, "expected a file attachment");
            assert.strictEqual(reply.files.length, 1);
            assert.strictEqual(reply.files[0].name, "arenahist.png");
            assert.ok(Buffer.isBuffer(reply.files[0].attachment), "attachment should be a Buffer");
        });
    });
});
