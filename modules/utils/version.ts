import { readFileSync } from "node:fs";

const version: string = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;

export function getPackageVersion(): string {
    return version;
}
