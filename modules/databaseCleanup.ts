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

    // The cleanup currently in flight, so stop() can wait it out rather than leaving callers to
    // close the db / exit underneath it.
    private currentRun: Promise<void> | null = null;

    /** Whether a cleanup is currently in flight. */
    get isCleanupRunning(): boolean {
        return this.isRunning;
    }

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
        this.currentRun = this.runCleanup().catch((err) => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error(`Initial database cleanup failed: ${errorMsg}`);
        });

        // Then schedule regular cleanups
        this.cleanupInterval = setInterval(() => {
            this.currentRun = this.runCleanup().catch((err) => {
                const errorMsg = err instanceof Error ? err.message : String(err);
                logger.error(`Scheduled database cleanup failed: ${errorMsg}`);
            });
        }, intervalMs);

        logger.log(`Database cleanup scheduled every ${intervalHours} hours`);
    }

    /**
     * Stop the automated cleanup schedule
     */
    async stop(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.log("Database cleanup schedule stopped");
        }

        // Let an in-flight cleanup finish its deletes before the caller closes the db and exits.
        await this.currentRun;
        this.currentRun = null;
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
            logger.log(`cleanEmptyRosters: ${await this.cleanEmptyRosters()}`);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.log(`Database cleanup complete in ${duration}s`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error(`Database cleanup encountered an error: ${errorMsg}`);
            throw err;
        } finally {
            this.isRunning = false;
        }
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
     * Manual cleanup trigger (useful for testing or admin commands)
     */
    async runManualCleanup(): Promise<void> {
        await this.runCleanup();
    }
}

// Export singleton instance
const databaseCleanup = new DatabaseCleanup();
export default databaseCleanup;
