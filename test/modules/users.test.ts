import assert from "node:assert/strict";
import test from "node:test";
import createUsers from "../../modules/users.ts";
import type { BotType, UserConfig } from "../../types/types.ts";

// Mock cache module for users tests
function createMockCache() {
    const mockData: { [key: string]: Partial<UserConfig> } = {
        "user123": {
            id: "user123",
            accounts: [
                { allyCode: "123456789", name: "Player1", primary: true },
                { allyCode: "987654321", name: "Player2", primary: false },
            ],
            defaults: {},
            arenaAlert: {
                enableRankDMs: "false",
                arena: "both",
                payoutWarning: 10,
                enablePayoutResult: true,
            },
        },
        "user456": {
            id: "user456",
            accounts: [
                { allyCode: "555555555", name: "Player3", primary: true },
            ],
            defaults: {},
            arenaAlert: {
                enableRankDMs: "false",
                arena: "both",
                payoutWarning: 10,
                enablePayoutResult: true,
            },
        },
    };

    return {
        getOne: async <T>(_database: string, _collection: string, matchCondition: any) => {
            const userId = matchCondition.id;
            return mockData[userId] as T || null;
        },
        get: async <T>(_database: string, _collection: string, matchCondition: any) => {
            const allyCode = matchCondition["accounts.allyCode"];
            const results: any[] = [];

            for (const user of Object.values(mockData)) {
                if (user.accounts?.some((acc) => acc.allyCode === allyCode)) {
                    results.push(user as UserConfig);
                }
            }

            return results as T[];
        },
        put: async <T>(_database: string, _collection: string, matchCondition: any, saveObject: T) => {
            const userId = matchCondition.id;
            mockData[userId] = saveObject as any;
            return saveObject;
        },
        remove: async (_database: string, _collection: string, matchCondition: any) => {
            const userId = matchCondition.id;
            const existed = !!mockData[userId];
            delete mockData[userId];
            return { acknowledged: true, deletedCount: existed ? 1 : 0 };
        },
    };
}

function createMockBot(cache = createMockCache()): BotType {
    return {
        cache,
        config: {
            mongodb: {
                swgohbotdb: "swgohbotdb",
            },
        },
    } as any;
}

test.describe("Users Module", () => {
    test.describe("getUser()", () => {
        test("should return user when found", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            const user = await users.getUser("user123");

            assert.ok(user);
            assert.equal(user.id, "user123");
            assert.equal(user.accounts.length, 2);
            assert.equal(user.accounts[0].allyCode, "123456789");
        });

        test("should return null when user not found", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            const user = await users.getUser("nonexistent");

            assert.equal(user, null);
        });
    });

    test.describe("getUsersFromAlly()", () => {
        test("should find users by ally code as string", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            const result = await users.getUsersFromAlly("123456789");

            assert.ok(result);
            assert.equal(result.length, 1);
            assert.equal(result[0].id, "user123");
        });

        test("should find users by ally code as number", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            const result = await users.getUsersFromAlly(123456789);

            assert.ok(result);
            assert.equal(result.length, 1);
            assert.equal(result[0].id, "user123");
        });

        test("should return null when no users found", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            const result = await users.getUsersFromAlly("111111111");

            assert.equal(result, null);
        });

        test("should normalize ally code correctly", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            // Test that number gets converted to string properly
            const result = await users.getUsersFromAlly(987654321);

            assert.ok(result);
            assert.equal(result.length, 1);
            assert.equal(result[0].id, "user123");
        });
    });

    test.describe("updateUser()", () => {
        test("should update user and return updated object", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            const updatedUser = {
                id: "user123",
                accounts: [
                    { allyCode: "999999999", name: "UpdatedPlayer", primary: true },
                ],
                defaults: {},
                arenaAlert: {
                    enableRankDMs: "true",
                    arena: "char",
                    payoutWarning: 20,
                    enablePayoutResult: false,
                },
            } as UserConfig;

            const result = await users.updateUser("user123", updatedUser);

            assert.ok(result);
            assert.equal(result.id, "user123");
            assert.equal(result.accounts[0].allyCode, "999999999");
            assert.equal(result.arenaAlert.enableRankDMs, "true");
        });
    });

    test.describe("removeAllyCode()", () => {
        test("should remove ally code from user", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            const result = await users.removeAllyCode("user123", "987654321");

            assert.ok(result);
            assert.equal(result.accounts.length, 1);
            assert.equal(result.accounts[0].allyCode, "123456789");
        });

        test("should handle ally code as number", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            const result = await users.removeAllyCode("user123", 987654321);

            assert.ok(result);
            assert.equal(result.accounts.length, 1);
            assert.equal(result.accounts[0].allyCode, "123456789");
        });

        test("should throw error if user not found", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            await assert.rejects(
                async () => await users.removeAllyCode("nonexistent", "123456789"),
                { message: "Could not find specified user" }
            );
        });

        test("should throw error if ally code not linked to user", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            await assert.rejects(
                async () => await users.removeAllyCode("user123", "111111111"),
                { message: "Specified ally code not linked to this user" }
            );
        });

        test("should correctly compare ally code after normalization", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            // Pass as number, should still match string in database
            const result = await users.removeAllyCode("user456", 555555555);

            assert.ok(result);
            assert.equal(result.accounts.length, 0);
        });
    });

    test.describe("removeUser()", () => {
        test("should remove user and return true", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            const result = await users.removeUser("user123");

            assert.equal(result, true);
        });

        test("should return false when user not found", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            const result = await users.removeUser("nonexistent");

            assert.equal(result, false);
        });

        test("should actually remove user from cache", async () => {
            const Bot = createMockBot();
            const users = createUsers(Bot);

            await users.removeUser("user456");
            const user = await users.getUser("user456");

            assert.equal(user, null);
        });
    });
});
