# Test Mocks Quick Reference

## Import

```typescript
import {
    createMockInteraction,
    createCommandContext,
    createMockGuildSettings,
    createMockSwapi,
    createMockPlayer,
    createMockGuild,
    createMockGuildMember,
    createMockUnit
} from "../mocks/index.ts";
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

### Access Options
```typescript
interaction.options.getString("character");    // "vader"
interaction.options.getInteger("limit");        // 10
interaction.options.getBoolean("verbose");      // true
interaction.options.getSubcommand();            // "list"
```

### State & Replies
```typescript
// Send reply
await interaction.reply("Message");
await interaction.followUp("Follow up");
await interaction.editReply("Edited");

// Check state
interaction.deferred  // boolean
interaction.replied   // boolean

// Get all replies (test helper)
const replies = (interaction as any)._getReplies();
```

### Language
```typescript
// Get localized string
const msg = interaction.language.get("KEY");

// With placeholders
const msg = interaction.language.get(
    "Hello {{name}}",
    { name: "User" }
);

// Day formatting
interaction.language.getDay("monday", "long");  // "Monday"
```

### Discord Properties
```typescript
interaction.user        // { id, username, ... }
interaction.guild       // { id, name, ... }
interaction.member      // { id, roles, ... }
interaction.client      // { user, ... }
interaction.channelId   // string
interaction.commandName // string
```

---

## createCommandContext()

### Basic (Only Interaction)
```typescript
const ctx = createCommandContext({
    interaction: createMockInteraction()
});

await command.run(ctx);
```

### With swgohLanguage
```typescript
const ctx = createCommandContext({
    interaction: createMockInteraction(),
    swgohLanguage: "eng_us"
});
```

### With Guild Settings
```typescript
const ctx = createCommandContext({
    interaction: createMockInteraction(),
    guildSettings: createMockGuildSettings({ timezone: "UTC" })
});
```

### With Permission Level
```typescript
const ctx = createCommandContext({
    interaction: createMockInteraction(),
    permLevel: 10
});
```

### All Properties
```typescript
const ctx = createCommandContext({
    interaction: createMockInteraction(),
    swgohLanguage: "eng_us",
    guildSettings: createMockGuildSettings(),
    permLevel: 10
});
```

---

## createMockGuildSettings()

### Default Settings
```typescript
const settings = createMockGuildSettings();
```

### Override Fields
```typescript
const settings = createMockGuildSettings({
    timezone: "America/New_York",
    swgohLanguage: "eng_us",
    prefix: "!",
    adminRole: ["role123"],
    useEmbeds: true
});
```

---

## Mock SWAPI

### Create Instance
```typescript
const mockSwapi = createMockSwapi();
```

### Set Player Data
```typescript
const player = createMockPlayer({
    allyCode: 123456789,
    name: "TestPlayer",
    guildId: "guild123",
    level: 85,
    roster: [
        createMockUnit({
            defId: "DARTHVADER",
            gear: 13,
            rarity: 7,
            relic: { currentTier: 8 }
        })
    ]
});

mockSwapi.setPlayerData(player);
```

### Set Guild Data
```typescript
const guild = createMockGuild({
    id: "guild123",
    name: "The Empire",
    members: 50,
    gp: 250000000,
    roster: [
        createMockGuildMember({
            name: "Player1",
            allyCode: 111111111,
            gp: 5000000
        })
    ]
});

mockSwapi.setGuildData(guild);
```

### Fetch Data
```typescript
const player = await mockSwapi.player(123456789);
const guild = await mockSwapi.guild(123456789);
const units = await mockSwapi.units("eng_us");
```

### Error Simulation
```typescript
// Make method throw error
mockSwapi.setShouldThrowError("guild", true);
mockSwapi.setErrorMessage("guild", "API timeout");

// Reset errors
mockSwapi.setShouldThrowError("guild", false);

// Reset all data
mockSwapi.reset();
```

---

## createMockPlayer()

```typescript
const player = createMockPlayer({
    allyCode: 123456789,
    name: "PlayerName",
    guildId: "guild123",
    guildName: "Guild Name",
    level: 85,
    roster: [/* units */],
    stats: [/* stat objects */],
    arena: {
        char: { rank: 100, squad: [] },
        ship: { rank: 50, squad: [] }
    }
});
```

---

## createMockGuild()

```typescript
const guild = createMockGuild({
    id: "guild123",
    name: "Guild Name",
    members: 50,
    gp: 250000000,
    roster: [/* guild members */]
});
```

---

## createMockGuildMember()

```typescript
const member = createMockGuildMember({
    name: "PlayerName",
    allyCode: 111111111,
    gp: 5000000,
    gpChar: 3000000,
    gpShip: 2000000
});
```

---

## createMockUnit()

```typescript
const unit = createMockUnit({
    defId: "DARTHVADER",
    nameKey: "Darth Vader",
    gear: 13,
    level: 85,
    rarity: 7,
    relic: { currentTier: 8 },
    skills: [
        { id: "skill1", tier: 8, isZeta: true }
    ],
    mods: []
});
```

---

## Common Test Patterns

### Basic Command Test
```typescript
it("runs command", async () => {
    const interaction = createMockInteraction({
        optionsData: { character: "vader" }
    });

    const command = new MyCommand();
    const ctx = createCommandContext({ interaction });
    await command.run(ctx);

    const replies = (interaction as any)._getReplies();
    assert.ok(replies.length > 0);
});
```

### With SWAPI Data
```typescript
it("fetches player data", async () => {
    const mockSwapi = createMockSwapi();
    mockSwapi.setPlayerData(createMockPlayer({
        allyCode: 123456789,
        name: "TestPlayer"
    }));

    const interaction = createMockInteraction({
        optionsData: { allycode: "123456789" }
    });

    const ctx = createCommandContext({
        interaction,
        swgohLanguage: "eng_us"
    });

    await command.run(ctx);

    const replies = (interaction as any)._getReplies();
    assert.ok(replies[0].content.includes("TestPlayer"));
});
```

### Error Handling
```typescript
it("handles errors", async () => {
    const mockSwapi = createMockSwapi();
    mockSwapi.setShouldThrowError("player", true);
    mockSwapi.setErrorMessage("player", "Timeout");

    const interaction = createMockInteraction({
        optionsData: { allycode: "123456789" }
    });

    const ctx = createCommandContext({
        interaction,
        swgohLanguage: "eng_us"
    });

    await command.run(ctx);

    const replies = (interaction as any)._getReplies();
    assert.ok(replies[0].embeds || replies[0].content);
});
```

---

## Migration from Old Pattern

**Old (deprecated):**
```typescript
const bot = createMockBot();  // ❌ Doesn't exist
await command.run({ interaction, language });
```

**New (current):**
```typescript
const ctx = createCommandContext({ interaction });  // ✅
await command.run(ctx);
```

---

## See Also

- [README.md](./README.md) - Full documentation
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Migration guide
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Mock SWAPI integration
- [test/slash/time.test.ts](../slash/time.test.ts) - Working example
