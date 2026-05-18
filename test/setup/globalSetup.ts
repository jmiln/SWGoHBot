import type { StartedMongoDBContainer } from "@testcontainers/mongodb";
import { MongoDBContainer } from "@testcontainers/mongodb";

let container: StartedMongoDBContainer | undefined;

export async function globalSetup(): Promise<void> {
    // Prevent modules with top-level side effects (e.g. dataUpdater init()) from
    // running during tests. Set before any test file is loaded.
    process.env.TESTING_ENV = "1";

    // Stub required config vars with safe dummy values when not already set by .env.
    // Pure-function tests don't use these at runtime; they're only needed to satisfy
    // Zod validation when config.ts is first imported.
    process.env.DISCORD_OWNER_ID ??= "000000000000000001";
    process.env.DISCORD_CLIENT_ID ??= "000000000000000002";
    process.env.DISCORD_TOKEN ??= "test.token.stub";
    process.env.MONGODB_URL ??= "mongodb://localhost:27018";
    process.env.SWAPI_STATCALC_URL ??= "http://localhost:3000";
    process.env.SWAPI_CLIENT_URL ??= "http://localhost:3001";
    process.env.SWAPI_ACCESS_KEY ??= "test-access-key";
    process.env.SWAPI_SECRET_KEY ??= "test-secret-key";

    if (process.env.MONGO_URL) {
        return;
    }

    console.log("🚀 Starting MongoDB testcontainer...");
    container = await new MongoDBContainer("mongo:7.0")
        .withExposedPorts({ container: 27017, host: 27018 })
        .start();

    const connectionString = `${container.getConnectionString()}?directConnection=true`;
    process.env.MONGO_URL = connectionString;
    console.log("✅ MongoDB testcontainer ready on port 27018");
}

export async function globalTeardown(): Promise<void> {
    if (container) {
        try {
            await container.stop();
        } catch (error) {
            console.error("❌ Failed to stop MongoDB testcontainer:", error);
        } finally {
            container = undefined;
            delete process.env.MONGO_URL;
            console.log("✅ MongoDB testcontainer stopped");
        }
    }
}
