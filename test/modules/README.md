# Module Tests

Tests for core SWGoHBot modules.

## Prerequisites

### Docker (Recommended)

**IMPORTANT**: These tests use Docker to run an isolated MongoDB instance on port 27018, completely separate from your production database (port 27017).

Install Docker:
- **macOS**: [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: `sudo apt-get install docker.io docker-compose` or `brew install docker docker-compose`
- **Windows**: [Docker Desktop](https://www.docker.com/products/docker-desktop)

### Alternative: MongoDB Memory Server (For CI)

For continuous integration, you can use MongoDB Memory Server:

```bash
npm install --save-dev mongodb-memory-server
```

Update test files to use memory server instead of Docker.

## Running Tests

### Quick Start (Docker)

**Step 1**: Start the test database (one time):
```bash
npm run test:db:start
```

This starts an isolated MongoDB container on port 27018 (your production database on 27017 is safe).

**Step 2**: Run the tests:
```bash
# All module tests
npm run test:modules

# Just cache tests
npm run test:modules:cache

# Just patreon tests
npm run test:modules:patreon
```

**Step 3**: Stop the test database when done:
```bash
npm run test:db:stop
```

### Manual Commands

If you prefer running commands directly:

```bash
# Start test database
bash test/modules/start-test-db.sh

# Run tests
MONGO_URL=mongodb://localhost:27018 node --experimental-strip-types --test test/modules/*.test.ts

# Stop test database
bash test/modules/stop-test-db.sh
```

### Clean Up Test Data

To completely remove the test database and all data:

```bash
npm run test:db:clean
```

This removes the Docker volume, giving you a fresh start.

## Test Coverage

### cache.test.ts

Tests for `modules/cache.ts`:

- ✅ **init()** - MongoDB client initialization
- ✅ **put()** - Create/update documents with autoUpdate
- ✅ **putMany()** - Bulk insert operations
- ✅ **get()** - Query with filters, projections, and limits
- ✅ **getOne()** - Single document retrieval
- ✅ **getAggregate()** - MongoDB aggregation pipelines
- ✅ **remove()** - Document deletion
- ✅ **exists()** - Document existence checks
- ✅ **checkIndexes()** - Index inspection
- ✅ **Error handling** - Missing database names

**Total Tests**: 20+

### patreonFuncs.test.ts

Tests for `modules/patreonFuncs.ts`:

- ✅ **init()** - Discord client initialization
- ✅ **getPatronUser()** - Patron retrieval and tier assignment
- ✅ **getPlayerCooldown()** - Cooldown calculation for patrons
- ✅ **Tier calculation** - Correct tier assignment ($1, $5, $10)
- ✅ **Patron filtering** - Active vs declined patron handling
- ✅ **Edge cases** - Exact tier amounts, high amounts, zero amounts

**Total Tests**: 25+

## Test Patterns

### Basic Module Test

```typescript
import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { ModuleClass } from "../../modules/mymodule.ts";

describe("My Module", () => {
    let moduleInstance: ModuleClass;

    before(async () => {
        moduleInstance = new ModuleClass();
        // Setup
    });

    after(async () => {
        // Cleanup
    });

    it("does something", async () => {
        const result = await moduleInstance.doSomething();
        assert.ok(result);
    });
});
```

### MongoDB Test Pattern

```typescript
describe("MongoDB Module", () => {
    let client: MongoClient;
    let module: MyModule;
    const testDbName = "test_db";

    before(async () => {
        const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017";
        client = await MongoClient.connect(mongoUrl);
        module = new MyModule();
        module.init(client);
    });

    after(async () => {
        try {
            await client.db(testDbName).dropDatabase();
        } catch (e) {
            // Ignore
        }
        await client.close();
    });

    beforeEach(async () => {
        // Clear collections before each test
        await client.db(testDbName).collection("my_collection").deleteMany({});
    });

    it("interacts with MongoDB", async () => {
        await module.doSomethingWithDB();
        // Assert
    });
});
```

## CI/CD Configuration

### GitHub Actions Example

```yaml
name: Module Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:7.0
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm install
      - run: npm test test/modules/
        env:
          MONGO_URL: mongodb://localhost:27017
```

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution**: Ensure MongoDB is running:

```bash
# Check if MongoDB is running
ps aux | grep mongod

# macOS
brew services list

# Linux
sudo systemctl status mongodb
```

### Database Permission Issues

```
Error: MongoServerError: not authorized
```

**Solution**: Ensure your MongoDB instance doesn't require authentication, or provide credentials:

```bash
MONGO_URL=mongodb://user:password@localhost:27017 npm test
```

### Tests Hanging

**Possible causes**:
- MongoDB connection not closing properly
- Async operations not awaited
- Missing `after()` hooks

**Solution**: Check that all `after()` hooks properly close connections:

```typescript
after(async () => {
    await client.close();  // Essential!
});
```

## Best Practices

### ✅ Do's

- **Isolate tests**: Use `beforeEach()` to clear collections
- **Use test databases**: Never run tests against production data
- **Clean up**: Always close connections in `after()` hooks
- **Seed data**: Use `before()` to set up common test data
- **Test edge cases**: Zero values, null, undefined, boundary conditions

### ❌ Don'ts

- **Don't share state**: Tests should be independent
- **Don't use production DB**: Always use test database names
- **Don't skip cleanup**: Memory leaks accumulate
- **Don't hardcode URLs**: Use environment variables
- **Don't ignore errors**: Catch and test error conditions

## Adding New Module Tests

1. Create test file: `test/modules/mymodule.test.ts`
2. Import module and dependencies
3. Set up MongoDB connection if needed
4. Write test suites using `describe()` and `it()`
5. Add cleanup in `after()` hooks
6. Update this README with test coverage info

## Test Data

Both test files use realistic test data:

- **User IDs**: "123", "456", "789"
- **Discord IDs**: "active", "declined", "tier1", "tier5", "tier10"
- **Patron Amounts**: 100 ($1), 500 ($5), 1000 ($10), 10000 ($100)
- **Test DB**: "swgohbot" (dropped after tests)

## Future Improvements

- [ ] Add MongoDB Memory Server integration
- [ ] Add test coverage reporting
- [ ] Add performance benchmarks
- [ ] Mock external API calls (swgohAPI)
- [ ] Add integration tests for module interactions
- [ ] Add tests for getRanks(), shardTimes(), etc. (complex methods)

---

**Last Updated**: January 2026
**Total Module Tests**: 45+
**Test Framework**: Node.js native test runner
