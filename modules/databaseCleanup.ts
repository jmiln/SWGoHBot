import { env } from "../config/config.ts";
import cache from "./cache.ts";
import logger from "./Logger.ts";

/**
 * MongoDB cleanup utilities
 * Automated version of the .mongoshrc.js cleanup functions
 */
class DatabaseCleanup {
    private cleanupInterval: NodeJS.Timeout | null = null;
    private isRunning = false;

    /**
     * Start automated cleanup on a schedule
     * @param intervalHours - Hours between cleanup runs (default: 24)
     */
    start(intervalHours = 24): void {
        if (this.cleanupInterval) {
            logger.warn("Database cleanup already scheduled");
            return;
        }

        const intervalMs = intervalHours * 60 * 60 * 1000;

        // Run immediately on startup
        this.runCleanup().catch((err) => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error(`Initial database cleanup failed: ${errorMsg}`);
        });

        // Then schedule regular cleanups
        this.cleanupInterval = setInterval(() => {
            this.runCleanup().catch((err) => {
                const errorMsg = err instanceof Error ? err.message : String(err);
                logger.error(`Scheduled database cleanup failed: ${errorMsg}`);
            });
        }, intervalMs);

        logger.log(`Database cleanup scheduled every ${intervalHours} hours`);
    }

    /**
     * Stop the automated cleanup schedule
     */
    stop(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.log("Database cleanup schedule stopped");
        }
    }

    /**
     * Run all cleanup tasks
     */
    private async runCleanup(): Promise<void> {
        if (this.isRunning) {
            logger.warn("Database cleanup already in progress, skipping...");
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            logger.log("Starting database cleanup...");

            const results = await Promise.allSettled([this.cleanOldPlayerStats(), this.cleanOldGuilds(), this.cleanEmptyRosters()]);

            // Log results
            let successCount = 0;
            let failCount = 0;

            for (const [index, result] of results.entries()) {
                const taskName = ["cleanOldPlayerStats", "cleanOldGuilds", "cleanEmptyRosters"][index];

                if (result.status === "fulfilled") {
                    successCount++;
                    logger.log(`${taskName}: ${result.value}`);
                } else {
                    failCount++;
                    const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
                    logger.error(`${taskName} failed: ${errorMsg}`);
                }
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.log(`Database cleanup complete in ${duration}s (${successCount} succeeded, ${failCount} failed)`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error(`Database cleanup encountered an error: ${errorMsg}`);
            throw err;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Remove player stats older than specified days
     * @param daysOld - Age threshold in days (default: 7)
     * @returns Deletion summary
     */
    async cleanOldPlayerStats(daysOld = 7): Promise<string> {
        const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

        const result = await cache.delete(env.MONGODB_SWAPI_DB, "playerStats", {
            updated: { $lt: cutoffTime },
        });

        return `Deleted ${result.deletedCount} player records older than ${daysOld} days`;
    }

    /**
     * Remove guild data older than specified days
     * @param daysOld - Age threshold in days (default: 7)
     * @returns Deletion summary
     */
    async cleanOldGuilds(daysOld = 7): Promise<string> {
        const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

        const result = await cache.delete(env.MONGODB_SWAPI_DB, "guilds", {
            updated: { $lt: cutoffTime },
        });

        return `Deleted ${result.deletedCount} guild records older than ${daysOld} days`;
    }

    /**
     * Remove player records with empty rosters
     * @returns Deletion summary
     */
    async cleanEmptyRosters(): Promise<string> {
        const result = await cache.delete(env.MONGODB_SWAPI_DB, "playerStats", {
            roster: { $size: 0 },
        });

        return `Deleted ${result.deletedCount} player records with empty rosters`;
    }

    /**
     * Get cleanup statistics without deleting
     * @returns Statistics about records that would be cleaned
     */
    async getCleanupStats(daysOld = 7): Promise<{
        oldPlayerStats: number;
        oldGuilds: number;
        emptyRosters: number;
        totalToClean: number;
    }> {
        const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

        const [oldPlayerStats, oldGuilds, emptyRosters] = await Promise.all([
            cache.count(env.MONGODB_SWAPI_DB, "playerStats", { updated: { $lt: cutoffTime } }),
            cache.count(env.MONGODB_SWAPI_DB, "guilds", { updated: { $lt: cutoffTime } }),
            cache.count(env.MONGODB_SWAPI_DB, "playerStats", { roster: { $size: 0 } }),
        ]);

        return {
            oldPlayerStats,
            oldGuilds,
            emptyRosters,
            totalToClean: oldPlayerStats + oldGuilds + emptyRosters,
        };
    }

    /**
     * Manual cleanup trigger (useful for testing or admin commands)
     */
    async runManualCleanup(): Promise<void> {
        await this.runCleanup();
    }
}

// Export singleton instance
const databaseCleanup = new DatabaseCleanup();
export default databaseCleanup;
