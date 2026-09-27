import type { DeleteResult, Document, Filter } from "mongodb";
import { env } from "../../config/config.ts";
import cache from "../cache.ts";

const DB = env.MONGODB_SWGOHBOT_DB;
const COL = "guildConfigs";

export const guildConfigDB = {
    get<T extends Document>(matchCondition: Filter<T>, projection?: Document) {
        return cache.get<T>(DB, COL, matchCondition, projection);
    },
    getOne<T extends Document>(matchCondition: Filter<T>, projection?: Document) {
        return cache.getOne<T>(DB, COL, matchCondition, projection);
    },
    put<T extends Document>(matchCondition: Filter<T>, saveObject: T, autoUpdate = false) {
        return cache.put<T>(DB, COL, matchCondition, saveObject, autoUpdate);
    },
    // For rewriting fields read earlier: if the config was deleted meanwhile (the bot left the
    // server), an upsert would rebuild it holding nothing but these fields
    updateExisting<T extends Document>(matchCondition: Filter<T>, fields: T) {
        return cache.put<T>(DB, COL, matchCondition, fields, false, false);
    },
    remove(matchCondition: Filter<Document>): Promise<DeleteResult> {
        return cache.remove(DB, COL, matchCondition);
    },
};
