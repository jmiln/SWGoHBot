import { chown, copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

// Baked into the image by the Dockerfile. /app/data is the bind mount that masks the image's own
// copy, which is why the pristine set has to live at a sibling path.
const SOURCE_ROOT = "/app/data-dist";
const DEST_ROOT = "/app/data";
const DEFAULT_UID = 1000;
const DEFAULT_GID = 1000;

export interface SeedResult {
    seeded: string[];
    kept: number;
}

async function exists(target: string): Promise<boolean> {
    try {
        await stat(target);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
    }
}

/**
 * Copy every file under sourceRoot that has no counterpart under destRoot. Existing files are left
 * exactly as they are, whatever their contents: the destination is the live data directory, and
 * dataUpdater's output must outrank the older copy baked into the image.
 */
export async function seedMissingFiles(sourceRoot: string, destRoot: string): Promise<SeedResult> {
    const seeded: string[] = [];
    let kept = 0;

    const walk = async (relativeDir: string): Promise<void> => {
        const entries = await readdir(path.join(sourceRoot, relativeDir), { withFileTypes: true });
        for (const entry of entries) {
            const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
            const destination = path.join(destRoot, relative);
            if (entry.isDirectory()) {
                await walk(relative);
                continue;
            }
            if (await exists(destination)) {
                kept++;
                continue;
            }
            await mkdir(path.dirname(destination), { recursive: true });
            await copyFile(path.join(sourceRoot, relative), destination);
            seeded.push(relative);
        }
    };

    await walk("");
    return { seeded, kept };
}

/**
 * Hand the seeded files to the uid the runtime containers use, so a later dataUpdater run can
 * rewrite them. Only paths this run created are touched. The mount root is chowned only when it is
 * still owned by root, which means Docker created it for this mount; a real checkout's directory
 * belongs to whoever cloned it and is left alone.
 */
export async function applyOwnership(destRoot: string, seeded: string[], uid: number, gid: number): Promise<void> {
    const rootStat = await stat(destRoot);
    if (rootStat.uid === 0) await chown(destRoot, uid, gid);

    const directories = new Set<string>();
    for (const relative of seeded) {
        await chown(path.join(destRoot, relative), uid, gid);
        let parent = path.dirname(relative);
        while (parent && parent !== ".") {
            directories.add(parent);
            parent = path.dirname(parent);
        }
    }
    for (const relative of directories) {
        await chown(path.join(destRoot, relative), uid, gid);
    }
}

function numberFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

async function main(): Promise<void> {
    const uid = numberFromEnv("DATA_UID", DEFAULT_UID);
    const gid = numberFromEnv("DATA_GID", DEFAULT_GID);

    const { seeded, kept } = await seedMissingFiles(SOURCE_ROOT, DEST_ROOT);
    if (seeded.length) await applyOwnership(DEST_ROOT, seeded, uid, gid);

    // console rather than modules/Logger.ts on purpose: importing it reaches data/constants/units.ts,
    // which reads characters.json at module scope - the file this script may be about to create.
    console.log(`[seedData] seeded ${seeded.length} file(s), kept ${kept} already present`);
}

// Guarded so importing this module from a test does not run the seed against the container paths.
if (await exists(SOURCE_ROOT)) await main();
