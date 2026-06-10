import { type Document, type Filter, MongoClient } from "mongodb";
import { env } from "../config/config.ts";
import logger from "../modules/Logger.ts";

/**
 * Migrates arena player data out of embedded userConfig documents into a dedicated
 * arenaPlayers collection.
 *
 * Old shape:
 *   user.accounts = [{ allyCode, name, primary, lastCharRank, lastShipRank, charHist, shipHist, ... }]
 *   user.arenaWatch.allyCodes[*].name / .lastChar / .lastShip / .charHist / .shipHist
 *
 * New shape:
 *   user.accounts = [allyCode, ...]           (flat number array)
 *   user.primaryAllyCode = number | null
 *   arenaPlayers collection: { allyCode, name, lastCharRank, lastShipRank, ... }
 */

// Match any doc still carrying old-format embedded player data: object entries in
// accounts, OR arenaWatch entries with player-data fields (covers arenaWatch-only
// users whose accounts array is empty or already flat)
export const oldFormatUserFilter: Filter<Document> = {
    $or: [
        { "accounts.0": { $type: "object" } },
        { "arenaWatch.allyCodes": { $elemMatch: { $or: [{ name: { $exists: true } }, { lastChar: { $exists: true } }, { lastShip: { $exists: true } }] } } },
    ],
};

export async function runMigration(client: MongoClient): Promise<{ found: number; converted: number; failed: number }> {
    const db = client.db(env.MONGODB_SWGOHBOT_DB);
    const users = db.collection("users");
    const arenaPlayers = db.collection("arenaPlayers");

    const cursor = users.find(oldFormatUserFilter);

    let found = 0;
    let converted = 0;
    let failed = 0;

    for await (const doc of cursor) {
        found++;
        try {
            const playerUpserts: Map<number, Record<string, unknown>> = new Map();

            // --- Extract from accounts ---
            const oldAccounts = (doc.accounts ?? []) as Array<Record<string, unknown> | number>;
            const newAccounts: number[] = [];
            let primaryAllyCode: number | null = (doc.primaryAllyCode as number | undefined) ?? null;

            for (const acct of oldAccounts) {
                // Already-flat entries (number ally codes) pass through untouched
                if (typeof acct === "number") {
                    newAccounts.push(acct);
                    continue;
                }

                const allyCode = Number(acct.allyCode);
                if (Number.isNaN(allyCode)) continue;

                newAccounts.push(allyCode);
                if (acct.primary) primaryAllyCode = allyCode;

                const existing = playerUpserts.get(allyCode) ?? { allyCode };
                if (typeof acct.name === "string" && acct.name) existing.name = acct.name;
                if (acct.lastCharRank != null) existing.lastCharRank = acct.lastCharRank;
                if (acct.lastCharClimb != null) existing.lastCharClimb = acct.lastCharClimb;
                if (acct.lastShipRank != null) existing.lastShipRank = acct.lastShipRank;
                if (acct.lastShipClimb != null) existing.lastShipClimb = acct.lastShipClimb;
                if (Array.isArray(acct.charHist) && acct.charHist.length) existing.charHist = acct.charHist;
                if (Array.isArray(acct.shipHist) && acct.shipHist.length) existing.shipHist = acct.shipHist;
                playerUpserts.set(allyCode, existing);
            }

            if (!primaryAllyCode && newAccounts.length) primaryAllyCode = newAccounts[0];

            // --- Extract from arenaWatch.allyCodes ---
            const aw = doc.arenaWatch as Record<string, unknown> | undefined;
            const awAllyCodes = Array.isArray(aw?.allyCodes) ? (aw.allyCodes as Array<Record<string, unknown>>) : [];
            const newAwAllyCodes: Array<Record<string, unknown>> = [];

            for (const entry of awAllyCodes) {
                const allyCode = Number(entry.allyCode);
                if (!Number.isNaN(allyCode)) {
                    const existing = playerUpserts.get(allyCode) ?? { allyCode };
                    if (typeof entry.name === "string" && entry.name) existing.name = entry.name;
                    // arenaWatch used lastChar/lastShip (not lastCharRank/lastShipRank)
                    if (entry.lastChar != null) existing.lastCharRank = entry.lastChar;
                    if (entry.lastShip != null) existing.lastShipRank = entry.lastShip;
                    if (entry.lastCharChange != null) existing.lastCharChange = entry.lastCharChange;
                    if (entry.lastShipChange != null) existing.lastShipChange = entry.lastShipChange;
                    if (Array.isArray(entry.charHist) && entry.charHist.length) existing.charHist = entry.charHist;
                    if (Array.isArray(entry.shipHist) && entry.shipHist.length) existing.shipHist = entry.shipHist;
                    playerUpserts.set(allyCode, existing);
                }

                // Rebuild allyCodes entry without player-data fields. Only carry over keys
                // that are actually present — an absent poOffset must not be written as null.
                const cleanEntry: Record<string, unknown> = { allyCode: entry.allyCode };
                if (entry.poOffset != null) cleanEntry.poOffset = entry.poOffset;
                if (entry.mention != null) cleanEntry.mention = entry.mention;
                if (entry.mark != null) cleanEntry.mark = entry.mark;
                if (entry.warn != null) cleanEntry.warn = entry.warn;
                if (entry.result != null) cleanEntry.result = entry.result;
                newAwAllyCodes.push(cleanEntry);
            }

            // --- Write arenaPlayers ---
            if (playerUpserts.size) {
                const ops = Array.from(playerUpserts.values()).map((p) => ({
                    updateOne: {
                        filter: { allyCode: p.allyCode },
                        update: { $set: p },
                        upsert: true,
                    },
                }));
                await arenaPlayers.bulkWrite(ops);
            }

            // --- Update user document ---
            const updateFields: Record<string, unknown> = {
                accounts: newAccounts,
                primaryAllyCode,
            };
            if (aw && awAllyCodes.length) {
                updateFields["arenaWatch.allyCodes"] = newAwAllyCodes;
            }
            await users.updateOne({ _id: doc._id }, { $set: updateFields });
            converted++;
        } catch (err) {
            logger.error(`Failed to migrate doc ${String(doc._id)}: ${err instanceof Error ? err.message : String(err)}`);
            failed++;
        }
    }

    logger.info(`Migration complete — found: ${found}, converted: ${converted}, failed: ${failed}`);
    return { found, converted, failed };
}

async function main() {
    const client = new MongoClient(env.MONGODB_URL);
    await client.connect();
    try {
        await runMigration(client);
    } finally {
        await client.close();
    }
}

// Only run when executed directly (node scripts/migrateArenaPlayers.ts), not when imported
if (import.meta.main) {
    main().catch((err) => {
        logger.error(`Migration failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
    });
}
