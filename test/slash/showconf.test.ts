import assert from "node:assert";
import { after, before, describe, it } from "node:test";
import { env } from "../../config/config.ts";
import cache from "../../modules/cache.ts";
import userReg from "../../modules/users.ts";
import Showconf from "../../slash/showconf.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction } from "../mocks/index.ts";
import { getLastReply } from "./helpers.ts";

const TEST_GUILD_ID = "987654321";
const ROLE_ID = "123456789012345678";
const CHANNEL_ID = "111222333444555666";
const SUPPORTER_ID = "222333444555666777";

function makeInteraction() {
    return createMockInteraction({
        guild: {
            id: TEST_GUILD_ID,
            name: "Test Guild",
            roles: { cache: new Map() },
            channels: { cache: new Map() },
            members: { cache: new Map() },
        } as any,
    });
}

// Pull the embed data object out of the last reply
function getEmbed(interaction: any) {
    const reply = getLastReply(interaction);
    assert.ok(reply.embeds?.length, "Expected reply to have embeds");
    const embed = reply.embeds[0];
    return embed.data || embed;
}

function getField(embedData: any, name: string) {
    const field = embedData.fields?.find((f: any) => f.name === name);
    assert.ok(field, `Expected embed field "${name}", got: ${JSON.stringify(embedData.fields?.map((f: any) => f.name))}`);
    return field;
}

describe("Showconf", () => {
    const testDbName = env.MONGODB_SWGOHBOT_DB;
    let mongoClient: Awaited<ReturnType<typeof getMongoClient>>;

    before(async () => {
        mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        try {
            // Scope to this file's mock guild — test files run in parallel against the
            // shared test DB, so a collection-wide wipe races with other suites' docs
            await mongoClient.db(testDbName).collection("guildConfigs").deleteMany({ guildId: TEST_GUILD_ID });
        } catch (_e) {
            // Ignore cleanup errors
        }
        await closeMongoClient();
    });

    it("should initialize with correct name", () => {
        const command = new Showconf();
        assert.strictEqual(command.commandData.name, "showconf");
    });

    it("should require admin permissions (permLevel: 3)", () => {
        const command = new Showconf();
        assert.strictEqual(command.commandData.permLevel, 3);
    });

    it("should reply with a grouped-field embed for default settings", async () => {
        const interaction = makeInteraction();
        await new Showconf().run(createCommandContext({ interaction }));

        const embedData = getEmbed(interaction);
        // MockLanguage returns raw keys and drops args (serverName)
        assert.strictEqual(embedData.title, "COMMAND_SHOWCONF_TITLE");

        const general = getField(embedData, "COMMAND_SHOWCONF_HEADER_GENERAL");
        // Default adminRole is the plain name "Administrator" — no mention formatting
        assert.ok(general.value.includes("COMMAND_SHOWCONF_LABEL_ADMIN_ROLES"), "Expected admin roles label");
        assert.ok(general.value.includes("Administrator"), "Expected default admin role name");
        assert.ok(general.value.includes("America/Los_Angeles"), "Expected default timezone");

        const welcome = getField(embedData, "COMMAND_SHOWCONF_HEADER_WELCOME");
        // Both toggles default to false
        assert.ok(welcome.value.includes("BASE_OFF"), "Expected OFF toggles");
        assert.ok(!welcome.value.includes("BASE_ON"), "Expected no ON toggles by default");

        const events = getField(embedData, "COMMAND_SHOWCONF_HEADER_EVENTS");
        assert.ok(events.value.includes("BASE_NA"), "Expected N/A announce channel");
        assert.ok(events.value.includes("2880, 1440, 720, 360, 180, 120, 60, 30, 10, 5"), "Expected countdown list");

        const supporters = getField(embedData, "COMMAND_SHOWCONF_HEADER_SUPPORTERS");
        assert.ok(supporters.value.includes("BASE_NA"), "Expected N/A supporters");
    });

    it("should render ID-based roles and channels as mentions", async () => {
        await cache.put(testDbName, "guildConfigs", { guildId: TEST_GUILD_ID }, {
            guildId: TEST_GUILD_ID,
            settings: {
                adminRole: [ROLE_ID, "Officers"],
                announceChan: CHANNEL_ID,
                enableWelcome: true,
            },
        });

        const interaction = makeInteraction();
        await new Showconf().run(createCommandContext({ interaction }));

        const embedData = getEmbed(interaction);
        const general = getField(embedData, "COMMAND_SHOWCONF_HEADER_GENERAL");
        assert.ok(general.value.includes(`<@&${ROLE_ID}>`), "Expected role mention for ID entry");
        assert.ok(general.value.includes("Officers"), "Expected plain name entry as-is");

        const events = getField(embedData, "COMMAND_SHOWCONF_HEADER_EVENTS");
        assert.ok(events.value.includes(`<#${CHANNEL_ID}>`), "Expected channel mention");

        const welcome = getField(embedData, "COMMAND_SHOWCONF_HEADER_WELCOME");
        assert.ok(welcome.value.includes("BASE_ON"), "Expected welcome toggle ON");
        // Default welcomeMessage is quoted under the toggle
        assert.ok(welcome.value.includes("> Say hello to {{user}}"), "Expected quoted welcome message");

        await cache.remove(testDbName, "guildConfigs", { guildId: TEST_GUILD_ID });
    });

    it("should truncate long messages to 100 chars with an ellipsis", async () => {
        const longMessage = "x".repeat(150);
        await cache.put(testDbName, "guildConfigs", { guildId: TEST_GUILD_ID }, {
            guildId: TEST_GUILD_ID,
            settings: {
                enableWelcome: true,
                welcomeMessage: longMessage,
            },
        });

        const interaction = makeInteraction();
        await new Showconf().run(createCommandContext({ interaction }));

        const welcome = getField(getEmbed(interaction), "COMMAND_SHOWCONF_HEADER_WELCOME");
        assert.ok(welcome.value.includes(`> ${"x".repeat(100)}…`), "Expected 100-char preview with ellipsis");
        assert.ok(!welcome.value.includes("x".repeat(101)), "Expected message to be truncated");

        await cache.remove(testDbName, "guildConfigs", { guildId: TEST_GUILD_ID });
    });

    it("should list cached supporters by display name", async () => {
        await cache.put(testDbName, "guildConfigs", { guildId: TEST_GUILD_ID }, {
            guildId: TEST_GUILD_ID,
            patreonSettings: {
                supporters: [{ userId: SUPPORTER_ID, tier: 5 }],
            },
        });

        const interaction = makeInteraction();
        interaction.guild.members.cache.set(SUPPORTER_ID, { displayName: "SomeUser" });
        await new Showconf().run(createCommandContext({ interaction }));

        const supporters = getField(getEmbed(interaction), "COMMAND_SHOWCONF_HEADER_SUPPORTERS");
        assert.ok(supporters.value.includes("SomeUser"), "Expected supporter display name");
        assert.ok(!supporters.value.includes("BASE_NA"), "Expected no N/A when supporters exist");

        await cache.remove(testDbName, "guildConfigs", { guildId: TEST_GUILD_ID });
    });
});
