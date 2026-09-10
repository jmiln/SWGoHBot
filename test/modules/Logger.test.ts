import assert from "node:assert";
import { Writable } from "node:stream";
import { describe, it } from "node:test";
import { formatLogLine, Logger, shouldUsePretty, splitLogOptions } from "../../modules/Logger.ts";

function captureLogger(shardId?: number): { logger: Logger; records: () => Record<string, unknown>[] } {
    const lines: string[] = [];
    const sink = new Writable({
        write(chunk: Buffer, _encoding: string, callback: () => void) {
            lines.push(...chunk.toString().split("\n").filter(Boolean));
            callback();
        },
    });
    return {
        logger: new Logger(shardId, { destination: sink, level: "debug" }),
        records: () => lines.map((line) => JSON.parse(line)),
    };
}

function record(extra: Record<string, unknown> = {}): string {
    return JSON.stringify({ level: 30, time: 1757400000000, pid: 1, hostname: "abc", msg: "hello", ...extra });
}

describe("formatLogLine", () => {
    it("keeps structured fields that are not pino base keys", () => {
        const line = formatLogLine(record({ shardId: 3, command: "counter" }));
        assert.match(line, /shardId=3/);
        assert.match(line, /command=counter/);
    });

    it("omits the name tag and the timestamp, which docker already supplies", () => {
        const line = formatLogLine(record({ name: "SWGoHBot" }));
        assert.doesNotMatch(line, /SWGoHBot/);
        assert.doesNotMatch(line, /1757400000000/);
        assert.doesNotMatch(line, /\d{4}/);
    });

    it("renders the level label and the message", () => {
        const line = formatLogLine(record());
        assert.match(line, /INFO/);
        assert.match(line, /hello/);
    });

    it("drops pino base keys from the field list", () => {
        const line = formatLogLine(record());
        assert.doesNotMatch(line, /pid=/);
        assert.doesNotMatch(line, /hostname=/);
        assert.doesNotMatch(line, /level=/);
    });

    it("serializes object field values as JSON rather than [object Object]", () => {
        const line = formatLogLine(record({ phases: { mods: 12 } }));
        assert.doesNotMatch(line, /\[object Object\]/);
        assert.match(line, /phases=/);
    });

    it("returns the raw line unchanged when it is not JSON", () => {
        assert.strictEqual(formatLogLine("not json"), "not json");
    });
});

describe("shouldUsePretty", () => {
    it("honours an explicit true regardless of TTY", () => {
        assert.strictEqual(shouldUsePretty(true, false), true);
    });

    it("honours an explicit false even on a TTY", () => {
        assert.strictEqual(shouldUsePretty(false, true), false);
    });

    it("falls back to TTY detection when unset", () => {
        assert.strictEqual(shouldUsePretty(undefined, true), true);
        assert.strictEqual(shouldUsePretty(undefined, false), false);
    });
});

describe("Logger shard attribution", () => {
    it("stamps every record with the shard id set by init", () => {
        const { logger, records } = captureLogger();
        logger.init(7);
        logger.log("after init");

        assert.strictEqual(records()[0].shardId, 7);
    });

    it("stamps records for a shard id passed to the constructor", () => {
        const { logger, records } = captureLogger(3);
        logger.log("constructed with a shard");

        assert.strictEqual(records()[0].shardId, 3);
    });

    it("omits shardId entirely when there is no shard, as in the manager process", () => {
        const { logger, records } = captureLogger();
        logger.log("manager scope");

        assert.ok(!("shardId" in records()[0]));
    });

    it("keeps per-call fields alongside the shard id", () => {
        const { logger, records } = captureLogger();
        logger.init(2);
        logger.error("Command failed", { command: "counter", durationMs: 12 });

        const record = records()[0];
        assert.strictEqual(record.shardId, 2);
        assert.strictEqual(record.command, "counter");
        assert.strictEqual(record.durationMs, 12);
    });
});

describe("splitLogOptions", () => {
    it("treats a bare true as the webhook flag, preserving the old call signature", () => {
        assert.deepStrictEqual(splitLogOptions(true), { webhook: true, fields: {} });
    });

    it("defaults to no webhook and no fields when omitted", () => {
        assert.deepStrictEqual(splitLogOptions(undefined), { webhook: false, fields: {} });
        assert.deepStrictEqual(splitLogOptions(false), { webhook: false, fields: {} });
    });

    it("separates the webhook flag from the fields", () => {
        assert.deepStrictEqual(splitLogOptions({ webhook: true, guildId: "1" }), { webhook: true, fields: { guildId: "1" } });
    });

    it("treats an object without a webhook key as fields only", () => {
        assert.deepStrictEqual(splitLogOptions({ guildId: "1" }), { webhook: false, fields: { guildId: "1" } });
    });
});
