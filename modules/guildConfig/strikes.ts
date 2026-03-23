import type { GuildConfig, PlayerStrikes, Strike } from "../../types/guildConfig_types.ts";
import { guildConfigDB } from "./db.ts";

export function getActiveStrikes(strikes: Strike[], now = Date.now()): Strike[] {
    return strikes.filter((s) => s.removedAt === undefined && (s.expiresAt === undefined || s.expiresAt > now));
}

export async function getPlayerStrikes({ guildId, allyCode }: { guildId: string; allyCode: number }): Promise<PlayerStrikes | null> {
    const res = await guildConfigDB.getOne<GuildConfig>({ guildId }, { strikes: 1, _id: 0 });
    const record = (res?.strikes ?? []).find((p) => p.allyCode === allyCode);
    return record ?? null;
}

export async function getAllStrikes({ guildId }: { guildId: string }): Promise<PlayerStrikes[]> {
    const res = await guildConfigDB.getOne<GuildConfig>({ guildId }, { strikes: 1, _id: 0 });
    return res?.strikes ?? [];
}

export async function addStrike({
    guildId,
    playerInfo,
    strike,
}: {
    guildId: string;
    playerInfo: Omit<PlayerStrikes, "strikes">;
    strike: Strike;
}): Promise<void> {
    const allStrikes = await getAllStrikes({ guildId });
    const existingIndex = allStrikes.findIndex((p) => p.allyCode === playerInfo.allyCode);

    if (existingIndex >= 0) {
        // Refresh name/guild in case player renamed or switched guilds since last strike
        allStrikes[existingIndex].playerName = playerInfo.playerName;
        allStrikes[existingIndex].guildId = playerInfo.guildId;
        allStrikes[existingIndex].guildName = playerInfo.guildName;
        allStrikes[existingIndex].strikes.push(strike);
    } else {
        allStrikes.push({ ...playerInfo, strikes: [strike] });
    }

    // The `as never` cast is required because guildConfigDB.put is typed generically.
    // This pattern is established throughout modules/guildConfig/*.ts.
    await guildConfigDB.put({ guildId }, { strikes: allStrikes } as never, false);
}

export async function revokeStrike({
    guildId,
    allyCode,
    strikeId,
    revokedBy,
}: {
    guildId: string;
    allyCode: number;
    strikeId: string;
    revokedBy: string;
}): Promise<"revoked" | "not_found" | "no_player" | "already_revoked"> {
    const allStrikes = await getAllStrikes({ guildId });
    const playerIndex = allStrikes.findIndex((p) => p.allyCode === allyCode);

    if (playerIndex < 0) return "no_player";

    const strikeIndex = allStrikes[playerIndex].strikes.findIndex((s) => s.id === strikeId);
    if (strikeIndex < 0) return "not_found";

    const strike = allStrikes[playerIndex].strikes[strikeIndex];
    if (strike.removedAt !== undefined) return "already_revoked";

    strike.removedAt = Date.now();
    strike.removedBy = revokedBy;

    await guildConfigDB.put({ guildId }, { strikes: allStrikes } as never, false);
    return "revoked";
}

export async function clearStrikes({ guildId, allyCode }: { guildId: string; allyCode: number }): Promise<boolean> {
    const allStrikes = await getAllStrikes({ guildId });
    const playerIndex = allStrikes.findIndex((p) => p.allyCode === allyCode);

    if (playerIndex < 0) return false;

    allStrikes.splice(playerIndex, 1);
    await guildConfigDB.put({ guildId }, { strikes: allStrikes } as never, false);
    return true;
}
