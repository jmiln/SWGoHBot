import { MongoClient } from 'mongodb';
import { UserConfigSchema } from "../schemas/users.schema.ts";

const url = process.env.MONGODB_URL;
const dbName = process.env.MONGODB_SWGOHBOT_DB;
const DRY_RUN = false;

async function migrate() {
    if (!url || !dbName) throw new Error("Missing ENV variables");
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('users');

        const pipeline: any[] = [
            {
                $set: {
                    "accounts": {
                        $map: {
                            input: "$accounts",
                            as: "acc",
                            in: { $mergeObjects: ["$$acc", { allyCode: "$$acc.allycode" }] }
                        }
                    },
                    // Only attempt to map allyCodes if the array exists
                    "arenaWatch.allyCodes": {
                        $cond: {
                            if: { $isArray: "$arenaWatch.allycodes" },
                            then: {
                                $map: {
                                    input: "$arenaWatch.allycodes",
                                    as: "aw",
                                    in: { $mergeObjects: ["$$aw", { allyCode: "$$aw.allycode" }] }
                                }
                            },
                            else: "$$REMOVE"
                        }
                    },
                    // Use $cond to only set if the old field exists
                    "guildUpdate.allyCode": { $ifNull: ["$guildUpdate.allycode", "$$REMOVE"] },
                    "guildTickets.allyCode": { $ifNull: ["$guildTickets.allycode", "$$REMOVE"] }
                }
            },
            {
                $unset: [
                    "accounts.allycode",
                    "arenaWatch.allycodes",
                    "guildUpdate.allycode",
                    "guildTickets.allycode"
                ]
            }
        ];

        if (DRY_RUN) {
            console.log("--- DRY RUN: Validating first document against Zod ---");
            const sampleDocs = await collection.aggregate(pipeline).limit(1).toArray();

            if (sampleDocs.length > 0) {
                const validation = UserConfigSchema.safeParse(sampleDocs[0]);
                if (validation.success) {
                    console.log("✅ Validation Success: Result matches the new Schema.");
                    console.log(JSON.stringify(sampleDocs[0], null, 2));
                } else {
                    console.error("❌ Validation Failed! Schema mismatch:");
                    console.error(validation.error);
                }
            }
            console.log("\nNo changes committed to DB.");
        } else {
            const result = await collection.updateMany({}, pipeline);
            console.log(`✅ Success: Migrated ${result.modifiedCount} documents.`);
        }
    } finally {
        await client.close();
    }
}

migrate();
