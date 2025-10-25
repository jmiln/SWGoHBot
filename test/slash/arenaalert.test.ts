import assert from "node:assert/strict";
import test, {mock} from "node:test";
import ArenaAlert from "../../slash/arenaalert.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";


test.describe("ArenaAlert Command", () => {
    test("Should error because the user is not a patreon", async () => {
        const bot = createMockBot({});
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            user: { id: "456" },
            guild: { id: "123" },
            options: {
                getString: () => null,
                getInteger: () => null,
            },
            reply: async (data) => replyCalls.push(data),
        });
        const cmd = new ArenaAlert(bot);

        await cmd.run(bot, interaction);
        assert.equal(replyCalls.length, 1);
        assert.equal(replyCalls[0].embeds[0].description, "COMMAND_ARENAALERT_PATREON_ONLY");
    });
    test("Should send back the values of each setting (view command)", async () => {
        const bot = createMockBot({
            cache: {
                getOne: () => ({
                    arenaAlert: {enableRankDMs: false, arena: "both", payoutWarning: 10, enablePayoutResult: true}
                })
            },
            getPatronUser: () => ({discordID: "456", amount_cents: 100})
        });
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            user: { id: "456" },
            guild: { id: "123" },
            options: {
                getString: () => null,
                getInteger: () => null,
            },
            reply: async (data) => replyCalls.push(data),
        });
        const cmd = new ArenaAlert(bot);

        await cmd.run(bot, interaction);
        assert.equal(replyCalls.length, 1);
        assert.equal(replyCalls[0].embeds[0].description, [
            "COMMAND_ARENAALERT_VIEW_DM: **N/A**",
            "COMMAND_ARENAALERT_VIEW_SHOW: **both**",
            "COMMAND_ARENAALERT_VIEW_WARNING: **10 min**",
            "COMMAND_ARENAALERT_VIEW_RESULT: **ON**",
        ].join("\n"));
    });
    test("Should change the payout warning, and send back an acknowledgement", async () => {
        const bot = createMockBot({
            cache: {
                getOne: async () => ({
                    arenaAlert: {enableRankDMs: false, arena: "both", payoutWarning: 10, enablePayoutResult: true}
                })
            },
            getPatronUser: () => ({discordID: "456", amount_cents: 100})
        });
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            user: { id: "456" },
            guild: { id: "123" },
            options: {
                getString: () => null,
                getInteger: () => 5,
            },
            reply: async (data) => replyCalls.push(data),
        });
        const cmd = new ArenaAlert(bot);

        await cmd.run(bot, interaction);
        assert.equal(replyCalls.length, 1);
        assert.equal(replyCalls[0].embeds[0].description, "Changed Payout Warning from 10 to 5");
    });
    test("Should send back a message if nothing was updated", async () => {
        const bot = createMockBot({
            cache: {
                getOne: async () => ({
                    arenaAlert: {enableRankDMs: false, arena: "both", payoutWarning: 10, enablePayoutResult: true}
                })
            },
            getPatronUser: () => ({discordID: "456", amount_cents: 100})
        });
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            user: { id: "456" },
            guild: { id: "123" },
            options: {
                getString: () => null,
                getInteger: () => 10,
            },
            reply: async (data) => replyCalls.push(data),
        });
        const cmd = new ArenaAlert(bot);

        await cmd.run(bot, interaction);
        assert.equal(replyCalls.length, 1);
        assert.match(replyCalls[0].embeds[0].description, /nothing was updated/i);
    });
    test("ComputeArenaAlertChanges should send back an updated config based on what's entered", async () => {
        const bot = createMockBot();
        const cmd = new ArenaAlert(bot);
        const userStub = {
            arenaAlert: {enableRankDMs: false, arena: "both", payoutWarning: 10, enablePayoutResult: true}
        };
        const result = cmd["computeArenaAlertChanges"](userStub, {
            enabledms: true,
            arena: "char",
        });
        assert.deepEqual(result.changelog, [
            "Changed EnableDMs from false to true",
            "Changed arena from both to char",
        ]);
        assert.deepEqual(result.updatedUser, {
            arenaAlert: {
                enableRankDMs: true,
                arena: "char",
                payoutWarning: 10,
                enablePayoutResult: true,
            }
        });
    });
});
