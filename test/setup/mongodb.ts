import { MongoDBContainer } from "@testcontainers/mongodb";
import type { StartedMongoDBContainer } from "@testcontainers/mongodb";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let container: StartedMongoDBContainer | undefined;
const lockFile = join(tmpdir(), "swgohbot-testcontainer.lock");
const startingFile = join(tmpdir(), "swgohbot-testcontainer.starting");

/**
 * Wait for lock file to appear, with timeout.
 * Returns true if lock file appeared, false if timeout reached.
 */
async function waitForLockFile(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        if (existsSync(lockFile)) {
            return true;
        }
        // Wait 100ms before checking again
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
}

/**
 * Starts a MongoDB testcontainer on port 27018 for test isolation.
 * Sets process.env.MONGO_URL for tests to connect.
 * Executed automatically when this module is imported via --import flag.
 * Uses file-based locking with wait mechanism to handle parallel test execution.
 */
async function setup() {
    // Check if another process already started the container
    if (existsSync(lockFile)) {
        const connectionString = readFileSync(lockFile, "utf-8");
        process.env.MONGO_URL = connectionString;
        console.log(`Using existing MongoDB testcontainer: ${connectionString}`);
        return;
    }

    // Check if another process is currently starting the container
    if (existsSync(startingFile)) {
        console.log("Another process is starting MongoDB testcontainer, waiting...");
        const lockAppeared = await waitForLockFile(30000); // Wait up to 30 seconds

        if (lockAppeared) {
            const connectionString = readFileSync(lockFile, "utf-8");
            process.env.MONGO_URL = connectionString;
            console.log(`Using MongoDB testcontainer started by another process: ${connectionString}`);
            return;
        }

        // Timeout - assume the other process failed, proceed to start
        console.log("Timeout waiting for container, attempting to start...");
        // Clean up stale starting file
        try {
            unlinkSync(startingFile);
        } catch (error) {
            // Ignore errors
        }
    }

    // Create starting marker to signal other processes to wait
    try {
        writeFileSync(startingFile, process.pid.toString(), "utf-8");
    } catch (error) {
        // Race condition: another process created it first
        // Wait for that process to finish
        const lockAppeared = await waitForLockFile(30000);
        if (lockAppeared) {
            const connectionString = readFileSync(lockFile, "utf-8");
            process.env.MONGO_URL = connectionString;
            console.log(`Using MongoDB testcontainer started by another process: ${connectionString}`);
            return;
        }
    }

    console.log("Starting MongoDB testcontainer on port 27018...");

    try {
        container = await new MongoDBContainer("mongo:7.0")
            .withExposedPorts({ container: 27017, host: 27018 })
            .start();

        const connectionString = `${container.getConnectionString()}?directConnection=true`;
        process.env.MONGO_URL = connectionString;

        // Write connection string to lock file for other processes
        writeFileSync(lockFile, connectionString, "utf-8");

        // Remove starting marker
        try {
            unlinkSync(startingFile);
        } catch (error) {
            // Ignore errors
        }

        console.log(`MongoDB testcontainer started: ${connectionString}`);
    } catch (error) {
        console.error("Failed to start MongoDB testcontainer:", error);

        // Clean up starting marker
        try {
            unlinkSync(startingFile);
        } catch (cleanupError) {
            // Ignore cleanup errors
        }

        // Clean up partial container if it exists
        if (container) {
            try {
                await container.stop();
            } catch (stopError) {
                // Ignore cleanup errors
            }
        }
        throw error; // Re-throw to fail fast
    }
}

/**
 * Stops and removes the MongoDB testcontainer.
 * Registered with process exit handlers.
 * Only stops if this process owns the container.
 */
async function teardown() {
    if (container) {
        console.log("Stopping MongoDB testcontainer...");
        try {
            await container.stop();
            console.log("MongoDB testcontainer stopped");

            // Remove lock file
            if (existsSync(lockFile)) {
                unlinkSync(lockFile);
            }
        } catch (error) {
            console.error("Failed to stop MongoDB testcontainer:", error);
            // Don't re-throw - we want cleanup to continue even if stop fails
        }
    }
}

// Execute setup when module is imported
await setup();

// Register teardown handlers for graceful shutdown
process.on("exit", () => {
    // Note: exit event doesn't support async, so we can't await here
    // But testcontainers should handle cleanup on process exit
    // Clean up lock file if we own the container
    if (container && existsSync(lockFile)) {
        try {
            unlinkSync(lockFile);
        } catch (error) {
            // Ignore cleanup errors
        }
    }
});

// Handle SIGINT and SIGTERM for clean shutdowns
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
        await teardown();
        process.exit(0);
    });
}
