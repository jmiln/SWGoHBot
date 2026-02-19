import type { StartedMongoDBContainer } from "@testcontainers/mongodb";
import { MongoDBContainer } from "@testcontainers/mongodb";

let container: StartedMongoDBContainer | undefined;

export async function globalSetup(): Promise<void> {
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
        }
    }
}
