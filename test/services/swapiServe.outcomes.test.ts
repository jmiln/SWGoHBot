import assert from "node:assert";
import { describe, it } from "node:test";
import { affectsHealth, classifyOutcome, isRetryable } from "../../services/swapiServe/outcomes.ts";

describe("swapiServe.classifyOutcome", () => {
    it("treats 2xx as ok", () => {
        assert.strictEqual(classifyOutcome(200), "ok");
        assert.strictEqual(classifyOutcome(204), "ok");
    });

    it("treats 429 as throttled", () => {
        assert.strictEqual(classifyOutcome(429), "throttled");
    });

    it("treats a rate-limit message without a status as throttled", () => {
        assert.strictEqual(classifyOutcome(undefined, "Too Many Requests"), "throttled");
        assert.strictEqual(classifyOutcome(undefined, "rate limit exceeded"), "throttled");
    });

    it("treats 5xx as a server error", () => {
        assert.strictEqual(classifyOutcome(502), "server_error");
        assert.strictEqual(classifyOutcome(500), "server_error");
    });

    it("treats 408 as a client timeout, separate from a transport failure", () => {
        assert.strictEqual(classifyOutcome(408), "client_timeout");
    });

    it("treats a missing status as a transport failure", () => {
        assert.strictEqual(classifyOutcome(undefined), "transport_failure");
        assert.strictEqual(classifyOutcome(undefined, "connect ECONNREFUSED"), "transport_failure");
    });

    it("treats a missing ally code as not_found regardless of status", () => {
        assert.strictEqual(classifyOutcome(400, "Failed to find ally code 123456789"), "not_found");
        assert.strictEqual(classifyOutcome(404, "failed to find ally code 987654321"), "not_found");
    });

    it("treats other 4xx as rejected", () => {
        assert.strictEqual(classifyOutcome(401), "rejected");
        assert.strictEqual(classifyOutcome(400, "Bad Request"), "rejected");
    });
});

describe("swapiServe.isRetryable", () => {
    it("retries server errors, transport failures and 408", () => {
        assert.strictEqual(isRetryable("server_error"), true);
        assert.strictEqual(isRetryable("transport_failure"), true);
        assert.strictEqual(isRetryable("client_timeout"), true);
    });

    // The old code never retried a 429, on the reasoning that the throttle is account-wide so a
    // retry only deepens the hole. That held when nothing paced us. Now a 429 halves the
    // backend's rate and the retry re-enters the queue, so it is paced by the collapsed rate;
    // dropping it instead would just lose the request for no benefit.
    it("retries a throttle, because the governor has already slowed the backend down", () => {
        assert.strictEqual(isRetryable("throttled"), true);
    });

    it("does not retry rejections or missing ally codes", () => {
        assert.strictEqual(isRetryable("rejected"), false);
        assert.strictEqual(isRetryable("not_found"), false);
        assert.strictEqual(isRetryable("ok"), false);
    });
});

describe("swapiServe.affectsHealth", () => {
    it("penalises throttles, server errors and transport failures", () => {
        assert.strictEqual(affectsHealth("throttled"), true);
        assert.strictEqual(affectsHealth("server_error"), true);
        assert.strictEqual(affectsHealth("transport_failure"), true);
    });

    // A dead ally code says nothing about backend health. Letting it shrink the concurrency
    // limit would silently throttle the whole pool every time a user typed a bad code.
    it("does not penalise a missing ally code", () => {
        assert.strictEqual(affectsHealth("not_found"), false);
    });

    it("does not penalise other rejections or a 408", () => {
        assert.strictEqual(affectsHealth("rejected"), false);
        assert.strictEqual(affectsHealth("client_timeout"), false);
        assert.strictEqual(affectsHealth("ok"), false);
    });
});
