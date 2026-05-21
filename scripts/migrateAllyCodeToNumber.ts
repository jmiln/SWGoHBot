import { MongoClient } from "mongodb";
import { env } from "../config/config.ts";
import logger from "../modules/Logger.ts";

async function migrate() {
    const client = new MongoClient(env.MONGODB_URL);
    await client.connect();

    try {
        const db = client.db(env.MONGODB_SWGOHBOT_DB);
        const users = db.collection("users");

        const cursor = users.find({ "accounts.allyCode": { $type: "string" } });
        let found = 0;
        let converted = 0;
        let failed = 0;

        for await (const doc of cursor) {
            found++;
            let modified = false;
            const updatedAccounts = (doc.accounts as Array<{ allyCode: unknown }>).map((account) => {
                if (typeof account.allyCode === "string") {
                    const parsed = Number.parseInt(account.allyCode, 10);
                    if (!Number.isNaN(parsed)) {
                        modified = true;
                        return { ...account, allyCode: parsed };
                    }
                }
                return account;
            });

            if (modified) {
                try {
                    await users.updateOne({ _id: doc._id }, { $set: { accounts: updatedAccounts } });
                    converted++;
                } catch (err) {
                    logger.error(`Failed to update doc ${String(doc._id)}: ${err instanceof Error ? err.message : String(err)}`);
                    failed++;
                }
            }
        }

        logger.info(`Migration complete — found: ${found}, converted: ${converted}, failed: ${failed}`);
    } finally {
        await client.close();
    }
}

migrate().catch((err) => {
    logger.error(`Migration failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});
