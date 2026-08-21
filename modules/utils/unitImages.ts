import { env } from "../../config/config.ts";
import { allUnitsList } from "../../data/constants/units.ts";
import type { SWAPIUnit } from "../../types/swapi_types.ts";
import type { BotUnit } from "../../types/types.ts";
import logger from "../Logger.ts";

// Kept out of modules/functions.ts because these are the only functions there that read the unit
// data. Logger imports functions.ts, so while they lived there every process that logs - eventServe,
// swapiServe, dataUpdater, every script - parsed the whole unit dataset at import.

export async function getBlankUnitImage(defId: string): Promise<Buffer | null> {
    return await getUnitImage(defId, {
        gear: -1,
        level: -1,
        rarity: -1,
        skills: undefined,
        relic: null,
    });
}

export async function getUnitImage(defId: string, { rarity, level, gear, skills, relic }: Partial<SWAPIUnit>): Promise<Buffer | null> {
    let thisChar: BotUnit | undefined;

    try {
        thisChar = allUnitsList.find((ch) => ch.uniqueName === defId);
    } catch (err) {
        logger.error("[unitImages/getUnitImage] Issue getting character image:");
        logger.error(err);
        return null;
    }

    if (!thisChar) {
        logger.error(`[unitImages/getUnitImage] Cannot find matching defId: ${defId}`);
        return null;
    }
    const fetchBody = {
        defId,
        charUrl: thisChar?.avatarURL,
        avatarName: thisChar?.avatarName,
        rarity,
        level,
        gear,
        zetas: skills?.filter((s) => s.isZeta && s.zetaTier != null && s.tier >= s.zetaTier).length || 0,
        relic: relic?.currentTier || 0,
        omicron: skills?.filter((s) => s.isOmicron && s.omicronTier != null && s.tier >= s.omicronTier).length || 0,
        side: thisChar.side,
    };

    try {
        const res = await fetch(`${env.IMAGE_SERVER_URL}/char/`, {
            method: "post",
            body: JSON.stringify(fetchBody),
            headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
            logger.error(`[unitImages/getUnitImage] Image server returned error status: ${res.status} ${res.statusText}`);
            return null;
        }

        const resBuf = await res.arrayBuffer();
        return resBuf ? Buffer.from(resBuf) : null;
    } catch (e) {
        logger.error(`[unitImages/getUnitImage] Error requesting image from server.\n${e}`);
        return null;
    }
}
