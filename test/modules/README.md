# Module Tests

Tests for core SWGoHBot modules.

## Prerequisites

### Docker

Testcontainers requires Docker to be running. Install Docker:
- **macOS**: [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: `sudo apt-get install docker.io` or `brew install docker`
- **Windows**: [Docker Desktop](https://www.docker.com/products/docker-desktop)

Ensure Docker is running before running tests:

```bash
docker ps
```

If Docker is not running, start it via Docker Desktop or `sudo systemctl start docker` (Linux).

## Running Tests

### Quick Start

**Run all module tests:**
```bash
npm run test:modules
```

**Run all tests (modules + slash commands):**
```bash
npm test
```

Testcontainers will automatically:
1. Start MongoDB container on port 27018 before tests
2. Run all tests
3. Stop and cleanup container after tests

**No manual setup required!**

### What Happens Behind the Scenes

When you run tests:

1. **Global setup** (`test/setup/mongodb.ts`) starts MongoDB testcontainer
2. **Tests connect** via shared connection helper (`test/helpers/mongodb.ts`)
3. **Container mapped** to port 27018 (your production DB on 27017 is safe)
4. **Global teardown** stops container when tests finish
5. **Auto-cleanup** removes container even if tests crash

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
import { getMongoClient, closeMongoClient } from "../helpers/mongodb.ts";

describe("MongoDB Module", () => {
    let client: MongoClient;
    let module: MyModule;
    const testDbName = "test_db";

    before(async () => {
        // Get shared MongoDB client from testcontainer
        client = await getMongoClient();

        module = new MyModule();
        module.init(client);
    });

    after(async () => {
        try {
            await client.db(testDbName).dropDatabase();
        } catch (e) {
            // Ignore
        }
        await closeMongoClient();
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

## Troubleshooting

### Docker Not Running

```
Error: Docker is not running
```

**Solution**: Start Docker Desktop or Docker daemon:

```bash
# macOS/Windows
# Start Docker Desktop app

# Linux
sudo systemctl start docker

# Verify
docker ps
```

### Port 27018 Already in Use

```
Error: port is already allocated
```

**Solution**: Stop any services using port 27018:

```bash
# Find process using port 27018
lsof -i :27018

# Kill old Docker containers
docker ps -a | grep mongo
docker stop <container-id>
docker rm <container-id>
```

### Tests Hanging

**Possible causes**:
- MongoDB connection not closing properly
- Async operations not awaited
- Missing `after()` hooks

**Solution**: Ensure `closeMongoClient()` is called in `after()` hook:

```typescript
after(async () => {
    await closeMongoClient();  // Essential!
});
```

### Testcontainer Cleanup Issues

If containers aren't cleaning up:

```bash
# List all testcontainers
docker ps -a | grep testcontainers

# Remove them manually
docker rm -f $(docker ps -aq --filter "label=org.testcontainers=true")
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

- [ ] Add GitHub Actions CI/CD integration
- [ ] Add test coverage reporting
- [ ] Add performance benchmarks
- [ ] Mock external API calls (swgohAPI)
- [ ] Add integration tests for module interactions
- [ ] Add tests for getRanks(), shardTimes(), etc. (complex methods)
- [ ] Explore parallel test execution with isolated containers

---

**Last Updated**: January 2026
**Total Module Tests**: 45+
**Test Framework**: Node.js native test runner
