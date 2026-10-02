import assert from "node:assert";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Client } from "discord.js";
import Language from "../../base/Language.ts";
import constants from "../../data/constants/constants.ts";
import cache from "../../modules/cache.ts";
import { EventFuncs } from "../../modules/eventFuncs.ts";
import { guildConfigDB } from "../../modules/guildConfig/db.ts";
import { getGuildEvents } from "../../modules/guildConfig/events.ts";
import logger from "../../modules/Logger.ts";
import { defaultGuildSettings } from "../../schemas/guildConfigs.schema.ts";
import type { GuildConfigEvent, GuildConfigEventWithGuild } from "../../types/guildConfig_types.ts";
import { closeMongoClient, getMongoClient } from "../helpers/mongodb.ts";
import { createMockLanguage } from "../mocks/index.ts";

const GUILD_ID = "eventfuncs-test-guild-1";
const OTHER_GUILD_ID = "eventfuncs-test-guild-2";
const CHANNEL_ID = "5550001";
const SETTLE_TIMEOUT_MS = 2000;
// Each send is held until both events in the test are mid-send, so two concurrent announcements
// deterministically read the guild's events before either writes. Sequential code only ever has
// one send in flight, so the fallback releases it rather than deadlocking.
const CONCURRENT_SENDS = 2;
const SEND_HOLD_FALLBACK_MS = 100;

const DAILY = { repeatDay: 1, repeatHour: 0, repeatMin: 0 };

function makeEvent(name: string, overrides: Partial<GuildConfigEvent> = {}): GuildConfigEvent {
    return {
        name,
        eventDT: Date.now() - 30 * constants.secMS,
        message: `${name} is starting`,
        channel: CHANNEL_ID,
        countdown: false,
        ...overrides,
    };
}

// manageEvents is fired and forgotten by its caller, so the old code returned before its writes
// landed. Waiting on the stored state keeps a slow write from reading as a pass or a fail.
async function waitForEvents(predicate: (events: GuildConfigEvent[]) => boolean, guildId = GUILD_ID): Promise<GuildConfigEvent[]> {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    let events = await getGuildEvents({ guildId });
    while (!predicate(events) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        events = await getGuildEvents({ guildId });
    }
    return events;
}

// Long enough for a second announce to get through its settings read and reach the send
const SECOND_SEND_WAIT_MS = 300;
const SHORT_SEND_TIMEOUT_MS = 50;

async function waitUntil(condition: () => boolean, timeoutMs = SETTLE_TIMEOUT_MS): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (!condition() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return condition();
}

describe("EventFuncs", () => {
    let eventFuncs: EventFuncs;
    let sentMessages: string[];
    let failSendFor: string | null;
    let sendsStarted: number;
    let sendsInFlight: number;
    let maxSendsInFlight: number;
    // Set to hold sends until released, standing in for a broadcastEval that has stalled. Only the
    // messages containing stallSendFor are held, or every send when it is null.
    let stalledSend: Promise<void> | null;
    let stallSendFor: string | null;
    let testClient: Client<true>;

    const saveEvents = async (events: GuildConfigEvent[], guildId = GUILD_ID) => {
        await guildConfigDB.put({ guildId }, { events } as never, false);
    };

    // What the eventServe check hands manageEvents: the stored events, stamped with their guild
    const asTriggered = (events: GuildConfigEvent[], guildId = GUILD_ID): GuildConfigEventWithGuild[] =>
        events.map((ev) => ({ ...structuredClone(ev), guildId }));

    before(async () => {
        const mongoClient = await getMongoClient();
        cache.init(mongoClient);
        Language.registerLanguage(defaultGuildSettings.language, createMockLanguage());

        let heldSends: (() => void)[] = [];
        const holdSend = () =>
            new Promise<void>((resolve) => {
                heldSends.push(resolve);
                if (heldSends.length >= CONCURRENT_SENDS) {
                    for (const release of heldSends) release();
                    heldSends = [];
                } else {
                    setTimeout(() => {
                        heldSends = heldSends.filter((release) => release !== resolve);
                        resolve();
                    }, SEND_HOLD_FALLBACK_MS);
                }
            });

        const channel = {
            isTextBased: () => true,
            permissionsFor: () => ({ has: () => true }),
            send: async (message: string) => {
                sendsStarted += 1;
                sendsInFlight += 1;
                maxSendsInFlight = Math.max(maxSendsInFlight, sendsInFlight);
                try {
                    const isStalled = stalledSend && (!stallSendFor || message.includes(stallSendFor));
                    await (isStalled ? stalledSend : holdSend());
                    if (failSendFor && message.includes(failSendFor)) throw new Error("Shard went away mid-broadcast");
                    sentMessages.push(message);
                } finally {
                    sendsInFlight -= 1;
                }
            },
        };
        const guild = {
            channels: { cache: { get: (id: string) => (id === CHANNEL_ID ? channel : undefined), find: () => undefined } },
            members: { me: {} },
        };
        const testGuildIds = new Set([GUILD_ID, OTHER_GUILD_ID]);
        testClient = {
            shard: {
                broadcastEval: async (fn: (client: unknown, ctx: unknown) => unknown, opts: { context: unknown }) => [
                    await fn({ guilds: { cache: { get: (id: string) => (testGuildIds.has(id) ? guild : undefined) } } }, opts.context),
                ],
            },
        } as unknown as Client<true>;

        eventFuncs = new EventFuncs();
        eventFuncs.init(testClient);
    });

    beforeEach(async () => {
        sentMessages = [];
        failSendFor = null;
        sendsStarted = 0;
        sendsInFlight = 0;
        maxSendsInFlight = 0;
        stalledSend = null;
        stallSendFor = null;
        await guildConfigDB.remove({ guildId: { $in: [GUILD_ID, OTHER_GUILD_ID] } });
    });

    after(async () => {
        await guildConfigDB.remove({ guildId: { $in: [GUILD_ID, OTHER_GUILD_ID] } });
        await closeMongoClient();
    });

    describe("manageEvents()", () => {
        it("reschedules both repeating events when two in one guild fire in the same minute", async () => {
            const events = [makeEvent("Raid Start", { repeat: DAILY }), makeEvent("TW Signup", { repeat: DAILY })];
            await saveEvents(events);
            const now = Date.now();

            await eventFuncs.manageEvents(asTriggered(events));

            const saved = await waitForEvents((evs) => evs.length === 2 && evs.every((ev) => ev.eventDT > now));
            assert.strictEqual(sentMessages.length, 2, "both events should be announced");
            assert.strictEqual(maxSendsInFlight, 1, "one guild's events should be announced one at a time");
            for (const ev of saved) {
                assert.ok(ev.eventDT > now, `${ev.name} was rolled back to its fired time, so it would be announced again as late`);
            }
        });

        it("keeps a one-shot event deleted when another event in the guild is rescheduled in the same minute", async () => {
            const events = [makeEvent("One Off"), makeEvent("Daily Reminder", { repeat: DAILY })];
            await saveEvents(events);
            const now = Date.now();

            await eventFuncs.manageEvents(asTriggered(events));

            const saved = await waitForEvents((evs) => evs.length === 1 && evs[0]?.name === "Daily Reminder" && evs[0].eventDT > now);
            assert.deepStrictEqual(
                saved.map((ev) => ev.name),
                ["Daily Reminder"],
                "the one-shot event should stay deleted, and only the repeating one remain",
            );
            assert.ok((saved[0]?.eventDT ?? 0) > now, "the repeating event should be rescheduled, not rolled back");
        });

        it("logs a failed announcement with its event and guild, and still handles the guild's other events", async (t) => {
            const errorLog = t.mock.method(logger, "error", () => {});
            const events = [makeEvent("Broken Event", { repeat: DAILY }), makeEvent("Working Event", { repeat: DAILY })];
            await saveEvents(events);
            failSendFor = "Broken Event";
            const now = Date.now();

            await eventFuncs.manageEvents(asTriggered(events));

            const saved = await waitForEvents((evs) => evs.some((ev) => ev.name === "Working Event" && ev.eventDT > now));
            const working = saved.find((ev) => ev.name === "Working Event");
            const broken = saved.find((ev) => ev.name === "Broken Event");
            assert.ok((working?.eventDT ?? 0) > now, "a failure in one event must not stop the guild's next event");
            assert.strictEqual(broken?.eventDT, events[0]?.eventDT, "the failed event should be left as-is so the next check retries it");

            const logged = errorLog.mock.calls.map((call) => String(call.arguments[0]));
            assert.ok(
                logged.some((line) => line.includes("Broken Event") && line.includes(GUILD_ID)),
                `expected an error naming the event and guild, got: ${JSON.stringify(logged)}`,
            );
            assert.strictEqual(logged.length, 1, `expected one error line for one failure, got: ${JSON.stringify(logged)}`);
        });

        it("does not start a guild again while an earlier check is still announcing it", async () => {
            let releaseStalledSend = () => {};
            stalledSend = new Promise((resolve) => {
                releaseStalledSend = resolve;
            });
            const events = [makeEvent("Slow Event", { repeat: DAILY })];
            await saveEvents(events);
            const now = Date.now();

            const firstCheck = eventFuncs.manageEvents(asTriggered(events));
            assert.ok(await waitUntil(() => sendsStarted === 1), "the first check should reach its send");
            // The next minute's check: nothing has been rescheduled yet, so the same event is still due
            const secondCheck = eventFuncs.manageEvents(asTriggered(events));
            await waitUntil(() => sendsStarted === 2, SECOND_SEND_WAIT_MS);
            releaseStalledSend();
            await Promise.all([firstCheck, secondCheck]);

            assert.strictEqual(sendsStarted, 1, "the second check must not announce an event the first is still sending");
            const saved = await waitForEvents((evs) => (evs[0]?.eventDT ?? 0) > now);
            assert.ok((saved[0]?.eventDT ?? 0) > now, "the first check should still reschedule the event");
        });

        it("gives up on a send that never settles, so later checks still reach the guild", async (t) => {
            t.mock.method(logger, "error", () => {});
            // A shard that exits mid-eval drops the pending reply without rejecting it
            stalledSend = new Promise(() => {});
            const quickFuncs = new EventFuncs({ sendTimeoutMs: SHORT_SEND_TIMEOUT_MS });
            quickFuncs.init(testClient);
            const events = [makeEvent("Lost Reply", { repeat: DAILY })];
            await saveEvents(events);

            let firstCheckSettled = false;
            void quickFuncs.manageEvents(asTriggered(events)).then(() => {
                firstCheckSettled = true;
            });
            assert.ok(await waitUntil(() => firstCheckSettled, 1000), "the check should give up on the stalled send");

            void quickFuncs.manageEvents(asTriggered(events));
            assert.ok(await waitUntil(() => sendsStarted === 2, 1000), "the next check should retry the event, not skip the guild");
        });

        it("sends a countdown alert while the guild's earlier check is still announcing", async () => {
            let releaseStalledSend = () => {};
            stalledSend = new Promise((resolve) => {
                releaseStalledSend = resolve;
            });
            stallSendFor = "Slow Event";
            const slow = makeEvent("Slow Event", { repeat: DAILY });
            const upcoming = makeEvent("Raid Start", { eventDT: Date.now() + 5 * constants.minMS, countdown: true });
            await saveEvents([slow, upcoming]);

            const firstCheck = eventFuncs.manageEvents(asTriggered([slow]));
            try {
                assert.ok(await waitUntil(() => sendsStarted === 1), "the first check should reach its send");
                // eventServe returns a countdown in its one matching minute only, so a skip would lose it
                const countdown = { ...asTriggered([upcoming])[0], name: "Raid Start-CD5", isCD: true } as GuildConfigEventWithGuild;
                await eventFuncs.manageEvents([countdown]);

                assert.deepStrictEqual(sentMessages, ["BASE_EVENT_STARTING_IN_MSG"], "the countdown must not wait on the slow announce");
            } finally {
                // The shared instance would otherwise keep this guild marked in progress for every later test
                releaseStalledSend();
                await firstCheck;
            }
        });

        it("announces different guilds' events in parallel", async () => {
            const events = [makeEvent("Guild One Event")];
            const otherEvents = [makeEvent("Guild Two Event")];
            await saveEvents(events);
            await saveEvents(otherEvents, OTHER_GUILD_ID);

            await eventFuncs.manageEvents([...asTriggered(events), ...asTriggered(otherEvents, OTHER_GUILD_ID)]);

            assert.strictEqual(sentMessages.length, 2, "both guilds should be announced");
            assert.strictEqual(maxSendsInFlight, 2, "separate guilds share no events array, so neither should wait on the other");
        });

        it("sends a countdown alert without changing the stored event", async () => {
            const stored = makeEvent("Raid Start", { eventDT: Date.now() + 5 * constants.minMS, countdown: true });
            await saveEvents([stored]);
            const countdown = { ...asTriggered([stored])[0], name: "Raid Start-CD5", isCD: true } as GuildConfigEventWithGuild;

            await eventFuncs.manageEvents([countdown]);

            assert.deepStrictEqual(sentMessages, ["BASE_EVENT_STARTING_IN_MSG"], "expected the countdown message");
            assert.deepStrictEqual(
                await getGuildEvents({ guildId: GUILD_ID }),
                [stored],
                "a countdown must not reschedule or delete the event",
            );
        });
    });
});
