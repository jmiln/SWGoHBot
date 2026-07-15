import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { type CounterMetadata, type CounterMetadataFile, CounterMetadataFileSchema } from "../../schemas/counters.schema.ts";
import logger from "../Logger.ts";
import type { Mode } from "./gahistoryClient.ts";

export const META_FILE = path.join(import.meta.dirname, "counterMetadata.json");

async function readMetaFile(file: string): Promise<CounterMetadataFile> {
    let raw: string;
    try {
        raw = await readFile(file, "utf8");
    } catch {
        return {};
    }
    try {
        const parsed = CounterMetadataFileSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
        logger.warn(`[counterMetadata] ${file} failed validation; treating as not yet ingested`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[counterMetadata] ${file} is not valid JSON (${msg}); treating as not yet ingested`);
    }
    return {};
}

export async function readMetadata(mode: Mode, file: string = META_FILE): Promise<CounterMetadata | null> {
    return (await readMetaFile(file))[mode] ?? null;
}

export async function writeMetadata(mode: Mode, entry: CounterMetadata, file: string = META_FILE): Promise<void> {
    // Read-modify-write: the modes ingest sequentially and must not clobber each other's entry.
    const current = await readMetaFile(file);
    await writeFile(file, `${JSON.stringify({ ...current, [mode]: entry }, null, 4)}\n`);
}
