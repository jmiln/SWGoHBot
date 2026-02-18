# MongoDB Index Configuration

This directory contains the MongoDB index configuration for SWGoHBot and the verification script.

## Files

- **indexes.ts** - Complete index configuration for all databases and collections
- **verifyIndexes.ts** - Script to verify and create indexes

## Index Configuration

The `indexes.ts` file defines all indexes that should exist on MongoDB collections across two databases:

### swgohbot Database (Bot Configuration)

#### users Collection
- **id** (unique) - Discord user ID, primary lookup
- **accounts.allyCode** (sparse) - For looking up users by ally code
- **bonusServer** (sparse) - For patron bonus server lookups

#### guildConfigs Collection
- **guildId** (unique) - Discord guild ID, primary lookup
- **events.eventDT** (sparse) - Time-based queries for event triggers
- **events.countdown + events.eventDT** (compound, sparse) - Countdown event queries
- **patreonSettings.supporters.userId** (sparse) - Patron supporter lookups

#### patrons Collection
- **discordID** (unique) - Discord ID for patron lookups

### swapidb Database (Game Data)

#### rawPlayers Collection
- **allyCode** (unique) - Player ally code, primary lookup
- **updated** - For cache freshness checks
- **guildId** (sparse) - For guild member queries

#### playerStats Collection
- **allyCode** (unique) - Player ally code, primary lookup
- **updated** - For cache freshness checks

#### rawGuilds Collection
- **id** (unique) - Guild ID, primary lookup
- **updated** - For cache freshness checks

#### guilds Collection
- **id** (unique) - Guild ID, primary lookup
- **name** - For guild name searches
- **updated** - For cache freshness checks

#### characters Collection
- **baseId** (unique) - Character definition ID

#### zetaRec Collection
- **lang** - Language-based zeta recommendations

## Usage

### Verify Indexes (Check Only)

```bash
npm run indexes:check
```

This will check all indexes and report what's missing without making any changes.

### Create Missing Indexes

```bash
npm run indexes
```

This will check all indexes and create any that are missing.

### Advanced Options

```bash
# Create missing indexes (default)
npm run indexes:create

# Check only (dry run)
npm run indexes:check

# Drop indexes not in configuration (DANGEROUS!)
node scripts/verifyIndexes.ts --drop-unused

# Dry run - show what would happen without making changes
node scripts/verifyIndexes.ts --dry-run --drop-unused
```

## Adding New Indexes

When you add new query patterns to the codebase:

1. Edit `config/indexes.ts`
2. Add the new index to the appropriate database and collection
3. Run the verification script to create it

Example:

```typescript
// In config/indexes.ts
swgohbot: {
    users: [
        // ... existing indexes ...
        {
            key: { newField: 1 },
            options: {
                name: "idx_users_newfield",
                sparse: true,  // Use sparse if field may not exist on all docs
            },
        },
    ],
}
```

## Index Options

### Common Options

- **unique**: Ensures field values are unique across the collection
- **sparse**: Only index documents that contain the field (useful for optional fields)
- **name**: Custom name for the index (recommended for clarity)
- **background**: Create index in background (MongoDB >= 4.2 ignores this, indexes are always background)
- **expireAfterSeconds**: TTL for documents (useful for cache expiration)

### Index Direction

- **1**: Ascending order
- **-1**: Descending order

### Compound Indexes

For queries that filter on multiple fields:

```typescript
{
    key: { field1: 1, field2: -1 },
    options: {
        name: "idx_collection_field1_field2"
    }
}
```

## Performance Considerations

### When to Add an Index

Add an index if:
- The field is used in queries (find, findOne)
- The field is used in sort operations
- The field is used in aggregations with $match
- Queries on the field are slow

### When NOT to Add an Index

Avoid indexes if:
- The field has very low cardinality (few unique values)
- The collection is small (< 1000 documents)
- The field is rarely queried
- Write performance is more critical than read performance

### Compound Index Order

For compound indexes, order matters:
1. Equality filters first
2. Sort fields next
3. Range filters last

Example:
```typescript
// Query: { status: "active", createdAt: { $gte: date } }
// Sort: { name: 1 }
{ key: { status: 1, name: 1, createdAt: 1 } }
```

## Monitoring Indexes

### Check Index Usage

```javascript
// In MongoDB shell
db.collection.aggregate([{ $indexStats: {} }])
```

### Explain Query Plans

```javascript
// Check if a query uses an index
db.collection.find({ field: value }).explain("executionStats")
```

## Troubleshooting

### Index Creation Fails

**Duplicate Key Error**: The unique index cannot be created because duplicate values exist
- Solution: Clean up duplicates before creating the index

**Memory Limit Exceeded**: Large collection, not enough memory
- Solution: Increase MongoDB memory or create index during off-peak hours

### Queries Still Slow After Indexing

1. Check if the index is being used:
   ```javascript
   db.collection.find(query).explain("executionStats")
   ```

2. Look for:
   - `winningPlan.stage` should be "IXSCAN" (index scan), not "COLLSCAN" (collection scan)
   - `totalDocsExamined` should be close to `nReturned`

3. Common issues:
   - Wrong field order in compound index
   - Query uses a field not in the index
   - Type mismatch (searching for string "123" when field is number 123)

## Backup Recommendations

Before running `--drop-unused`:
1. List all current indexes and save the output
2. Test in a development environment first
3. Only drop indexes you're certain are unused

```bash
# Save current indexes
mongosh --eval "db.adminCommand('listDatabases').databases.forEach(d => { print(d.name); db.getSiblingDB(d.name).getCollectionNames().forEach(c => { print('  ' + c); printjson(db.getSiblingDB(d.name)[c].getIndexes()); }); })" > indexes_backup.txt
```
