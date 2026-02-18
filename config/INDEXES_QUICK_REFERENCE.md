# MongoDB Indexes - Quick Reference

## Quick Start

```bash
# Check what indexes are missing
npm run indexes:check

# Create all missing indexes
npm run indexes

# Or use full commands
node scripts/verifyIndexes.ts --dry-run    # Check only
node scripts/verifyIndexes.ts              # Create missing
```

## Current Index Configuration

### swgohbot.users
```
✓ id                      (unique)  - Primary user lookup
✓ accounts.allyCode       (sparse)  - Find user by ally code
✓ bonusServer             (sparse)  - Patreon bonus server
```

### swgohbot.guildConfigs
```
✓ guildId                           (unique)  - Primary guild lookup
✓ events.eventDT                    (sparse)  - Triggered events query
✓ events.countdown + events.eventDT (sparse)  - Countdown events query
✓ patreonSettings.supporters.userId (sparse)  - Supporter lookups
```

### swgohbot.patrons
```
✓ discordID  (unique)  - Patron user lookup
```

### swapidb.rawPlayers
```
✓ allyCode  (unique)  - Primary player lookup
✓ updated             - Cache freshness
✓ guildId   (sparse)  - Guild member queries
```

### swapidb.playerStats
```
✓ allyCode  (unique)  - Primary player lookup
✓ updated             - Cache freshness
```

### swapidb.rawGuilds
```
✓ id       (unique)  - Primary guild lookup
✓ updated            - Cache freshness
```

### swapidb.guilds
```
✓ id       (unique)  - Primary guild lookup
✓ name               - Guild name search
✓ updated            - Cache freshness
```

### swapidb.characters
```
✓ baseId  (unique)  - Character definition lookup
```

### swapidb.zetaRec
```
✓ lang  - Language-based recommendations
```

## When Adding New Queries

1. **Identify the query pattern** in your code:
   ```typescript
   cache.get("swgohbot", "users", { newField: value })
   ```

2. **Add to config/indexes.ts**:
   ```typescript
   users: [
       // ... existing indexes ...
       {
           key: { newField: 1 },
           options: {
               name: "idx_users_newfield",
               sparse: true,  // If field is optional
           },
       },
   ],
   ```

3. **Run the verifier**:
   ```bash
   npm run indexes
   ```

## Common Patterns

### Single Field Index
```typescript
{
    key: { fieldName: 1 },  // 1 = ascending, -1 = descending
    options: {
        name: "idx_collection_fieldname",
    },
}
```

### Unique Index
```typescript
{
    key: { fieldName: 1 },
    options: {
        name: "idx_collection_fieldname",
        unique: true,
    },
}
```

### Sparse Index (Optional Field)
```typescript
{
    key: { optionalField: 1 },
    options: {
        name: "idx_collection_optionalfield",
        sparse: true,  // Only index docs that have this field
    },
}
```

### Compound Index
```typescript
{
    key: { field1: 1, field2: -1 },
    options: {
        name: "idx_collection_field1_field2",
    },
}
```

### Nested Field Index
```typescript
{
    key: { "parent.child": 1 },
    options: {
        name: "idx_collection_parent_child",
    },
}
```

## Exit Codes

- **0** - All indexes exist or were created successfully
- **1** - Failed to create one or more indexes
- **2** - Missing indexes (when run with --no-create)

## Troubleshooting

### "Duplicate key error" when creating unique index
- The collection has duplicate values for the field
- Clean up duplicates before creating the index

### Index not being used by query
Check with:
```javascript
db.collection.find(query).explain("executionStats")
```
Look for `IXSCAN` (good) vs `COLLSCAN` (bad)

### Still slow after adding index
- Wrong field order in compound index
- Query uses field not in index
- Type mismatch (string vs number)

## Files

- `config/indexes.ts` - Index configuration
- `scripts/verifyIndexes.ts` - Verification script
- `config/indexes.README.md` - Full documentation
