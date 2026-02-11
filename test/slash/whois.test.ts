import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import swgohAPI from "../../modules/swapi.ts";
import WhoIs from "../../slash/whois.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { MockSWAPI } from "../mocks/mockSwapi.ts";

describe("WhoIs", () => {
    let mockSwapi: MockSWAPI;

    beforeEach(() => {
        mockSwapi = new MockSWAPI();
        // Replace swgohAPI methods with mock
        (swgohAPI as any).playerByName = mockSwapi.playerByName.bind(mockSwapi);
    });

    it("should find and display player by name", async () => {
        mockSwapi.setPlayerData({
            allyCode: 123456789,
            name: "TestPlayer",
            level: 85,
        } as any);

        const interaction = createMockInteraction({
            optionsData: { name: "TestPlayer" }
        });

        const command = new WhoIs();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected one reply");

        const content = replies[0].content || "";
        assert.ok(content.includes("123456789"), "Expected ally code in results");
        assert.ok(content.includes("TestPlayer"), "Expected player name in results");
    });

    it("should return error when name is too long (>50 chars)", async () => {
        const longName = "a".repeat(51);
        const interaction = createMockInteraction({
            optionsData: { name: longName }
        });

        const command = new WhoIs();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1, "Expected error reply");

        const reply = replies[0];
        assert.ok(reply.embeds, "Expected error embed");
        assert.ok(reply.flags, "Expected ephemeral error");
    });

    it("should return message when no players found", async () => {
        const interaction = createMockInteraction({
            optionsData: { name: "NonexistentPlayer" }
        });

        const command = new WhoIs();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const content = replies[0].content || "";
        assert.ok(content.includes("No results found"), "Expected no results message");
    });

    it("should limit results to 25 players when many matches", async () => {
        // Add 30 players with similar names
        for (let i = 1; i <= 30; i++) {
            mockSwapi.setPlayerData({
                allyCode: 100000000 + i,
                name: `Player${i}`,
                level: 85,
            } as any);
        }

        const interaction = createMockInteraction({
            optionsData: { name: "Player" }
        });

        const command = new WhoIs();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const content = replies[0].content || "";

        assert.ok(content.includes("Showing (25/30)"), "Expected limit message showing 25 of 30");
        assert.ok(content.includes("100000001"), "Expected first player");
        assert.ok(!content.includes("100000026"), "Should not include 26th player");
    });

    it("should display all results when under 25 matches", async () => {
        // Add 3 players
        mockSwapi.setPlayerData({ allyCode: 111111111, name: "Alpha", level: 85 } as any);
        mockSwapi.setPlayerData({ allyCode: 222222222, name: "AlphaBeta", level: 85 } as any);
        mockSwapi.setPlayerData({ allyCode: 333333333, name: "AlphaGamma", level: 85 } as any);

        const interaction = createMockInteraction({
            optionsData: { name: "Alpha" }
        });

        const command = new WhoIs();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        const content = replies[0].content || "";

        assert.ok(!content.includes("Showing"), "Should not show limit message for under 25 results");
        assert.ok(content.includes("111111111"), "Expected first player");
        assert.ok(content.includes("222222222"), "Expected second player");
        assert.ok(content.includes("333333333"), "Expected third player");
    });

    it("should work without guild context (guildOnly: false)", async () => {
        mockSwapi.setPlayerData({ allyCode: 123456789, name: "Test", level: 85 } as any);

        const interaction = createMockInteraction({
            optionsData: { name: "Test" },
            guild: null as any
        });

        const command = new WhoIs();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply even without guild context");
    });

    it("should defer reply before fetching data", async () => {
        mockSwapi.setPlayerData({ allyCode: 123456789, name: "Test", level: 85 } as any);

        const interaction = createMockInteraction({
            optionsData: { name: "Test" }
        });

        const command = new WhoIs();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        assert.strictEqual((interaction as any).deferred, true, "Expected interaction to be deferred");
    });
});
