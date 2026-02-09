# Test Mocks Documentation

Comprehensive test fixtures for SWGoHBot slash commands and bot functionality.

## Quick Start

```typescript
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

// Create a bot mock
const bot = createMockBot();

// Create an interaction mock
const interaction = createMockInteraction({
    optionsData: {
        character: "vader",
        limit: 10
    }
});

// Use in your tests
await myCommand.run(bot, interaction);
```

## Table of Contents

- [mockBot](#mockbot)
  - [Basic Usage](#basic-usage)
  - [Data Available](#data-available)
  - [Cache System](#cache-system)
  - [API Methods](#api-methods)
  - [Overriding Properties](#overriding-properties)
- [mockInteraction](#mockinteraction)
  - [Basic Usage](#basic-usage-1)
  - [Command Options](#command-options)
  - [State Tracking](#state-tracking)
  - [Language System](#language-system)
  - [Discord Properties](#discord-properties)
- [Migration Guide](#migration-guide)
- [Testing Patterns](#testing-patterns)

---

## mockBot

Creates a comprehensive Bot object with realistic test data.

### Basic Usage

```typescript
import { createMockBot } from "../mocks/index.ts";

const bot = createMockBot();

// Access mock data
console.log(bot.factions); // Array of all factions
console.log(bot.omicrons.tw); // Territory War omicrons
console.log(bot.journeyNames); // Journey character names
```

### Data Available

The mock includes extensive game data:

**Characters** (15 units):
- Galactic Legends: CLS, SEE, SLKR, GL Rey
- Journey Characters: JKL, JKR
- Meta Units: Vader, GMY, Old Ben
- Diverse Factions: FOO, Dooku, Hondo
- Both versions: Rey (base) and GL Rey

**Ships** (8 units):
- Ahsoka's Jedi Starfighter
- Tie Silencer
- Han's Millennium Falcon
- Hound's Tooth
- Xanadu Blood
- Rebel Y-Wing
- Slave I
- Gauntlet Starfighter

**Other Data**:
- `factions`: All unit factions
- `missions`: Mission data from data/missions.json
- `resources`: Resource data from data/resources.json
- `abilityCosts`: Ability upgrade costs
- `journeyReqs`: Journey character requirements
- `omicrons`: Omicron abilities by game mode (tw, ga, tb, raid, etc.)

### Cache System

The cache is **stateful** - it actually stores and retrieves data:

```typescript
const bot = createMockBot();

// Store data
await bot.cache.put("swgohbotdb", "users",
    { discordId: "123" },
    { name: "TestUser", allyCode: "123456789" }
);

// Retrieve data
const user = await bot.cache.getOne("swgohbotdb", "users",
    { discordId: "123" }
);
// Returns: { discordId: "123", name: "TestUser", allyCode: "123456789" }

// Query multiple
await bot.cache.put("swgohbotdb", "guilds", { id: "1" }, { name: "Guild1", gp: 100000000 });
await bot.cache.put("swgohbotdb", "guilds", { id: "2" }, { name: "Guild2", gp: 200000000 });

const guilds = await bot.cache.get("swgohbotdb", "guilds", {}, null, 2);
// Returns: [{ id: "1", name: "Guild1", gp: 100000000 }, { id: "2", name: "Guild2", gp: 200000000 }]

// Check existence
const exists = await bot.cache.exists("swgohbotdb", "users", { discordId: "123" });
// Returns: true

// Remove data
await bot.cache.remove("swgohbotdb", "users", { discordId: "123" });
```

**Available Methods**:
- `get(db, collection, match, projection, limit)` - Get multiple records
- `getOne(db, collection, match, projection)` - Get single record
- `put(db, collection, match, object, autoUpdate)` - Store record
- `putMany(db, collection, array)` - Store multiple records
- `remove(db, collection, match)` - Delete records
- `exists(db, collection, match)` - Check if record exists

### API Methods

Full swgohAPI implementation:

```typescript
const bot = createMockBot();

// Get all units (characters + ships)
const units = await bot.swgohAPI.units("eng_us");
// Returns: array of 23 BotUnit objects

// Get player data
const player = await bot.swgohAPI.getPlayer("123456789", "eng_us");
// Returns: { name, allyCode, level, roster, arena }

// Get guild data
const guild = await bot.swgohAPI.getGuild("123456789", "eng_us");
// Returns: { name, id, gp, roster }

// Search units by name/alias
const results = await bot.swgohAPI.unitSearch("vader", "eng_us");
// Returns: [{ name: "Darth Vader", uniqueName: "DARTHVADER", ... }]

// Get character details
const char = await bot.swgohAPI.getCharacter("COMMANDERLUKESKYWALKER", "eng_us");
// Returns: { name, factions, skillReferenceList }
```

### Overriding Properties

Use **deep merge** to override any property:

```typescript
// Override nested properties (deep merge)
const bot = createMockBot({
    config: {
        mongodb: { swgohbotdb: "testdb" }
    }
});
// Other config properties preserved

// Replace cache entirely
const bot = createMockBot({
    cache: {
        get: async () => [{ custom: "data" }],
        getOne: async () => ({ custom: "single" }),
        put: async () => {}
    }
});

// Override functions
const bot = createMockBot({
    guildCount: async () => 500,
    userCount: async () => 5000
});
```

**Function Defaults**:
- `guildCount()` → 150
- `userCount()` → 1000
- `deployCommands(force?)` → "Deployed X commands"
- `getDefaultGuildSettings()` → Full default settings object
- `sendWebhook(url, data)` → No-op

---

## mockInteraction

Creates a Discord interaction for testing slash commands.

### Basic Usage

```typescript
import { createMockInteraction } from "../mocks/index.ts";

const interaction = createMockInteraction();

// Use in command tests
await myCommand.run(bot, interaction);

// Check what was sent
const replies = (interaction as any)._getReplies();
console.log(replies); // Array of all reply/followUp calls
```

### Command Options

Configure command options via `optionsData`:

```typescript
const interaction = createMockInteraction({
    optionsData: {
        character: "vader",      // String option
        limit: 10,               // Integer option
        verbose: true,           // Boolean option
        _subcommand: "list",     // Subcommand
        _subcommandGroup: "admin" // Subcommand group
    }
});

// Access options
interaction.options.getString("character");      // "vader"
interaction.options.getInteger("limit");         // 10
interaction.options.getBoolean("verbose");       // true
interaction.options.getSubcommand();             // "list"
interaction.options.getSubcommandGroup();        // "admin"

// Options can be required
interaction.options.getString("missing", true);  // Throws error
interaction.options.getString("missing");        // Returns null
```

**Available Option Methods**:
- `getString(name, required?)` - Get string value
- `getInteger(name, required?)` - Get number value
- `getBoolean(name, required?)` - Get boolean value
- `getSubcommand(required?)` - Get subcommand name
- `getSubcommandGroup(required?)` - Get subcommand group
- `getUser(name, required?)` - Get user object
- `getChannel(name, required?)` - Get channel object
- `getRole(name, required?)` - Get role object

### State Tracking

The mock tracks interaction state and all responses:

```typescript
const interaction = createMockInteraction();

// Check state
console.log(interaction.deferred); // false
console.log(interaction.replied);  // false

// Defer reply
await interaction.deferReply();
console.log(interaction.deferred); // true

// Send reply
await interaction.reply("First response");
console.log(interaction.replied);  // true

// Follow up
await interaction.followUp("Second response");

// Edit previous reply
await interaction.editReply("Updated response");

// Access all replies (test helper)
const replies = (interaction as any)._getReplies();
console.log(replies);
// ["First response", "Updated response"]
```

**State Validation**:
```typescript
// followUp requires prior reply
await interaction.followUp("msg"); // Throws: "Cannot follow up before replying"

// editReply requires deferred or replied
await interaction.editReply("msg"); // Throws: "Cannot edit reply before replying or deferring"
```

### Language System

Enhanced language mock with placeholders and object returns:

```typescript
const interaction = createMockInteraction();

// Numeric placeholders
const msg1 = interaction.language.get(
    "Hello {{0}}, you have {{1}} messages",
    "User",
    "5"
);
// "Hello User, you have 5 messages"

// Named placeholders
const msg2 = interaction.language.get(
    "Hello {{name}}, you have {{count}} messages",
    { name: "User", count: 5 }
);
// "Hello User, you have 5 messages"

// Object returns
const labels = interaction.language.get("COMMAND_INFO_OUTPUT");
console.log(labels);
// {
//   statHeader: "Stats",
//   users: "Users",
//   servers: "Servers",
//   memUsage: "Memory Usage",
//   uptime: "Uptime",
//   updatedAt: "Updated At"
// }

// Day formatting
const day1 = interaction.language.getDay("monday", "long");  // "Monday"
const day2 = interaction.language.getDay("mon", "short");    // "MON"
```

### Discord Properties

Realistic Discord objects included:

```typescript
const interaction = createMockInteraction();

// User who triggered the command
console.log(interaction.user);
// { id: "123456789", username: "TestUser", discriminator: "0000", ... }

// Guild where command was used
console.log(interaction.guild);
// { id: "987654321", name: "Test Guild" }

// Member object
console.log(interaction.member);
// { id: "123456789", roles: { cache: Map } }

// Bot client
console.log(interaction.client);
// { user: { id: "bot123", username: "BotUser" }, ... }

// Other properties
console.log(interaction.channelId);      // "123"
console.log(interaction.commandName);    // "test"
console.log(interaction.createdTimestamp); // Current timestamp
```

**Override Discord Properties**:
```typescript
const interaction = createMockInteraction({
    user: {
        id: "999",
        username: "CustomUser"
    } as any,
    guild: {
        id: "777",
        name: "Custom Guild"
    } as any
});
```

---

## Migration Guide

### From Local Test Mocks

If your test files create their own mocks, migrate to shared mocks:

#### Before
```typescript
// test/slash/mycommand.test.ts
const mockBot = {
    cache: {
        get: async () => [],
        getOne: async () => null
    },
    swgohAPI: {
        getCharacter: async () => ({ name: "Mock" })
    },
    constants: {}
} as any;

const mockInteraction = {
    reply: async () => {},
    options: {
        getString: () => "test"
    }
} as any;
```

#### After
```typescript
// test/slash/mycommand.test.ts
import { createMockBot, createMockInteraction } from "../mocks/index.ts";

const bot = createMockBot();
const interaction = createMockInteraction({
    optionsData: { search: "test" }
});
```

### Benefits
- ✅ **Stateful cache** - Actually stores/retrieves data
- ✅ **Full API** - All swgohAPI methods work
- ✅ **Comprehensive data** - 23 units, factions, omicrons, etc.
- ✅ **State tracking** - Know what was replied
- ✅ **Type safe** - Proper BotType and BotInteraction types
- ✅ **Maintained** - One source of truth for all tests

---

## Testing Patterns

### Pattern 1: Basic Command Test

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
import MyCommand from "../../slash/mycommand.ts";

describe("MyCommand", () => {
    it("responds with character info", async () => {
        const bot = createMockBot();
        const interaction = createMockInteraction({
            optionsData: { character: "vader" }
        });

        const command = new MyCommand(bot);
        await command.run(bot, interaction);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1);
        assert.ok(replies[0].embeds);
    });
});
```

### Pattern 2: Cache Interaction Test

```typescript
it("retrieves user from cache", async () => {
    const bot = createMockBot();

    // Seed cache
    await bot.cache.put("swgohbotdb", "users",
        { discordId: "123" },
        { name: "TestUser", allyCode: "123456789" }
    );

    const interaction = createMockInteraction({
        user: { id: "123" } as any
    });

    const command = new MyCommand(bot);
    await command.run(bot, interaction);

    // Verify command used cached data
    const user = await bot.cache.getOne("swgohbotdb", "users", { discordId: "123" });
    assert.strictEqual(user.name, "TestUser");
});
```

### Pattern 3: State Tracking Test

```typescript
it("defers then replies for long operations", async () => {
    const bot = createMockBot();
    const interaction = createMockInteraction({
        optionsData: { complex: "operation" }
    });

    const command = new MyCommand(bot);
    await command.run(bot, interaction);

    // Verify it deferred first
    assert.strictEqual(interaction.deferred, true);
    assert.strictEqual(interaction.replied, true);

    const replies = (interaction as any)._getReplies();
    assert.ok(replies.length > 0);
});
```

### Pattern 4: API Search Test

```typescript
it("searches for units correctly", async () => {
    const bot = createMockBot();
    const interaction = createMockInteraction({
        optionsData: { search: "vader" }
    });

    // Use the mock API
    const results = await bot.swgohAPI.unitSearch("vader", "eng_us");

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].uniqueName, "DARTHVADER");
    assert.ok(results[0].aliases.includes("Vader"));
});
```

### Pattern 5: Language Placeholder Test

```typescript
it("formats messages with user data", async () => {
    const interaction = createMockInteraction();

    const message = interaction.language.get(
        "Welcome {{name}}! You have {{count}} characters.",
        { name: "Player1", count: 150 }
    );

    assert.strictEqual(
        message,
        "Welcome Player1! You have 150 characters."
    );
});
```

---

## Tips & Best Practices

### Do's ✅

- **Use shared mocks by default** - Reduces duplication
- **Override only what you need** - Deep merge preserves defaults
- **Test state changes** - Use `_getReplies()` and state getters
- **Seed cache for tests** - Use `put()` to setup test data
- **Use optionsData** - Cleaner than mocking options methods

### Don'ts ❌

- **Don't create local mocks** - Use shared mocks instead
- **Don't shallow override** - Deep merge handles nested objects
- **Don't ignore state** - Check deferred/replied in tests
- **Don't assume empty cache** - Cache persists during test
- **Don't mock what exists** - swgohAPI already has full methods

### Common Gotchas

1. **Cache persistence**: Cache data persists for the life of the bot mock. Create a new mock for isolated tests.

2. **State getters**: `deferred` and `replied` are getters, not plain properties. They track actual state.

3. **Reply array**: `_getReplies()` returns the actual array - mutations affect the mock.

4. **Options data**: Keys prefixed with `_` are special (e.g., `_subcommand`, `_subcommandGroup`).

5. **Deep merge**: Nested objects merge recursively, but arrays replace completely.

---

## Examples Repository

See `test/mocks/verification.test.ts` for complete working examples of all mock features.

## Support

If you need additional mock functionality:
1. Check if it can be done with overrides
2. Consider if it's specific to your test (use overrides)
3. If it's generally useful, add it to the shared mocks

---

**Last Updated**: January 2026
**Mock Coverage**: ~95% of BotType interface
**Test Compatibility**: Node.js native test runner with TypeScript
