import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import { ApplicationCommandOptionType, codeBlock } from "discord.js";
import cache from "../../modules/cache.ts";
import { guildConfigDB } from "../../modules/guildConfig/db.ts";
import { getGuildSettings } from "../../modules/guildConfig/settings.ts";
import userReg from "../../modules/users.ts";
import SetConf from "../../slash/setconf.ts";
import type { GuildConfigTWList } from "../../types/guildConfig_types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createCommandContext, createMockInteraction, createRealLanguage } from "../mocks/index.ts";
import { assertErrorReply, getLastReply } from "./helpers.ts";

describe("SetConf", () => {
    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        userReg.init(cache);
    });

    after(async () => {
        await closeMongoClient();
    });

    it("should initialize with correct name", () => {
        const command = new SetConf();
        assert.strictEqual(command.commandData.name, "setconf");
    });

    it("should require admin permissions (permLevel: 3)", () => {
        const command = new SetConf();
        assert.strictEqual(command.commandData.permLevel, 3);
    });

    it("should have set, add, remove, and twlist options", () => {
        const command = new SetConf();
        const optionNames = command.commandData.options.map((o: any) => o.name);
        assert.ok(optionNames.includes("set"), "Expected set subcommand");
        assert.ok(optionNames.includes("add"), "Expected add subcommand");
        assert.ok(optionNames.includes("remove"), "Expected remove subcommand");
        assert.ok(optionNames.includes("twlist"), "Expected twlist subcommand group");
    });

    it("should return error when run outside a guild", async () => {
        // !interaction?.guild?.id check fires first, no MongoDB needed
        const interaction = createMockInteraction({ guild: null as any });
        const ctx = createCommandContext({ interaction });
        const command = new SetConf();
        await command.run(ctx);
        assertErrorReply(interaction, "BASE_COMMAND_UNAVAILABLE");
    });

    it("should return error when set subcommand has no options to update", async () => {
        // getGuildSettings returns defaultGuildSettings (not null), set subcommand with no options -> nothing to update
        const interaction = createMockInteraction({
            optionsData: { _subcommand: "set" },
        });
        const ctx = createCommandContext({ interaction });
        const command = new SetConf();
        await command.run(ctx);
        assertErrorReply(interaction, "COMMAND_SETCONF_NOTHING_UPDATED");
    });
});

// File-unique guild for tests that write guildConfigs; the mock default guild is shared with other files
const SC_GUILD = "setconf-test-guild";

const EMPTY_TW_LIST: GuildConfigTWList = {
    "Light Side": [],
    "Dark Side": [],
    Neutral: [],
    "Galactic Legends": [],
    Ships: [],
    "Capital Ships": [],
    Blacklist: [],
};

async function seedGuild({ settings = {}, twList = {} }: { settings?: Record<string, unknown>; twList?: Partial<GuildConfigTWList> } = {}) {
    await guildConfigDB.remove({ guildId: SC_GUILD });
    await guildConfigDB.put({ guildId: SC_GUILD }, { guildId: SC_GUILD, settings, twList: { ...EMPTY_TW_LIST, ...twList } }, false);
}

async function storedDoc() {
    return guildConfigDB.getOne<{ settings: Record<string, unknown>; twList: GuildConfigTWList }>({ guildId: SC_GUILD });
}

async function runSetConf(optionsData: Record<string, unknown>) {
    const interaction = createMockInteraction({ optionsData, guild: { id: SC_GUILD } as any });
    await new SetConf().run(createCommandContext({ interaction, language: createRealLanguage() }));
    return interaction;
}

function replyDescription(interaction: any): string {
    const embed = getLastReply(interaction).embeds[0];
    return (embed.data || embed).description;
}

function assertSuccessReply(interaction: any, expected: string) {
    const reply = getLastReply(interaction);
    assert.ok(!reply.flags, `Expected a public success reply, got: ${replyDescription(interaction)}`);
    assert.ok(replyDescription(interaction).includes(expected), `Expected "${expected}" in: ${replyDescription(interaction)}`);
}

describe("SetConf twlist", () => {
    before(async () => {
        cache.init(await getMongoClient());
    });

    beforeEach(async () => {
        await seedGuild();
    });

    after(async () => {
        await guildConfigDB.remove({ guildId: SC_GUILD });
        await closeMongoClient();
    });

    describe("view", () => {
        it("errors when every list is empty", async () => {
            const interaction = await runSetConf({ _subcommandGroup: "twlist", _subcommand: "view" });
            assertErrorReply(interaction, "You have no units in your list");
        });

        it("lists only the non-empty categories, naming each unit and falling back to N/A", async () => {
            await seedGuild({ twList: { "Light Side": ["AAYLASECURA"], Ships: ["NOT_A_REAL_UNIT"] } });
            const interaction = await runSetConf({ _subcommandGroup: "twlist", _subcommand: "view" });

            const reply = getLastReply(interaction);
            assert.strictEqual(reply.embeds[0].data.author.name, "Your current list:");
            assert.strictEqual(replyDescription(interaction), "* **Light Side**: \n  - Aayla Secura\n* **Ships**: \n  - N/A");
        });
    });

    describe("manage_list", () => {
        it("errors when neither add_unit nor remove_unit is given", async () => {
            const interaction = await runSetConf({ _subcommandGroup: "twlist", _subcommand: "manage_list" });
            assertErrorReply(interaction, "You must specify a unit to add or remove");
        });

        const placements: [string, string, keyof GuildConfigTWList][] = [
            ["a Galactic Legend", "GLAHSOKATANO", "Galactic Legends"],
            ["a dark side character", "4LOM", "Dark Side"],
            ["a neutral character", "HONDO", "Neutral"],
            ["a light side character", "AAYLASECURA", "Light Side"],
            ["a capital ship", "CAPITALCHIMAERA", "Capital Ships"],
            ["a regular ship", "JEDISTARFIGHTERANAKIN", "Ships"],
        ];
        for (const [label, defId, category] of placements) {
            it(`files ${label} under ${category}`, async () => {
                const interaction = await runSetConf({ _subcommandGroup: "twlist", _subcommand: "manage_list", add_unit: defId });

                assertSuccessReply(interaction, `Added ${defId} to your list`);
                const doc = await storedDoc();
                assert.deepStrictEqual(doc?.twList[category], [defId]);
            });
        }

        it("accepts a unit's display name and stores its defId", async () => {
            await runSetConf({ _subcommandGroup: "twlist", _subcommand: "manage_list", add_unit: "Hondo Ohnaka" });
            const doc = await storedDoc();
            assert.deepStrictEqual(doc?.twList.Neutral, ["HONDO"]);
        });

        it("refuses a unit already in one of the lists", async () => {
            await seedGuild({ twList: { "Dark Side": ["4LOM"] } });
            const interaction = await runSetConf({ _subcommandGroup: "twlist", _subcommand: "manage_list", add_unit: "4LOM" });

            assertErrorReply(interaction, "Trying to add 4LOM. This unit is already in your list");
            const doc = await storedDoc();
            assert.deepStrictEqual(doc?.twList["Dark Side"], ["4LOM"]);
        });

        it("removes a unit from every list but leaves the blacklist alone", async () => {
            await seedGuild({ twList: { "Dark Side": ["4LOM", "TRIPLEZERO"], Neutral: ["4LOM"], Blacklist: ["4LOM"] } });
            const interaction = await runSetConf({ _subcommandGroup: "twlist", _subcommand: "manage_list", remove_unit: "4LOM" });

            assertSuccessReply(interaction, "Removed 4LOM from your list");
            const doc = await storedDoc();
            assert.deepStrictEqual(doc?.twList["Dark Side"], ["TRIPLEZERO"]);
            assert.deepStrictEqual(doc?.twList.Neutral, []);
            assert.deepStrictEqual(doc?.twList.Blacklist, ["4LOM"]);
        });

        it("handles add_unit and ignores remove_unit when both are given", async () => {
            await seedGuild({ twList: { "Dark Side": ["TRIPLEZERO"] } });
            await runSetConf({ _subcommandGroup: "twlist", _subcommand: "manage_list", add_unit: "4LOM", remove_unit: "TRIPLEZERO" });

            const doc = await storedDoc();
            assert.deepStrictEqual(doc?.twList["Dark Side"], ["TRIPLEZERO", "4LOM"]);
        });
    });

    describe("blacklist", () => {
        it("adds a unit to the blacklist", async () => {
            const interaction = await runSetConf({ _subcommandGroup: "twlist", _subcommand: "blacklist", add_unit: "HONDO" });

            assertSuccessReply(interaction, "Added HONDO to your blacklist");
            const doc = await storedDoc();
            assert.deepStrictEqual(doc?.twList.Blacklist, ["HONDO"]);
        });

        it("refuses a unit that is already blacklisted", async () => {
            await seedGuild({ twList: { Blacklist: ["HONDO"] } });
            const interaction = await runSetConf({ _subcommandGroup: "twlist", _subcommand: "blacklist", add_unit: "HONDO" });
            assertErrorReply(interaction, "Trying to add HONDO. This unit is already in your blacklist");
        });

        it("removes a blacklisted unit", async () => {
            await seedGuild({ twList: { Blacklist: ["HONDO", "4LOM"] } });
            const interaction = await runSetConf({ _subcommandGroup: "twlist", _subcommand: "blacklist", remove_unit: "HONDO" });

            assertSuccessReply(interaction, "Removed HONDO from your blacklist");
            const doc = await storedDoc();
            assert.deepStrictEqual(doc?.twList.Blacklist, ["4LOM"]);
        });

        it("errors when removing a unit that is not blacklisted", async () => {
            const interaction = await runSetConf({ _subcommandGroup: "twlist", _subcommand: "blacklist", remove_unit: "HONDO" });
            assertErrorReply(interaction, "Trying to remove HONDO. This unit is not in your blacklist");
        });
    });
});

describe("SetConf settings", () => {
    before(async () => {
        cache.init(await getMongoClient());
    });

    beforeEach(async () => {
        await seedGuild();
    });

    after(async () => {
        await guildConfigDB.remove({ guildId: SC_GUILD });
        await closeMongoClient();
    });

    it("sets a valid timezone and logs the change", async () => {
        const interaction = await runSetConf({ _subcommand: "set", timezone: "America/New_York" });

        assert.strictEqual(replyDescription(interaction), codeBlock("* Set timezone to America/New_York"));
        const doc = await storedDoc();
        assert.strictEqual(doc?.settings.timezone, "America/New_York");
    });

    it("rejects an invalid timezone and saves nothing, even alongside a valid option", async () => {
        const interaction = await runSetConf({ _subcommand: "set", timezone: "Mars/Olympus", shardtime_vertical: true });

        assertErrorReply(interaction, codeBlock(`* ${createRealLanguage().get("BASE_INVALID_TIMEZONE")}`));
        const doc = await storedDoc();
        assert.deepStrictEqual(doc?.settings, {});
    });

    it("stores a channel by id and logs it by name", async () => {
        const interaction = await runSetConf({ _subcommand: "set", announce_chan: { id: "111111111111111111", name: "events" } });

        assert.strictEqual(replyDescription(interaction), codeBlock("* Set announceChan to #events"));
        const doc = await storedDoc();
        assert.strictEqual(doc?.settings.announceChan, "111111111111111111");
    });

    it("stores a boolean, including turning one off", async () => {
        await seedGuild({ settings: { useEventPages: true } });
        const interaction = await runSetConf({ _subcommand: "set", use_event_pages: false });

        assert.strictEqual(replyDescription(interaction), codeBlock("* Set useEventPages to false"));
        const doc = await storedDoc();
        assert.strictEqual(doc?.settings.useEventPages, undefined, "false is the default, so it is not stored");
    });

    it("sets several options at once", async () => {
        const interaction = await runSetConf({ _subcommand: "set", language: "de_DE", shardtime_vertical: true });

        assert.strictEqual(replyDescription(interaction), codeBlock("* Set language to de_DE\n* Set shardtimeVertical to true"));
        const doc = await storedDoc();
        assert.strictEqual(doc?.settings.language, "de_DE");
        assert.strictEqual(doc?.settings.shardtimeVertical, true);
    });

    it("reports nothing updated when the value matches the current one", async () => {
        await seedGuild({ settings: { timezone: "America/New_York" } });
        const interaction = await runSetConf({ _subcommand: "set", timezone: "America/New_York" });
        assertErrorReply(interaction, "It looks like nothing needed to be updated");
    });

    it("adds a countdown value to the list without duplicating it", async () => {
        await seedGuild({ settings: { eventCountdown: [60, 30] } });
        const interaction = await runSetConf({ _subcommand: "add", event_countdown: 15 });

        assert.strictEqual(replyDescription(interaction), codeBlock("* Added 15 to eventCountdown"));
        const doc = await storedDoc();
        assert.deepStrictEqual(doc?.settings.eventCountdown, [60, 30, 15]);
    });

    it("rejects a negative countdown", async () => {
        const interaction = await runSetConf({ _subcommand: "add", event_countdown: -5 });

        assertErrorReply(interaction, "-5 is not a valid entry, it __must__ be above 0");
        const doc = await storedDoc();
        assert.deepStrictEqual(doc?.settings, {});
    });

    it("adds an admin role by id", async () => {
        const interaction = await runSetConf({ _subcommand: "add", admin_role: { id: "222222222222222222", name: "Officers" } });

        assert.strictEqual(replyDescription(interaction), codeBlock("* Added 222222222222222222 to adminRole"));
        const doc = await storedDoc();
        assert.deepStrictEqual(doc?.settings.adminRole, ["Administrator", "222222222222222222"]);
    });

    it("removes an admin role stored by id or by its name", async () => {
        await seedGuild({ settings: { adminRole: ["Administrator", "222222222222222222", "Officers"] } });
        const interaction = await runSetConf({ _subcommand: "remove", admin_role: { id: "222222222222222222", name: "Officers" } });

        assert.strictEqual(replyDescription(interaction), codeBlock("* Removed 222222222222222222 from adminRole"));
        const settings = await getGuildSettings({ guildId: SC_GUILD });
        assert.deepStrictEqual(settings.adminRole, ["Administrator"]);
    });
});

describe("SetConf autocomplete", () => {
    before(async () => {
        cache.init(await getMongoClient());
    });

    beforeEach(async () => {
        await seedGuild();
    });

    after(async () => {
        await guildConfigDB.remove({ guildId: SC_GUILD });
        await closeMongoClient();
    });

    async function autocomplete(subCommand: string, focused: { name: string; value: string }) {
        const responses: { name: string; value: string }[][] = [];
        const interaction = {
            guild: { id: SC_GUILD },
            options: { getSubcommandGroup: () => "twlist", getSubcommand: () => subCommand },
            respond: async (choices: { name: string; value: string }[]) => {
                responses.push(choices);
            },
        };
        await new SetConf().autocomplete(interaction as any, { ...focused, type: ApplicationCommandOptionType.String } as any);
        return responses;
    }

    it("suggests guild aliases ahead of unit names for add_unit, capped at 24", async () => {
        await guildConfigDB.put({ guildId: SC_GUILD }, { aliases: [{ name: "Hondo Ohnaka", alias: "hondo", defId: "HONDO" }] }, false);

        const [choices] = await autocomplete("manage_list", { name: "add_unit", value: " HONDO " });
        assert.deepStrictEqual(choices[0], { name: "Hondo Ohnaka (hondo)", value: "HONDO" });
        assert.deepStrictEqual(choices[1], { name: "Hondo Ohnaka", value: "HONDO" });

        const [broad] = await autocomplete("manage_list", { name: "add_unit", value: "a" });
        assert.strictEqual(broad.length, 24);
    });

    it("suggests blacklisted units for blacklist remove_unit, dropping unknown defIds", async () => {
        await seedGuild({ twList: { Blacklist: ["HONDO", "4LOM", "NOT_A_REAL_UNIT"], Neutral: ["AAYLASECURA"] } });

        const [all] = await autocomplete("blacklist", { name: "remove_unit", value: "" });
        assert.deepStrictEqual(all, [
            { name: "Hondo Ohnaka", value: "HONDO" },
            { name: "4-LOM", value: "4LOM" },
        ]);

        const [filtered] = await autocomplete("blacklist", { name: "remove_unit", value: "hon" });
        assert.deepStrictEqual(filtered, [{ name: "Hondo Ohnaka", value: "HONDO" }]);
    });

    it("suggests listed units, not blacklisted ones, for manage_list remove_unit", async () => {
        await seedGuild({ twList: { "Light Side": ["AAYLASECURA"], Ships: ["JEDISTARFIGHTERANAKIN"], Blacklist: ["HONDO"] } });

        const [all] = await autocomplete("manage_list", { name: "remove_unit", value: "" });
        assert.deepStrictEqual(all, [
            { name: "Aayla Secura", value: "AAYLASECURA" },
            { name: "Anakin's Eta-2 Starfighter", value: "JEDISTARFIGHTERANAKIN" },
        ]);

        const [filtered] = await autocomplete("manage_list", { name: "remove_unit", value: "eta-2" });
        assert.deepStrictEqual(filtered, [{ name: "Anakin's Eta-2 Starfighter", value: "JEDISTARFIGHTERANAKIN" }]);
    });

    it("does not respond outside the twlist group", async () => {
        const responses: unknown[] = [];
        const interaction = {
            guild: { id: SC_GUILD },
            options: { getSubcommandGroup: () => null, getSubcommand: () => "set" },
            respond: async (choices: unknown) => {
                responses.push(choices);
            },
        };
        await new SetConf().autocomplete(
            interaction as any,
            { name: "timezone", value: "", type: ApplicationCommandOptionType.String } as any,
        );
        assert.strictEqual(responses.length, 0);
    });
});
