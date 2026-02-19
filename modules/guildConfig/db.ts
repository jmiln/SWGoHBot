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
    remove(matchCondition: Filter<Document>): Promise<DeleteResult> {
        return cache.remove(DB, COL, matchCondition);
    },
};
