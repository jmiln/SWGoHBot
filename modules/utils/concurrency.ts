/**
 * Runs `iteratee` over every item, in order, with at most `limit` running at once.
 *
 * Replaces `async`'s `eachLimit`. Differs from it on failure: this stops starting new items but
 * waits for the in-flight ones to settle before rejecting, rather than rejecting immediately and
 * leaving their sockets and worker slots held behind the caller's back.
 */
export async function eachLimit<T>(items: readonly T[], limit: number, iteratee: (item: T) => Promise<void>): Promise<void> {
    if (!Number.isInteger(limit) || limit < 1) {
        throw new RangeError(`eachLimit: concurrency limit must be a positive integer, got ${limit}`);
    }
    if (!items.length) return;

    let nextIndex = 0;
    let firstError: unknown;
    let failed = false;

    const worker = async (): Promise<void> => {
        while (!failed && nextIndex < items.length) {
            const item = items[nextIndex++] as T;
            try {
                await iteratee(item);
            } catch (err) {
                if (!failed) {
                    failed = true;
                    firstError = err;
                }
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

    if (failed) throw firstError;
}

export class TimeoutError extends Error {
    constructor(operation: string, timeoutMs: number) {
        super(`${operation} timed out after ${timeoutMs}ms`);
        this.name = "TimeoutError";
    }
}

/**
 * Rejects with a TimeoutError if `promise` has not settled within `timeoutMs`.
 *
 * Stops waiting, but cannot cancel: whatever `promise` stands for keeps running, so use it only
 * where abandoning the result is safe.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bound = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(operation, timeoutMs)), timeoutMs);
        timer.unref();
    });
    try {
        return await Promise.race([promise, bound]);
    } finally {
        clearTimeout(timer);
    }
}
