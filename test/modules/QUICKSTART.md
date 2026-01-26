# Module Tests - Quick Start

## TL;DR

```bash
# 1. Start test database (first time only)
npm run test:db:start

# 2. Run tests
npm run test:modules

# 3. Stop when done
npm run test:db:stop
```

## What Just Happened?

✅ Docker started an isolated MongoDB on **port 27018**
✅ Your production database on **port 27017** is completely safe
✅ Tests run against the isolated database
✅ No risk to production data

## Available Commands

| Command | What It Does |
|---------|-------------|
| `npm run test:db:start` | Start MongoDB test container (port 27018) |
| `npm run test:modules` | Run all module tests |
| `npm run test:modules:cache` | Run only cache tests |
| `npm run test:modules:patreon` | Run only patreon tests |
| `npm run test:db:stop` | Stop test container (keeps data) |
| `npm run test:db:clean` | Remove test container and ALL data |

## Port Configuration

```
Production MongoDB:  localhost:27017  ⚠️  NEVER TOUCHED BY TESTS
Test MongoDB:        localhost:27018  ✅  SAFE TO DESTROY
```

## First Time Setup

1. **Install Docker** (if you haven't):
   - macOS: `brew install --cask docker`
   - Linux: `sudo apt-get install docker.io docker-compose`
   - Windows: [Download Docker Desktop](https://www.docker.com/products/docker-desktop)

2. **Start Docker Desktop** (macOS/Windows) or Docker daemon (Linux)

3. **Start test database**:
   ```bash
   npm run test:db:start
   ```

4. **Run tests**:
   ```bash
   npm run test:modules
   ```

Done! 🎉

## Daily Usage

The test database persists between runs, so you only need to start it once:

```bash
# Monday morning
npm run test:db:start

# Throughout the week
npm run test:modules  # Run as needed

# Friday evening (optional)
npm run test:db:stop
```

## Troubleshooting

### "Docker is not running"
- **macOS/Windows**: Open Docker Desktop app
- **Linux**: `sudo systemctl start docker`

### Tests failing with connection errors
```bash
# Restart the test database
npm run test:db:stop
npm run test:db:start
npm run test:modules
```

### Start fresh
```bash
# Nuclear option - delete everything and start over
npm run test:db:clean
npm run test:db:start
npm run test:modules
```

## More Info

- **Full documentation**: [README.md](./README.md)
- **Docker details**: [DOCKER_SETUP.md](./DOCKER_SETUP.md)
- **Test overview**: [TEST_SUMMARY.md](./TEST_SUMMARY.md)

---

**Bottom line**: Your production database is safe. Port 27018 is isolated. Destroy test data anytime with `npm run test:db:clean`. 🚀
