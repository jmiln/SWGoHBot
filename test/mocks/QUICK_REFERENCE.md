# Test Mocks Quick Reference

## Import

```typescript
import { createMockBot, createMockInteraction } from "../mocks/index.ts";
```

## createMockBot()

### Basic
```typescript
const bot = createMockBot();
```

### With Overrides
```typescript
const bot = createMockBot({
    config: { mongodb: { swgohbotdb: "testdb" } }
});
```

### Cache Operations
```typescript
// Store
await bot.cache.put("db", "collection", { id: "123" }, { name: "Test" });

// Get one
const item = await bot.cache.getOne("db", "collection", { id: "123" });

// Get many
const items = await bot.cache.get("db", "collection", {}, null, 10);

// Check exists
const exists = await bot.cache.exists("db", "collection", { id: "123" });

// Remove
await bot.cache.remove("db", "collection", { id: "123" });
```

### API Methods
```typescript
// Get all units (23 total: 15 chars + 8 ships)
const units = await bot.swgohAPI.units("eng_us");

// Search units
const results = await bot.swgohAPI.unitSearch("vader", "eng_us");

// Get character details
const char = await bot.swgohAPI.getCharacter("DARTHVADER", "eng_us");

// Get player
const player = await bot.swgohAPI.getPlayer("123456789", "eng_us");

// Get guild
const guild = await bot.swgohAPI.getGuild("123456789", "eng_us");
```

### Available Data
```typescript
bot.factions          // Array of all factions
bot.omicrons.tw       // TW omicron ability IDs
bot.omicrons.ga       // GA omicron ability IDs
bot.journeyReqs       // Journey requirements object
bot.journeyNames      // Journey character names
bot.missions          // Mission data
bot.resources         // Resource data
bot.abilityCosts      // Ability upgrade costs
```

### Functions
```typescript
await bot.guildCount()              // → 150
await bot.userCount()               // → 1000
await bot.deployCommands()          // → "Deployed 20 commands"
bot.getDefaultGuildSettings()       // → Default settings object
bot.sendWebhook(url, data)          // → No-op
```

---

## createMockInteraction()

### Basic
```typescript
const interaction = createMockInteraction();
```

### With Options
```typescript
const interaction = createMockInteraction({
    optionsData: {
        character: "vader",
        limit: 10,
        verbose: true,
        _subcommand: "list"
    }
});
```

### Get Options
```typescript
interaction.options.getString("character")           // "vader"
interaction.options.getInteger("limit")              // 10
interaction.options.getBoolean("verbose")            // true
interaction.options.getSubcommand()                  // "list"
interaction.options.getString("missing", true)       // Throws error
interaction.options.getString("missing")             // null
```

### State Tracking
```typescript
interaction.deferred                // false → true after deferReply()
interaction.replied                 // false → true after reply()

await interaction.deferReply()      // Marks as deferred
await interaction.reply("msg")      // Marks as replied
await interaction.followUp("msg")   // Add follow-up
await interaction.editReply("msg")  // Edit last reply

// Get all replies (test helper)
const replies = (interaction as any)._getReplies();
```

### Language
```typescript
// Numeric placeholders
interaction.language.get("Hello {{0}}", "World")
// → "Hello World"

// Named placeholders
interaction.language.get("Hello {{name}}", { name: "World" })
// → "Hello World"

// Object returns
interaction.language.get("COMMAND_INFO_OUTPUT")
// → { statHeader: "Stats", users: "Users", ... }

// Day formatting
interaction.language.getDay("monday", "long")   // "Monday"
interaction.language.getDay("mon", "short")     // "MON"
```

### Discord Properties
```typescript
interaction.user.id              // "123456789"
interaction.user.username        // "TestUser"
interaction.guild.id             // "987654321"
interaction.guild.name           // "Test Guild"
interaction.member.id            // "123456789"
interaction.client.user.id       // "bot123"
interaction.channelId            // "123"
interaction.commandName          // "test"
interaction.createdTimestamp     // Current time
```

### Override Discord Props
```typescript
const interaction = createMockInteraction({
    user: { id: "999", username: "Custom" } as any,
    guild: { id: "777", name: "Custom Guild" } as any
});
```

---

## Common Patterns

### Test Command Response
```typescript
const bot = createMockBot();
const interaction = createMockInteraction({
    optionsData: { character: "vader" }
});

await command.run(bot, interaction);

const replies = (interaction as any)._getReplies();
assert.strictEqual(replies.length, 1);
```

### Test with Cache
```typescript
const bot = createMockBot();
await bot.cache.put("db", "users", { id: "123" }, { name: "Test" });

const interaction = createMockInteraction();
await command.run(bot, interaction);

const user = await bot.cache.getOne("db", "users", { id: "123" });
assert.strictEqual(user.name, "Test");
```

### Test State Flow
```typescript
const interaction = createMockInteraction();
await command.run(bot, interaction);

assert.strictEqual(interaction.deferred, true);
assert.strictEqual(interaction.replied, true);
```

### Test API Usage
```typescript
const bot = createMockBot();
const results = await bot.swgohAPI.unitSearch("vader", "eng_us");

assert.strictEqual(results.length, 1);
assert.strictEqual(results[0].name, "Darth Vader");
```

---

## Data Summary

### Characters (15)
- **GLs**: CLS, SEE, SLKR, GL Rey
- **Journey**: JKL, JKR
- **Meta**: Vader, GMY, Old Ben
- **Factions**: FOO, Dooku, Hondo, Rey (base), Mace, Ventress

### Ships (8)
Ahsoka's Jedi Starfighter, Tie Silencer, Han's Falcon, Hound's Tooth, Xanadu Blood, Y-Wing, Slave I, Gauntlet

### Omicrons by Mode
- `tw`: CLS, Neibit
- `ga3`: Third Sister
- `ga`: Hondo
- `tb`: Cassian, Finn
- `raid`: Boushh Leia

---

## Tips

✅ **Use optionsData** instead of mocking individual option methods
✅ **Check state** with `deferred`/`replied` properties
✅ **Use _getReplies()** to verify command responses
✅ **Seed cache** with `put()` before running commands
✅ **Deep merge** preserves nested defaults when overriding

❌ Don't create local mocks - use shared ones
❌ Don't shallow override - use deep merge
❌ Don't ignore cache state - it persists per bot instance
❌ Don't mock existing API methods - they're already implemented

---

**Full Docs**: See `test/mocks/README.md`
**Examples**: See `test/mocks/verification.test.ts`
