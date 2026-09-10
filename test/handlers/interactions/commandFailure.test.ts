import assert from "node:assert";
import { describe, it, mock } from "node:test";
import { buildCommandFailureFields } from "../../../handlers/interactions/chatInput.ts";
import { logErr } from "../../../handlers/interactions/errors.ts";
import logger from "../../../modules/Logger.ts";

describe("buildCommandFailureFields", () => {
    it("carries the command context as fields rather than in the message", () => {
        const err = new Error("boom");
        const fields = buildCommandFailureFields({
            commandName: "counter",
            subcommand: "5v5",
            optionNames: ["leader", "member1"],
            userId: "u1",
            guildId: "g1",
            shardId: 2,
            durationMs: 42,
            err,
            ignored: false,
        });

        assert.strictEqual(fields.command, "counter");
        assert.strictEqual(fields.subcommand, "5v5");
        assert.deepStrictEqual(fields.options, ["leader", "member1"]);
        assert.strictEqual(fields.userId, "u1");
        assert.strictEqual(fields.guildId, "g1");
        assert.strictEqual(fields.shardId, 2);
        assert.strictEqual(fields.durationMs, 42);
        assert.strictEqual(fields.errorName, "Error");
        assert.strictEqual(fields.errorMessage, "boom");
        assert.ok(typeof fields.stack === "string");
    });

    it("omits the stack for ignored errors, which are expected Discord noise", () => {
        const fields = buildCommandFailureFields({
            commandName: "counter",
            subcommand: undefined,
            optionNames: [],
            userId: "u1",
            guildId: null,
            shardId: 0,
            durationMs: 1,
            err: new Error("Unknown interaction"),
            ignored: true,
        });

        assert.strictEqual(fields.stack, undefined);
        assert.strictEqual(fields.errorMessage, "Unknown interaction");
    });

    it("reports a null guildId for DM invocations rather than omitting the key", () => {
        const fields = buildCommandFailureFields({
            commandName: "help",
            subcommand: undefined,
            optionNames: [],
            userId: "u1",
            guildId: null,
            shardId: 0,
            durationMs: 1,
            err: new Error("boom"),
            ignored: false,
        });

        assert.strictEqual(fields.guildId, null);
    });
});

describe("command failure logging", () => {
    it("logs a failed command exactly once", () => {
        const calls: unknown[][] = [];
        const errorMock = mock.method(logger, "error", (...args: unknown[]) => {
            calls.push(args);
        });

        try {
            logErr("Command failed: counter", { webhook: true, command: "counter" });
            assert.strictEqual(calls.length, 1);
        } finally {
            errorMock.mock.restore();
        }
    });

    it("passes the fields through to the logger rather than flattening them into the message", () => {
        const calls: unknown[][] = [];
        const errorMock = mock.method(logger, "error", (...args: unknown[]) => {
            calls.push(args);
        });

        try {
            logErr("Command failed: counter", { command: "counter", userId: "u1" });
            assert.deepStrictEqual(calls[0][1], { command: "counter", userId: "u1" });
        } finally {
            errorMock.mock.restore();
        }
    });
});
