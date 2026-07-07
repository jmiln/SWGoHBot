import assert from "node:assert";
import { describe, it } from "node:test";
import { arenaJumps } from "../../data/constants/units.ts";
import Arenarank from "../../slash/arenarank.ts";
import { createCommandContext, createMockInteraction, createRealLanguage } from "../mocks/index.ts";
import { assertErrorReply, assertReplyCount, getLastReply } from "./helpers.ts";

// A rank well above the arenaJumps table (max key 59), so findNextRank uses the
// Math.floor(rank * 0.85) fallback and isEstimated is true.
const ESTIMATED_RANK = 100;

describe("Arenarank", () => {
    describe("findNextRank (pure logic)", () => {
        it("uses the 0.85 fallback for ranks outside the jump table", () => {
            const command = new Arenarank();
            // 100 is not in arenaJumps → Math.floor(100 * 0.85) = 85
            assert.strictEqual((command as any).findNextRank(100), 85);
            assert.strictEqual((command as any).findNextRank(200), Math.floor(200 * 0.85));
        });

        it("uses the jump table for ranks inside it", () => {
            const command = new Arenarank();
            // 59 → 47 per arenaJumps; assert against the real table, not a magic number
            assert.strictEqual((command as any).findNextRank(59), arenaJumps["59"]);
            assert.strictEqual((command as any).findNextRank(59), 47);
        });

        it("returns 1 from the lowest jump-table ranks", () => {
            const command = new Arenarank();
            assert.strictEqual((command as any).findNextRank(5), 1);
            assert.strictEqual((command as any).findNextRank(3), 1);
        });
    });

    describe("computeArenaRanks (pure logic)", () => {
        it("starts the progression at the given rank", () => {
            const command = new Arenarank();
            const { battles } = (command as any).computeArenaRanks(ESTIMATED_RANK, 5);
            assert.strictEqual(battles[0], ESTIMATED_RANK);
        });

        it("produces hops+1 battles when the chain never reaches rank 1", () => {
            const command = new Arenarank();
            const five = (command as any).computeArenaRanks(ESTIMATED_RANK, 5);
            assert.strictEqual(five.battles.length, 6);
            const ten = (command as any).computeArenaRanks(200, 10);
            assert.strictEqual(ten.battles.length, 11);
            assert.notStrictEqual(ten.battles[ten.battles.length - 1], 1);
        });

        it("marks ranks above the jump table as estimated", () => {
            const command = new Arenarank();
            assert.strictEqual((command as any).computeArenaRanks(ESTIMATED_RANK, 5).isEstimated, true);
        });

        it("marks ranks inside the jump table as not estimated", () => {
            const command = new Arenarank();
            // 10 is a real key in arenaJumps
            assert.strictEqual((command as any).computeArenaRanks(10, 5).isEstimated, false);
        });

        it("each step equals findNextRank of the previous step", () => {
            const command = new Arenarank();
            const { battles } = (command as any).computeArenaRanks(ESTIMATED_RANK, 5);
            for (let i = 1; i < battles.length; i++) {
                assert.strictEqual(battles[i], (command as any).findNextRank(battles[i - 1]));
            }
        });

        it("stops early once the chain reaches rank 1", () => {
            const command = new Arenarank();
            // 5 → 1 in a single hop, so 10 requested hops must still terminate at [5, 1]
            const { battles } = (command as any).computeArenaRanks(5, 10);
            assert.deepStrictEqual(battles, [5, 1]);
            // rank 1 only appears once, at the end
            assert.strictEqual(battles.indexOf(1), battles.length - 1);
        });
    });

    describe("run (interaction handling)", () => {
        it("replies with the best-rank message for rank 1", async () => {
            const interaction = createMockInteraction({ optionsData: { rank: 1 } });
            const command = new Arenarank();
            await command.run(createCommandContext({ interaction }));

            const reply = getLastReply(interaction);
            assert.ok(reply.content.includes("COMMAND_ARENARANK_BEST_RANK"), "Expected the best-rank branch");
            assertReplyCount(interaction, 1);
        });

        it("errors when no rank is provided", async () => {
            const interaction = createMockInteraction({ optionsData: { rank: null } });
            const command = new Arenarank();
            await command.run(createCommandContext({ interaction }));

            assertErrorReply(interaction, "COMMAND_ARENARANK_INVALID_NUMBER");
        });

        it("replies with the rank-list branch for a normal rank", async () => {
            const interaction = createMockInteraction({ optionsData: { rank: ESTIMATED_RANK } });
            const command = new Arenarank();
            await command.run(createCommandContext({ interaction }));

            const reply = getLastReply(interaction);
            // Mock echoes the key, so this verifies the RANKLIST branch was taken
            // (not error / best-rank); the numeric progression is covered by the unit tests above.
            assert.ok(reply.content.includes("COMMAND_ARENARANK_RANKLIST"), "Expected the rank-list branch");
            assertReplyCount(interaction, 1);
        });

        it("renders the real computed progression end-to-end (real language)", async () => {
            const interaction = createMockInteraction({ optionsData: { rank: ESTIMATED_RANK } });
            const command = new Arenarank();
            // Real en_US language (not the key-echoing mock) so we can assert the actual rendered
            // progression rank 100 → 85 → 72 → 61 → 51 → 43 reaches the user, not just the branch.
            await command.run(createCommandContext({ interaction, language: createRealLanguage() }));

            const reply = getLastReply(interaction);
            assert.ok(
                reply.content.includes("100 → 85 → 72 → 61 → 51 → 43"),
                `Expected the real rank progression in the reply, got: ${reply.content}`,
            );
        });
    });
});
