import type { BotCache } from "./cache_types.ts";
import type { UserConfig } from "./types.ts";

export interface UserReg {
    init: (cache: BotCache) => void;
    getUser: (userId: string) => Promise<UserConfig | null>;
    getUsersFromAlly: (allyCode: string | number) => Promise<UserConfig[] | null>;
    updateUser: (userId: string, userObj: UserConfig) => Promise<UserConfig>;
    removeAllyCode: (userId: string, allyCode: number | string) => Promise<UserConfig>;
    removeUser: (userId: string) => Promise<boolean>;
}
