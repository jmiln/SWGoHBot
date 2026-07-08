import assert from "node:assert";
import { afterEach, describe, it } from "node:test";
import patreonFuncs from "../../modules/patreonFuncs.ts";
import userReg from "../../modules/users.ts";
import Patreon from "../../slash/patreon.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { assertErrorReply, assertReplyCount } from "./helpers.ts";

// Each test file runs in its own process, so reassigning these module singletons is isolated to
// this file (other files that mock the same functions run in separate processes). Restore after
// every test regardless.
const originalGetPatronUser = patreonFuncs.getPatronUser;
const originalGetPlayerCooldown = patreonFuncs.getPlayerCooldown;
const originalGetUser = userReg.getUser;

function firstEmbed(interaction: any): any {
    const reply = interaction._getReplies()[0];
    const embed = reply.embeds[0];
    return embed.data || embed;
}

describe("Patreon", () => {
    afterEach(() => {
        patreonFuncs.getPatronUser = originalGetPatronUser;
        patreonFuncs.getPlayerCooldown = originalGetPlayerCooldown;
        userReg.getUser = originalGetUser;
    });

    it("should display benefits for all tiers with their update cadence", async () => {
        const interaction = createMockInteraction({ optionsData: { _subcommand: "benefits" } });

        await new Patreon().run(createCommandContext({ interaction }));

        const embed = firstEmbed(interaction);
        // Only the three benefit-bearing tiers render (the $0 default tier has null benefits).
        const tierFields = embed.fields.filter((f: any) => /\$\d/.test(f.name));
        assert.strictEqual(tierFields.length, 3, "Expected exactly the three priced tiers");

        const youngling = embed.fields.find((f: any) => f.name === "Youngling - $1");
        assert.ok(youngling, "Expected the $1 Youngling tier");
        // getCooldowns renders playerTime 60 -> "1 hour" and guildTime 180 -> "3 hours".
        assert.ok(youngling.value.includes("every 1 hour"), "Expected the rendered player cadence");
        assert.ok(youngling.value.includes("every 3 hours"), "Expected the rendered guild cadence");

        const padawan = embed.fields.find((f: any) => f.name === "Padawan - $5");
        assert.ok(padawan, "Expected the $5 Padawan tier");
        assert.ok(padawan.value.includes("every 5 minutes"), "Expected the minute-scale player cadence");
        // Tiers above the first stack on top of the lower ones.
        assert.ok(padawan.value.includes("Everything above +"), "Expected the cumulative-benefits note on higher tiers");
    });

    it("should display patreon commands", async () => {
        const interaction = createMockInteraction({ optionsData: { _subcommand: "commands" } });

        await new Patreon().run(createCommandContext({ interaction }));

        const embed = firstEmbed(interaction);
        const commandField = embed.fields.find((f: any) => f.name === "Patreon Commands");
        assert.ok(commandField, "Expected 'Patreon Commands' field");
        assert.ok(commandField.value.includes("Arena Watch"), "Expected the commands field to list command names");
    });

    it("should show current cooldowns rendered from the fetched values", async () => {
        // getCooldowns turns 60 -> "1 hour" and 180 -> "3 hours".
        patreonFuncs.getPlayerCooldown = async () => ({ player: 60, guild: 180 }) as any;
        const interaction = createMockInteraction({ optionsData: { _subcommand: "cooldowns" } });

        await new Patreon().run(createCommandContext({ interaction }));

        const embed = firstEmbed(interaction);
        assert.ok(embed.title?.includes("Current Cooldowns"), "Expected the cooldowns title");
        assert.ok(embed.description.includes("Player: 1 hour"), `Expected the rendered player cooldown, got: ${embed.description}`);
        assert.ok(embed.description.includes("Guild: 3 hours"), `Expected the rendered guild cooldown, got: ${embed.description}`);
    });

    it("my_info: shows a subscription prompt (ephemeral) when the user is not a patron", async () => {
        patreonFuncs.getPatronUser = async () => null;
        // my_info has no explicit case, so it falls through to the default (personal-info) handler.
        const interaction = createMockInteraction({ optionsData: { _subcommand: "my_info" } });

        await new Patreon().run(createCommandContext({ interaction }));

        const reply = (interaction as any)._getReplies()[0];
        assert.ok(reply.flags, "Expected the not-subscribed reply to be ephemeral");
        const embed = reply.embeds[0].data || reply.embeds[0];
        assert.ok(embed.description.includes("not currently subscribed"), `Expected the not-subscribed prompt, got: ${embed.description}`);
        assert.ok(
            embed.fields.some((f: any) => f.name === "Patreon Commands"),
            "Expected the command list for non-subscribers",
        );
    });

    it("my_info: shows tier, selected server and cumulative benefits for a subscriber", async () => {
        // $5 -> getTier -> Padawan (tier 5); no bonus server set.
        patreonFuncs.getPatronUser = async () => ({ amount_cents: 500 }) as any;
        userReg.getUser = async () => ({ bonusServer: null }) as any;
        const interaction = createMockInteraction({ optionsData: { _subcommand: "my_info" } });

        await new Patreon().run(createCommandContext({ interaction }));

        const embed = firstEmbed(interaction);
        assert.ok(embed.description.includes("Padawan tier"), `Expected the resolved tier name, got: ${embed.description}`);

        const field = (name: string) => embed.fields.find((f: any) => f.name === name);
        assert.ok(field("Pull Times")?.value.includes("5 minutes"), "Expected the tier's improved pull time");
        assert.strictEqual(field("Selected Server")?.value, "N/A", "Expected N/A when no bonus server is set");
        // Benefits accumulate down the tiers: Padawan + the lower Youngling perks (e.g. GuildTickets).
        const benefits = field("Command Benefits")?.value ?? "";
        assert.ok(benefits.includes("ArenaWatch"), "Expected the current tier's benefits");
        assert.ok(benefits.includes("GuildTickets"), "Expected inherited lower-tier benefits");
    });

    it("unset_server: errors when the user has no bonus server set", async () => {
        userReg.getUser = async () => ({ bonusServer: null }) as any;
        const interaction = createMockInteraction({ optionsData: { _subcommand: "unset_server" } });

        await new Patreon().run(createCommandContext({ interaction }));

        assertErrorReply(interaction, "COMMAND_PATREON_NO_BONUS_SERVER");
    });

    it("set_server: errors when the user is not a patron subscriber", async () => {
        patreonFuncs.getPatronUser = async () => null;
        const interaction = createMockInteraction({ optionsData: { _subcommand: "set_server" } });

        await new Patreon().run(createCommandContext({ interaction }));

        const embed = firstEmbed(interaction);
        assert.ok(embed.description.includes("need to be subscribed"), `Expected the subscribe-required error, got: ${embed.description}`);
    });

    it("should send exactly one reply", async () => {
        const interaction = createMockInteraction({ optionsData: { _subcommand: "benefits" } });

        await new Patreon().run(createCommandContext({ interaction }));

        assertReplyCount(interaction, 1);
    });
});
