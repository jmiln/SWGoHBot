import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StartedMongoDBContainer } from "@testcontainers/mongodb";
import { MongoDBContainer } from "@testcontainers/mongodb";
import { MongoClient } from "mongodb";

let container: StartedMongoDBContainer | undefined;
const lockFile = join(tmpdir(), "swgohbot-testcontainer.lock");
const startingFile = join(tmpdir(), "swgohbot-testcontainer.starting");

// Global flag to prevent multiple setup attempts in the same process
const SETUP_KEY = Symbol.for("swgohbot.testcontainer.setup");
const globalState = globalThis as any;

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
 * Verify that MongoDB connection is actually alive.
 * Returns true if connection works, false otherwise.
 */
async function verifyConnection(connectionString: string): Promise<boolean> {
    let client: MongoClient | null = null;
    try {
        client = new MongoClient(connectionString, {
            serverSelectionTimeoutMS: 2000,
            connectTimeoutMS: 2000,
        });
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        return true;
    } catch (error) {
        return false;
    } finally {
        if (client) {
            try {
                await client.close();
            } catch (e) {
                // Ignore close errors
            }
        }
    }
}

/**
 * Starts a MongoDB testcontainer on port 27018 for test isolation.
 * Sets process.env.MONGO_URL for tests to connect.
 * Executed automatically when this module is imported via --import flag.
 * Uses file-based locking with wait mechanism to handle parallel test execution.
 */
async function setup() {
    // If MONGO_URL is already set, setup has already completed in this process
    if (process.env.MONGO_URL) {
        // Silently reuse - already configured in this process
        return;
    }

    // Clean up stale lock/starting files from previous crashed runs
    // Check if files exist and if they're older than 5 minutes
    for (const file of [lockFile, startingFile]) {
        if (existsSync(file)) {
            try {
                const stats = require("fs").statSync(file);
                const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;
                if (ageMinutes > 5) {
                    console.log(`⚠️  Cleaning up stale file: ${file}`);
                    unlinkSync(file);
                }
            } catch (error) {
                // Ignore errors
            }
        }
    }

    // FIRST: Try to atomically create the starting file
    // This is the critical section - only ONE process should succeed
    let weAreStarting = false;
    try {
        const fd = openSync(startingFile, "wx");
        closeSync(fd);
        writeFileSync(startingFile, process.pid.toString(), "utf-8");
        weAreStarting = true;
    } catch (error) {
        // Another process created the starting file first - we'll wait for it
        weAreStarting = false;
    }

    // If we didn't win the race, wait for the other process
    if (!weAreStarting) {
        const lockAppeared = await waitForLockFile(10000); // Wait up to 10 seconds
        if (lockAppeared) {
            const connectionString = readFileSync(lockFile, "utf-8");
            const isAlive = await verifyConnection(connectionString);
            if (isAlive) {
                process.env.MONGO_URL = connectionString;
                return;
            }
        }
        // If we get here, something went wrong - but don't try to start our own container
        // Just fail and let the tests handle it
        return;
    }

    // Check if lock file already exists (maybe from a previous run)
    if (existsSync(lockFile)) {
        const connectionString = readFileSync(lockFile, "utf-8");
        const isAlive = await verifyConnection(connectionString);
        if (isAlive) {
            process.env.MONGO_URL = connectionString;
            // Remove our starting file since we're not actually starting
            try {
                unlinkSync(startingFile);
            } catch (error) {
                // Ignore
            }
            return;
        }
        // Connection failed - remove stale lock file
        try {
            unlinkSync(lockFile);
        } catch (error) {
            // Ignore errors
        }
    }

    try {
        console.log("🚀 Starting MongoDB testcontainer...");
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

        console.log(`✅ MongoDB testcontainer ready on port 27018`);
    } catch (error) {
        // Check if this is a port allocation error (container already running)
        if (error instanceof Error && error.message.includes("port is already allocated")) {
            // Container is already running, try to read from lock file
            if (existsSync(lockFile)) {
                const connectionString = readFileSync(lockFile, "utf-8");
                const isAlive = await verifyConnection(connectionString);
                if (isAlive) {
                    process.env.MONGO_URL = connectionString;
                    return; // Successfully recovered
                }
            }
            // If no lock file or connection dead, re-throw the error
            throw error;
        }
        console.error("❌ Failed to start MongoDB testcontainer:", error);

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
        try {
            await container.stop();
            // Remove lock file and starting file
            if (existsSync(lockFile)) {
                unlinkSync(lockFile);
            }
            if (existsSync(startingFile)) {
                unlinkSync(startingFile);
            }
        } catch (error) {
            console.error("❌ Failed to stop MongoDB testcontainer:", error);
            // Don't re-throw - we want cleanup to continue even if stop fails
        }
    }
}

// Execute setup when module is imported
try {
    await setup();
} catch (error) {
    // If setup fails and it's not a port allocation error, re-throw
    // Port allocation errors mean the container is already running from a previous test
    if (error instanceof Error && error.message.includes("port is already allocated")) {
        // Silently ignore - container is already running, which is fine
        // We'll use the existing MONGO_URL that should already be set
    } else {
        // Re-throw other errors as they indicate real problems
        throw error;
    }
}

// Register teardown handlers for graceful shutdown
process.on("exit", () => {
    // Note: exit event doesn't support async, so we can't await here
    // But testcontainers should handle cleanup on process exit
    // DO NOT remove lock file here - it needs to persist for other test processes
    // The lock file will be cleaned up by the SIGINT/SIGTERM handlers
});

// Handle SIGINT and SIGTERM for clean shutdowns
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
        await teardown();
        process.exit(0);
    });
}
