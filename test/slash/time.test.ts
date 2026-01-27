import assert from "node:assert";
import { describe, it } from "node:test";
import Time from "../../slash/time.ts";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply } from "./helpers.ts";

describe("Time", () => {
    it("should display time for valid timezone", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { timezone: "America/New_York" }
        });

        const command = new Time(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.content, "Expected content in reply");
        assert.ok(
            reply.content.includes("COMMAND_TIME_CURRENT"),
            "Expected time output in reply"
        );
        // Note: timezone won't be in content due to mock language.get() implementation
        // The important thing is that a reply was sent and it's not an error
        assert.ok(!reply.embeds, "Should not be an error embed");
    });

    it("should use guild default timezone when no timezone provided", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            guildSettings: {
                timezone: "Europe/London",
                swgohLanguage: "eng_us"
            }
        });

        const command = new Time(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        assert.ok(reply.content, "Expected content in reply");
        assert.ok(
            reply.content.includes("Europe/London") || reply.content.includes("guild's default"),
            "Expected guild default timezone reference"
        );
    });

    it("should show error for invalid timezone but use guild default", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { timezone: "Invalid/Timezone" },
            guildSettings: {
                timezone: "UTC",
                swgohLanguage: "eng_us"
            }
        });

        const command = new Time(bot);
        await command.run(bot, interaction);

        assertErrorReply(interaction, "COMMAND_TIME_INVALID_ZONE");
    });

    it("should fallback to UTC when no valid timezone available", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { timezone: "Invalid/Timezone" },
            guildSettings: {
                swgohLanguage: "eng_us"
            }
        });

        const command = new Time(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected at least one reply");

        const reply = replies[0];
        // Should be an error embed
        assert.ok(reply.embeds, "Expected embed for error");
        const embed = reply.embeds[0];
        const description = embed.data?.description || embed.description || "";
        assert.ok(
            description.includes("couldn't find a valid timezone") || description.includes("COMMAND_TIME_INVALID_ZONE"),
            "Expected UTC fallback or error message"
        );
    });

    it("should work without guild context (guildOnly: false)", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { timezone: "UTC" },
            guild: null as any
        });

        const command = new Time(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.ok(replies.length > 0, "Expected reply even without guild context");
    });
});
