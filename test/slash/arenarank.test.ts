import assert from "node:assert/strict";
import test, {mock} from "node:test";
import ArenaRank from "../../slash/arenarank.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";


test.describe("ArenaRank Command", () => {
    test("Should send back the next 5 hops when given a rank", async () => {
        const bot = createMockBot({});
        const replyCalls: any[] = [];

        const interaction = createMockInteraction({
            options: {
                getInteger: (option) => {
                    if (option === "rank") return 354;
                },
            },
            reply: async (data) => replyCalls.push(data),
        });
        const cmd = new ArenaRank(bot);

        await cmd.run(bot, interaction);
        assert.equal(replyCalls.length, 1);
        assert.equal(replyCalls[0].content, "COMMAND_ARENARANK_RANKLIST");
    });
    test("FindNextRank gives the proper next rank", async () => {
        const bot = createMockBot();
        const cmd = new ArenaRank(bot);
        const result = cmd["findNextRank"](354);
        assert.deepEqual(result, 300);
    });
    test("ComputeArenaRanks gives the expected ranks (Given rank, and the next 5)", async () => {
        const bot = createMockBot();
        const cmd = new ArenaRank(bot);
        const result = cmd["computeArenaRanks"](354, 5);
        assert.deepEqual(result.battles, [354, 300, 255, 216, 183, 155]);
    });
    test("ComputeArenaRanks gives the expected ranks when given less hops (Given rank, and the next 3)", async () => {
        const bot = createMockBot();
        const cmd = new ArenaRank(bot);
        const result = cmd["computeArenaRanks"](354, 3);
        assert.deepEqual(result.battles, [354, 300, 255, 216]);
    });
    test("ComputeArenaRanks handles non-estimated ranks properly", async () => {
        const bot = createMockBot();
        const cmd = new ArenaRank(bot);
        const result = cmd["computeArenaRanks"](50, 3);
        assert.deepEqual(result.battles, [50, 39, 31, 24]);
    });
    test("ComputeArenaRanks handles rank 1 properly", async () => {
        const bot = createMockBot();
        const cmd = new ArenaRank(bot);
        const result = cmd["computeArenaRanks"](1, 3);
        assert.deepEqual(result.battles, [1]);
    });
});
