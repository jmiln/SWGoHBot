# Test Mocks Documentation

Comprehensive test fixtures for SWGoHBot slash commands and bot functionality.

## Quick Start

```typescript
import { createMockInteraction, createCommandContext } from "../mocks/index.ts";

// Create an interaction mock
const interaction = createMockInteraction({
    optionsData: {
        character: "vader",
        limit: 10
    }
});

// Create command context
const ctx = createCommandContext({ interaction });

// Use in your tests
await myCommand.run(ctx);
```

## Table of Contents

- [mockInteraction](#mockinteraction)
  - [Basic Usage](#basic-usage)
  - [Command Options](#command-options)
  - [State Tracking](#state-tracking)
  - [Language System](#language-system)
  - [Discord Properties](#discord-properties)
- [CommandContext](#commandcontext)
  - [Creating Context](#creating-context)
  - [Context Properties](#context-properties)
- [Mock SWAPI](#mock-swapi)
  - [Basic Usage](#basic-usage-1)
  - [Configuring Test Data](#configuring-test-data)
  - [Error Simulation](#error-simulation)
- [Testing Patterns](#testing-patterns)

---

## mockInteraction

Creates a Discord interaction for testing slash commands.

### Basic Usage

```typescript
import { createMockInteraction } from "../mocks/index.ts";

const interaction = createMockInteraction();

// Use in command tests
await interaction.reply("Test response");

// Check what was sent
const replies = (interaction as any)._getReplies();
console.log(replies); // ["Test response"]
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

## CommandContext

Commands now receive a `CommandContext` object instead of separate parameters.

### Creating Context

```typescript
import { createCommandContext, createMockInteraction, createMockGuildSettings } from "../mocks/index.ts";

// Minimal context (only interaction)
const ctx = createCommandContext({
    interaction: createMockInteraction()
});

// With swgohLanguage (for SWAPI-dependent commands)
const ctx = createCommandContext({
    interaction: createMockInteraction(),
    swgohLanguage: "eng_us"
});

// With guild settings (for guild-specific commands)
const ctx = createCommandContext({
    interaction: createMockInteraction(),
    guildSettings: createMockGuildSettings({ timezone: "UTC" })
});

// With permission level (for admin commands)
const ctx = createCommandContext({
    interaction: createMockInteraction(),
    permLevel: 10
});

// With all properties
const ctx = createCommandContext({
    interaction: createMockInteraction(),
    swgohLanguage: "eng_us",
    guildSettings: createMockGuildSettings(),
    permLevel: 10
});
```

### Context Properties

**CommandContext** provides:
- `interaction`: ChatInputCommandInteraction (always present)
- `language`: Language instance for localization (auto-created from interaction)
- `swgohLanguage?`: Game language setting ("eng_us", "ger_de", etc.)
- `guildSettings?`: Guild configuration object
- `permLevel?`: User's permission level (0-10)

### createMockGuildSettings

```typescript
import { createMockGuildSettings } from "../mocks/index.ts";

// Default settings
const settings = createMockGuildSettings();

// Override specific fields
const settings = createMockGuildSettings({
    timezone: "America/New_York",
    swgohLanguage: "eng_us",
    prefix: "!",
    adminRole: ["role123"],
    useEmbeds: true
});

// All fields are merged with defaults
```

---

## Mock SWAPI

Mock implementation of the SWAPI module for testing commands that fetch game data.

### Basic Usage

```typescript
import { createMockSwapi, createMockPlayer, createMockGuild } from "../mocks/index.ts";

// Create mock SWAPI instance
const mockSwapi = createMockSwapi();

// Configure player data
const player = createMockPlayer({
    allyCode: 123456789,
    name: "TestPlayer",
    guildId: "guild123",
    level: 85
});
mockSwapi.setPlayerData(player);

// Configure guild data
const guild = createMockGuild({
    id: "guild123",
    name: "The Empire",
    members: 50,
    gp: 250000000
});
mockSwapi.setGuildData(guild);

// Use in tests
const fetchedPlayer = await mockSwapi.player(123456789);
const fetchedGuild = await mockSwapi.guild(123456789);
```

### Configuring Test Data

**Players:**
```typescript
import { createMockPlayer, createMockUnit } from "../mocks/index.ts";

const player = createMockPlayer({
    allyCode: 123456789,
    name: "Player1",
    guildId: "guild123",
    level: 85,
    roster: [
        createMockUnit({
            defId: "DARTHVADER",
            gear: 13,
            level: 85,
            rarity: 7,
            relic: { currentTier: 8 }
        }),
        createMockUnit({
            defId: "COMMANDERLUKESKYWALKER",
            gear: 13,
            level: 85,
            rarity: 7,
            relic: { currentTier: 9 }
        })
    ]
});

mockSwapi.setPlayerData(player);
```

**Guilds:**
```typescript
import { createMockGuild, createMockGuildMember } from "../mocks/index.ts";

const guild = createMockGuild({
    id: "guild123",
    name: "Test Guild",
    members: 50,
    gp: 250000000,
    roster: [
        createMockGuildMember({
            name: "Player1",
            allyCode: 111111111,
            gp: 5000000,
            gpChar: 3000000,
            gpShip: 2000000
        }),
        createMockGuildMember({
            name: "Player2",
            allyCode: 222222222,
            gp: 4800000
        })
    ]
});

mockSwapi.setGuildData(guild);
```

**Units:**
```typescript
import { createMockUnit } from "../mocks/index.ts";

const vader = createMockUnit({
    defId: "DARTHVADER",
    nameKey: "Darth Vader",
    gear: 13,
    level: 85,
    rarity: 7,
    relic: { currentTier: 8 },
    skills: [
        { id: "skill1", tier: 8, isZeta: true },
        { id: "skill2", tier: 8, isZeta: false }
    ],
    mods: []
});
```

### Error Simulation

Test error handling by configuring the mock to throw errors:

```typescript
// Make a specific method throw an error
mockSwapi.setShouldThrowError("guild", true);
mockSwapi.setErrorMessage("guild", "API timeout");

// Now this will throw
try {
    await mockSwapi.guild(123456789);
} catch (err) {
    console.log(err.message); // "API timeout"
}

// Reset to normal behavior
mockSwapi.setShouldThrowError("guild", false);

// Or reset all data
mockSwapi.reset();
```

**Available error methods:**
- `setShouldThrowError(methodName, shouldThrow)` - Enable/disable errors for a method
- `setErrorMessage(methodName, message)` - Set custom error message
- `reset()` - Clear all configured data and reset to defaults

---

## Testing Patterns

### Pattern 1: Basic Command Test

```typescript
import { describe, it } from "node:test";
import assert from "node:assert";
import { createMockInteraction, createCommandContext } from "../mocks/index.ts";
import MyCommand from "../../slash/mycommand.ts";

describe("MyCommand", () => {
    it("responds with character info", async () => {
        const interaction = createMockInteraction({
            optionsData: { character: "vader" }
        });

        const command = new MyCommand();
        const ctx = createCommandContext({ interaction });
        await command.run(ctx);

        const replies = (interaction as any)._getReplies();
        assert.strictEqual(replies.length, 1);
        assert.ok(replies[0].content || replies[0].embeds);
    });
});
```

### Pattern 2: Command with SWAPI

```typescript
import { createMockSwapi, createMockPlayer } from "../mocks/index.ts";

it("fetches and displays player data", async () => {
    const mockSwapi = createMockSwapi();

    // Configure mock data
    const player = createMockPlayer({
        allyCode: 123456789,
        name: "TestPlayer"
    });
    mockSwapi.setPlayerData(player);

    const interaction = createMockInteraction({
        optionsData: { allycode: "123456789" }
    });

    const command = new MyCommand();
    const ctx = createCommandContext({
        interaction,
        swgohLanguage: "eng_us"
    });

    await command.run(ctx);

    const replies = (interaction as any)._getReplies();
    assert.ok(replies[0].content.includes("TestPlayer"));
});
```

### Pattern 3: Command with Guild Settings

```typescript
import { createMockGuildSettings } from "../mocks/index.ts";

it("uses guild timezone", async () => {
    const interaction = createMockInteraction();
    const guildSettings = createMockGuildSettings({
        timezone: "Europe/London"
    });

    const command = new Time();
    const ctx = createCommandContext({
        interaction,
        guildSettings
    });

    await command.run(ctx);

    const replies = (interaction as any)._getReplies();
    assert.ok(replies[0].content.includes("Europe/London"));
});
```

### Pattern 4: State Tracking Test

```typescript
it("defers then replies for long operations", async () => {
    const interaction = createMockInteraction({
        optionsData: { complex: "operation" }
    });

    const command = new MyCommand();
    const ctx = createCommandContext({ interaction });
    await command.run(ctx);

    // Verify it deferred first
    assert.strictEqual(interaction.deferred, true);
    assert.strictEqual(interaction.replied, true);

    const replies = (interaction as any)._getReplies();
    assert.ok(replies.length > 0);
});
```

### Pattern 5: Error Handling Test

```typescript
it("handles API errors gracefully", async () => {
    const mockSwapi = createMockSwapi();
    mockSwapi.setShouldThrowError("player", true);
    mockSwapi.setErrorMessage("player", "Network timeout");

    const interaction = createMockInteraction({
        optionsData: { allycode: "123456789" }
    });

    const command = new MyCommand();
    const ctx = createCommandContext({
        interaction,
        swgohLanguage: "eng_us"
    });

    await command.run(ctx);

    const replies = (interaction as any)._getReplies();
    // Should contain error message
    assert.ok(
        replies[0].embeds?.[0]?.description?.includes("timeout") ||
        replies[0].content?.includes("timeout")
    );
});
```

---

## Tips & Best Practices

### Do's ✅

- **Use shared mocks by default** - Reduces duplication
- **Override only what you need** - Default values cover common cases
- **Test state changes** - Use `_getReplies()` and state getters
- **Use createCommandContext** - Provides proper typing and defaults
- **Reset mock SWAPI between tests** - Call `mockSwapi.reset()` in `beforeEach()`

### Don'ts ❌

- **Don't create local mocks** - Use shared mocks instead
- **Don't ignore state** - Check deferred/replied in tests
- **Don't assume empty state** - Mock data persists until reset
- **Don't skip language** - CommandContext auto-creates it from interaction

### Common Gotchas

1. **State persistence**: Mock SWAPI data persists until `reset()` is called. Use `beforeEach()` to reset.

2. **State getters**: `deferred` and `replied` are getters that track actual state, not plain properties.

3. **Reply array**: `_getReplies()` returns the actual array - mutations affect the mock.

4. **Options data**: Keys prefixed with `_` are special (e.g., `_subcommand`, `_subcommandGroup`).

5. **Language auto-creation**: You don't need to pass `language` to `createCommandContext()` - it's automatically created from the interaction.

---

## Migration from Old Pattern

If you have tests using the old `BotType` pattern, see [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for step-by-step migration instructions.

**Old pattern (deprecated):**
```typescript
const bot = createMockBot();  // ❌ Doesn't exist
await command.run({ interaction, language });  // ❌ Old signature
```

**New pattern (current):**
```typescript
const ctx = createCommandContext({ interaction });  // ✅ Current
await command.run(ctx);  // ✅ Current
```

---

## Examples Repository

See these files for complete working examples:
- `test/slash/time.test.ts` - Fully migrated command test
- `test/mocks/INTEGRATION_GUIDE.md` - Mock SWAPI integration examples
- `test/mocks/MIGRATION_GUIDE.md` - Migration from old pattern

---

**Last Updated**: February 2026
**Mock Coverage**: Full CommandContext + SWAPI support
**Test Compatibility**: Node.js native test runner with TypeScript
