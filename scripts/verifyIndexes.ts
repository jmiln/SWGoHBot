#!/usr/bin/env node
/**
 * MongoDB Index Verification and Creation Script
 *
 * This script:
 * 1. Reads the index configuration from config/indexes.ts
 * 2. Connects to MongoDB
 * 3. Checks each collection for required indexes
 * 4. Creates any missing indexes
 * 5. Reports on the status of all indexes
 *
 * Usage:
 *   node --experimental-strip-types scripts/verifyIndexes.ts [--create] [--drop-unused] [--dry-run]
 *
 * Options:
 *   --create        Create missing indexes (default: true)
 *   --drop-unused   Drop indexes not in config (default: false, USE WITH CAUTION)
 *   --dry-run       Show what would be done without making changes
 */

import type { Db, IndexDescription, IndexDirection, MongoClient } from "mongodb";
import { env } from "../config/config.ts";
import indexConfig, { type IndexDefinition } from "../config/indexes.ts";
import cache from "../modules/cache.ts";
import logger from "../modules/Logger.ts";

interface IndexStatus {
    database: string;
    collection: string;
    indexName: string;
    status: "exists" | "created" | "failed" | "would_create" | "extra";
    error?: string;
    details?: string;
}

class IndexVerifier {
    private mongo!: MongoClient;
    private results: IndexStatus[] = [];
    private createIndexes = true;
    private dropUnused = false;
    private dryRun = false;

    constructor() {
        // Parse command line arguments
        const args = process.argv.slice(2);
        this.createIndexes = !args.includes("--no-create");
        this.dropUnused = args.includes("--drop-unused");
        this.dryRun = args.includes("--dry-run");

        if (this.dryRun) {
            logger.info("[IndexVerifier] Running in DRY RUN mode - no changes will be made");
        }
    }

    async init(mongoClient: MongoClient): Promise<void> {
        this.mongo = mongoClient;
    }

    /**
     * Normalize index for comparison
     * MongoDB may return indexes in slightly different formats
     */
    private normalizeIndexKey(key: Record<string, IndexDirection> | Map<string, IndexDirection>): string {
        if (key instanceof Map) {
            return JSON.stringify(Object.fromEntries(key));
        }
        return JSON.stringify(key);
    }

    /**
     * Check if an index exists in the collection
     */
    private indexExists(existingIndexes: IndexDescription[], targetIndex: IndexDefinition): IndexDescription | undefined {
        const targetKeyStr = this.normalizeIndexKey(targetIndex.key);
        return existingIndexes.find((idx) => {
            const existingKeyStr = this.normalizeIndexKey(idx.key);
            return existingKeyStr === targetKeyStr;
        });
    }

    /**
     * Verify and create indexes for a single collection
     */
    private async verifyCollectionIndexes(
        dbName: string,
        collectionName: string,
        requiredIndexes: IndexDefinition[],
    ): Promise<void> {
        logger.info(`[IndexVerifier] Checking collection: ${dbName}.${collectionName}`);

        const db: Db = this.mongo.db(dbName);
        const collection = db.collection(collectionName);

        // Get existing indexes
        let existingIndexes: IndexDescription[];
        try {
            existingIndexes = await collection.listIndexes().toArray();
        } catch (err) {
            // Collection might not exist yet
            logger.warn(`[IndexVerifier] Collection ${dbName}.${collectionName} does not exist yet`);
            existingIndexes = [];
        }

        // Check each required index
        for (const requiredIndex of requiredIndexes) {
            const indexName = requiredIndex.options?.name || this.generateIndexName(requiredIndex.key);
            const existing = this.indexExists(existingIndexes, requiredIndex);

            if (existing) {
                // Index exists
                this.results.push({
                    database: dbName,
                    collection: collectionName,
                    indexName: indexName,
                    status: "exists",
                });
            } else {
                // Index is missing
                if (this.dryRun) {
                    this.results.push({
                        database: dbName,
                        collection: collectionName,
                        indexName: indexName,
                        status: "would_create",
                        details: JSON.stringify(requiredIndex),
                    });
                } else if (this.createIndexes) {
                    try {
                        await collection.createIndex(requiredIndex.key, requiredIndex.options);
                        this.results.push({
                            database: dbName,
                            collection: collectionName,
                            indexName: indexName,
                            status: "created",
                        });
                        logger.info(`[IndexVerifier] Created index: ${indexName} on ${dbName}.${collectionName}`);
                    } catch (err) {
                        this.results.push({
                            database: dbName,
                            collection: collectionName,
                            indexName: indexName,
                            status: "failed",
                            error: err instanceof Error ? err.message : String(err),
                        });
                        logger.error(`[IndexVerifier] Failed to create index ${indexName}: ${err}`);
                    }
                } else {
                    this.results.push({
                        database: dbName,
                        collection: collectionName,
                        indexName: indexName,
                        status: "would_create",
                        details: "Use --create to create this index",
                    });
                }
            }
        }

        // Check for extra indexes if --drop-unused is set
        if (this.dropUnused) {
            const requiredIndexKeys = requiredIndexes.map((idx) => this.normalizeIndexKey(idx.key));
            for (const existingIndex of existingIndexes) {
                // Skip the default _id index
                if (existingIndex.name === "_id_") continue;

                const existingKeyStr = this.normalizeIndexKey(existingIndex.key);
                if (!requiredIndexKeys.includes(existingKeyStr)) {
                    this.results.push({
                        database: dbName,
                        collection: collectionName,
                        indexName: existingIndex.name || "unknown",
                        status: "extra",
                        details: this.dryRun
                            ? "Would be dropped with --drop-unused"
                            : `Extra index: ${JSON.stringify(existingIndex.key)}`,
                    });

                    if (!this.dryRun && existingIndex.name) {
                        try {
                            await collection.dropIndex(existingIndex.name);
                            logger.warn(`[IndexVerifier] Dropped extra index: ${existingIndex.name} on ${dbName}.${collectionName}`);
                        } catch (err) {
                            logger.error(`[IndexVerifier] Failed to drop index ${existingIndex.name}: ${err}`);
                        }
                    }
                }
            }
        }
    }

    /**
     * Generate a default index name from the key
     */
    private generateIndexName(key: Record<string, IndexDirection>): string {
        return Object.entries(key)
            .map(([field, direction]) => `${field}_${direction}`)
            .join("_");
    }

    /**
     * Verify all indexes from the configuration
     */
    async verifyAll(): Promise<void> {
        logger.info("[IndexVerifier] Starting index verification...");

        for (const [dbName, collections] of Object.entries(indexConfig)) {
            for (const [collectionName, indexes] of Object.entries(collections)) {
                await this.verifyCollectionIndexes(dbName, collectionName, indexes);
            }
        }
    }

    /**
     * Generate a summary report
     */
    generateReport(): void {
        logger.info("\n========================================");
        logger.info("Index Verification Report");
        logger.info("========================================\n");

        const summary = {
            exists: 0,
            created: 0,
            failed: 0,
            would_create: 0,
            extra: 0,
        };

        // Group by database and collection
        const byDatabase: Record<string, Record<string, IndexStatus[]>> = {};
        for (const result of this.results) {
            if (!byDatabase[result.database]) {
                byDatabase[result.database] = {};
            }
            if (!byDatabase[result.database][result.collection]) {
                byDatabase[result.database][result.collection] = [];
            }
            byDatabase[result.database][result.collection].push(result);
            summary[result.status]++;
        }

        // Print results by database
        for (const [dbName, collections] of Object.entries(byDatabase)) {
            logger.info(`Database: ${dbName}`);
            for (const [collectionName, indexes] of Object.entries(collections)) {
                logger.info(`  Collection: ${collectionName}`);
                for (const idx of indexes) {
                    const statusIcon =
                        idx.status === "exists"
                            ? "✓"
                            : idx.status === "created"
                              ? "+"
                              : idx.status === "would_create"
                                ? "?"
                                : idx.status === "extra"
                                  ? "!"
                                  : "✗";
                    logger.info(`    ${statusIcon} ${idx.indexName} [${idx.status}]`);
                    if (idx.error) {
                        logger.error(`      Error: ${idx.error}`);
                    }
                    if (idx.details) {
                        logger.info(`      ${idx.details}`);
                    }
                }
            }
            logger.info("");
        }

        // Print summary
        logger.info("========================================");
        logger.info("Summary:");
        logger.info(`  ✓ Existing indexes: ${summary.exists}`);
        logger.info(`  + Created indexes: ${summary.created}`);
        logger.info(`  ✗ Failed to create: ${summary.failed}`);
        logger.info(`  ? Would create: ${summary.would_create}`);
        logger.info(`  ! Extra indexes: ${summary.extra}`);
        logger.info("========================================\n");

        if (this.dryRun) {
            logger.info("This was a DRY RUN. No changes were made.");
            logger.info("Run without --dry-run to apply changes.\n");
        }
    }

    /**
     * Exit with appropriate code
     */
    getExitCode(): number {
        const hasFailed = this.results.some((r) => r.status === "failed");
        const hasMissing = this.results.some((r) => r.status === "would_create");

        if (hasFailed) return 1;
        if (hasMissing && !this.createIndexes) return 2;
        return 0;
    }
}

/**
 * Main execution
 */
async function main() {
    const verifier = new IndexVerifier();

    try {
        // Connect to MongoDB
        logger.info("[IndexVerifier] Connecting to MongoDB...");
        const { MongoClient } = await import("mongodb");
        const mongoClient = new MongoClient(env.MONGODB_URL);
        await mongoClient.connect();

        // Initialize cache with mongo client
        cache.init(mongoClient);

        // Initialize verifier
        await verifier.init(mongoClient);

        // Verify all indexes
        await verifier.verifyAll();

        // Generate report
        verifier.generateReport();

        // Close connection
        await mongoClient.close();

        // Exit with appropriate code
        process.exit(verifier.getExitCode());
    } catch (err) {
        logger.error(`[IndexVerifier] Fatal error: ${err}`);
        process.exit(1);
    }
}

main();
