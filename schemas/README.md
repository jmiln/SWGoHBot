# MongoDB Schema Validation

This directory contains Zod schemas for validating MongoDB documents. These schemas provide runtime type checking and ensure data integrity when reading from or writing to the database.

## Schema Files

- **`users.schema.ts`** - User configuration documents (`users` collection)
- **`guildConfigs.schema.ts`** - Guild configuration documents (`guildConfigs` collection)
- **`patrons.schema.ts`** - Patreon user documents (`patrons` collection)
- **`players.schema.ts`** - Player data documents (`rawPlayers`, `playerStats` collections)
- **`guilds.schema.ts`** - Guild data documents (`rawGuilds`, `guilds` collections)
- **`index.ts`** - Main export file with helper functions

## Usage

### Basic Validation

```typescript
import { UserConfigSchema, validateDocument } from "./schemas/index.ts";

// Safely validate (doesn't throw)
const result = validateDocument(UserConfigSchema, userData);
if (result.success) {
    console.log("Valid user:", result.data);
} else {
    console.error("Validation errors:", result.error.issues);
}
```

### Parse and Throw on Error

```typescript
import { UserConfigSchema } from "./schemas/index.ts";

try {
    const user = UserConfigSchema.parse(userData);
    // user is now fully typed and validated
} catch (error) {
    console.error("Invalid user data:", error);
}
```

### Validating Updates (Partial Data)

```typescript
import { UserConfigSchema, validatePartial } from "./schemas/index.ts";

// Only validate the fields that are being updated
const result = validatePartial(UserConfigSchema, { username: "newName" });
```

### In Database Operations

```typescript
import { UserConfigSchema } from "./schemas/index.ts";
import cache from "./modules/cache.ts";

// Before inserting
async function createUser(userData: unknown) {
    const validUser = UserConfigSchema.parse(userData);
    await cache.put("swgohbot", "users", validUser);
}

// After reading
async function getUser(userId: string) {
    const userData = await cache.get("swgohbot", "users", { id: userId });
    return UserConfigSchema.parse(userData);
}
```

### Error Formatting

```typescript
import { formatValidationError } from "./schemas/index.ts";

const result = validateDocument(UserConfigSchema, invalidData);
if (!result.success) {
    const errorMessage = formatValidationError(result.error);
    console.error(errorMessage);
    // Example output:
    // accounts.0.allyCode: Expected number, received string
    // username: Required
}
```

## TypeScript Integration

All schemas export corresponding TypeScript types that can be used throughout the codebase:

```typescript
import type { UserConfig, GuildConfig, PatronUser } from "./schemas/index.ts";

function processUser(user: UserConfig) {
    // user is fully typed
}
```

## Benefits

1. **Runtime Validation** - Catch data integrity issues before they cause errors
2. **Type Safety** - Generate TypeScript types from schemas (single source of truth)
3. **Self-Documentation** - Schemas document the expected structure of database documents
4. **Migration Safety** - Validate data during migrations to ensure consistency
5. **API Validation** - Ensure external data (from game API) matches expected format

## When to Use

- ✅ **Before database writes** - Validate data before inserting/updating
- ✅ **After external API calls** - Validate responses from the game API
- ✅ **In migration scripts** - Ensure data transformations are correct
- ✅ **During testing** - Validate mock data matches production schemas
- ⚠️ **After database reads** - Only if you suspect data corruption
- ❌ **In hot paths** - Skip validation in performance-critical code after data is proven valid

## Notes

- Player and guild schemas are simplified due to the complexity of the full SWAPI types
- Roster fields use `z.unknown()` (not `z.any()`) for `SWAPIUnit` arrays — the full interface has
  many optional/computed fields making an inline Zod schema impractical; use TypeScript types when
  reading roster data
- You can extend these schemas as needed for stricter validation
- Consider adding custom refinements for business logic validation (e.g., allyCode format)

## Future Enhancements

- Add custom validators for allyCode format (9 digits)
- Add refinements for Discord ID format (snowflake)
- Create more detailed schemas for player roster and skills
- Add schemas for character/ability definitions
