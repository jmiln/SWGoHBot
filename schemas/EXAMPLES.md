# Schema Validation Examples

Practical examples of using Zod schemas for MongoDB validation.

## Example 1: Validating Before Database Insert

```typescript
import { UserConfigSchema, formatValidationError } from "./schemas/index.ts";
import cache from "./modules/cache.ts";

async function createUser(userId: string, userData: unknown) {
    // Validate the data first
    const result = UserConfigSchema.safeParse(userData);

    if (!result.success) {
        const errorMsg = formatValidationError(result.error);
        throw new Error(`Invalid user data:\n${errorMsg}`);
    }

    // Data is valid, insert into database
    await cache.put("swgohbot", "users", result.data);
    return result.data;
}
```

## Example 2: Validating API Responses

```typescript
import { RawPlayerSchema } from "./schemas/index.ts";
import swgohAPI from "./modules/swapi.ts";

async function fetchAndValidatePlayer(allyCode: number) {
    // Fetch from game API
    const playerData = await swgohAPI.player(allyCode);

    // Validate the response
    try {
        const validPlayer = RawPlayerSchema.parse(playerData);
        return validPlayer;
    } catch (error) {
        logger.error(`Invalid player data from API: ${error}`);
        throw error;
    }
}
```

## Example 3: Partial Updates

```typescript
import { UserConfigSchema, validatePartial } from "./schemas/index.ts";
import cache from "./modules/cache.ts";

async function updateUserLanguage(userId: string, language: string) {
    const updateData = {
        lang: { language }
    };

    // Validate just the fields being updated
    const result = validatePartial(UserConfigSchema, updateData);

    if (!result.success) {
        throw new Error("Invalid update data");
    }

    // Update in database
    await cache.put("swgohbot", "users", { id: userId }, { $set: updateData });
}
```

## Example 4: Migration Script with Validation

```typescript
import { UserConfigSchema } from "./schemas/index.ts";
import database from "./modules/database.ts";

async function migrateUserData() {
    const db = database.getClient().db("swgohbot");
    const users = await db.collection("users").find({}).toArray();

    let valid = 0;
    let invalid = 0;

    for (const user of users) {
        const result = UserConfigSchema.safeParse(user);

        if (result.success) {
            valid++;
        } else {
            invalid++;
            console.error(`Invalid user ${user.id}:`, result.error.issues);
        }
    }

    console.log(`Valid: ${valid}, Invalid: ${invalid}`);
}
```

## Example 5: Testing with Schemas

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import { UserConfigSchema } from "./schemas/index.ts";

describe("User Configuration", () => {
    it("should validate a complete user config", () => {
        const validUser = {
            id: "123456789",
            accounts: [
                { allyCode: "123456789", name: "TestUser", primary: true }
            ],
            arenaAlert: {
                enableRankDMs: "true",
                arena: "both",
                payoutWarning: 6,
                enablePayoutResult: true
            },
            // ... rest of required fields
        };

        const result = UserConfigSchema.safeParse(validUser);
        assert.strictEqual(result.success, true);
    });

    it("should reject invalid user config", () => {
        const invalidUser = {
            id: "123",
            accounts: "not an array", // Wrong type
        };

        const result = UserConfigSchema.safeParse(invalidUser);
        assert.strictEqual(result.success, false);
    });
});
```

## Example 6: Command Input Validation

```typescript
import { GuildConfigEventSchema } from "./schemas/index.ts";

async function createEvent(eventData: unknown) {
    // Validate event data from user input
    const result = GuildConfigEventSchema.safeParse(eventData);

    if (!result.success) {
        const errors = result.error.issues
            .map(i => `${i.path.join(".")}: ${i.message}`)
            .join("\n");

        return interaction.reply({
            content: `Invalid event data:\n${errors}`,
            ephemeral: true
        });
    }

    // Event data is valid, proceed
    await saveEvent(result.data);
}
```

## Example 7: Adding Custom Validation

```typescript
import { z } from "zod";
import { UserConfigSchema } from "./schemas/index.ts";

// Extend existing schema with custom validation
const StrictUserConfigSchema = UserConfigSchema.extend({
    accounts: z.array(
        z.object({
            allyCode: z.string()
                .regex(/^\d{9}$/, "Ally code must be exactly 9 digits"),
            name: z.string().min(1).max(50),
            primary: z.boolean(),
        })
    ).min(1, "Must have at least one account"),
});

// Now use the stricter schema
const result = StrictUserConfigSchema.safeParse(userData);
```

## Tips

1. **Use `safeParse` for user input** - Returns a result object instead of throwing
2. **Use `parse` for internal data** - Throws errors that can be caught by error handlers
3. **Validate early** - Check data as soon as it enters your system
4. **Log validation failures** - Helps debug data issues in production
5. **Don't over-validate** - Skip validation in hot paths after data is proven valid
