import type { UserConfig } from "./types.ts";

export interface UserReg {
    // addUser: (userId: string, allyCode: string) => Promise<void>
    getUser: (userId: string) => Promise<UserConfig>;
    getUsersFromAlly: (allyCode: string) => Promise<UserConfig[]>;
    updateUser: (userId: string, userObj: UserConfig) => Promise<UserConfig>;
    removeAllyCode: (userId: string, allyCode: number | string) => Promise<UserConfig>;
    removeUser: (user: string) => Promise<boolean>;
}
