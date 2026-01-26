# Docker Test Database Setup

## Why Docker?

Your development machine runs the production MongoDB on port 27017. Running tests against production would be dangerous! This Docker setup provides:

✅ **Complete isolation** - Separate database on port 27018
✅ **No conflicts** - Production database remains untouched
✅ **Easy cleanup** - Delete test data without affecting production
✅ **Consistent environment** - Same MongoDB version across machines

## Architecture

```
Production:  localhost:27017  (your actual data) ⚠️  DO NOT TOUCH
Test:        localhost:27018  (Docker container) ✅  Safe to destroy
```

## Installation

### 1. Install Docker

**macOS**:
```bash
brew install --cask docker
# Or download from https://www.docker.com/products/docker-desktop
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo systemctl start docker
sudo usermod -aG docker $USER  # Avoid needing sudo
# Log out and back in for group changes to take effect
```

**Windows**:
- Download [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Install and restart

### 2. Verify Docker is Running

```bash
docker --version
# Should show: Docker version 24.x.x or higher

docker info
# Should not show errors
```

## Usage

### First Time Setup

```bash
# Start the test database
npm run test:db:start
```

Output:
```
🚀 Starting MongoDB test database...
⏳ Waiting for MongoDB to be ready...
✅ MongoDB test database is ready!

📍 Connection URL: mongodb://localhost:27018
🗄️  Database: test_db
🔌 Port: 27018 (production uses 27017)

To run tests:
  npm run test:modules
```

### Run Tests

```bash
# Run all module tests
npm run test:modules

# Or specific tests
npm run test:modules:cache
npm run test:modules:patreon
```

### When You're Done

```bash
# Stop the database (keeps data)
npm run test:db:stop

# Or completely remove everything
npm run test:db:clean
```

## Daily Workflow

```bash
# Morning: Start test DB
npm run test:db:start

# During development: Run tests as needed
npm run test:modules

# Evening: Stop test DB
npm run test:db:stop
```

The Docker container persists between stop/start, so your test data remains unless you run `test:db:clean`.

## Troubleshooting

### "Docker is not running"

**Start Docker Desktop** (macOS/Windows):
- Open Docker Desktop application
- Wait for it to fully start (whale icon in menu bar)

**Start Docker daemon** (Linux):
```bash
sudo systemctl start docker
sudo systemctl enable docker  # Auto-start on boot
```

### Port 27018 Already in Use

Check what's using the port:
```bash
lsof -i :27018
```

Stop the conflicting process or change the port in `docker-compose.yml`:
```yaml
ports:
  - "27019:27017"  # Use 27019 instead
```

Then update npm scripts in `package.json`:
```json
"test:modules": "MONGO_URL=mongodb://localhost:27019 node ..."
```

### Container Won't Start

View logs:
```bash
cd test/modules
docker-compose logs
```

Force restart:
```bash
docker-compose down
docker-compose up -d
```

### Tests Can't Connect

Verify container is running:
```bash
docker ps | grep swgohbot-test-mongodb
```

Test connection manually:
```bash
docker exec swgohbot-test-mongodb mongosh --eval "db.adminCommand('ping')"
# Should output: { ok: 1 }
```

### Clean Slate

If everything is broken, nuclear option:
```bash
# Stop and remove everything
npm run test:db:clean

# Remove all Docker test data
docker volume prune -f

# Start fresh
npm run test:db:start
```

## Advanced

### View Database Contents

```bash
# Connect to MongoDB shell
docker exec -it swgohbot-test-mongodb mongosh

# Inside mongosh:
use test_cache_db
db.test_collection.find()
db.dropDatabase()  # Clear test data
exit
```

### View Logs

```bash
cd test/modules
docker-compose logs -f  # Follow logs in real-time
```

### Change MongoDB Version

Edit `docker-compose.yml`:
```yaml
services:
  mongodb-test:
    image: mongo:6.0  # Change version here
```

Then restart:
```bash
npm run test:db:clean
npm run test:db:start
```

### Run Multiple Test Instances

Edit `docker-compose.yml` to use different ports:
```yaml
# Test instance 1 (port 27018)
# Test instance 2 (port 27019)
ports:
  - "27019:27017"
```

## Files

```
test/modules/
├── docker-compose.yml      # Docker configuration
├── start-test-db.sh        # Start script
├── stop-test-db.sh         # Stop script
├── cache.test.ts           # Uses port 27018
└── patreonFuncs.test.ts    # Uses port 27018
```

## Environment Variables

All npm scripts automatically use `MONGO_URL=mongodb://localhost:27018`.

To use a different URL:
```bash
MONGO_URL=mongodb://custom-host:27017 npm run test:modules
```

## Production Safety

**Your production database is safe because:**
1. ✅ Different port (27017 vs 27018)
2. ✅ Different container (isolated)
3. ✅ Tests use `test_cache_db` and `swgohbot` databases
4. ✅ Docker volume is named `swgohbot-test-db-volume`

**Production MongoDB runs on**: `mongodb://localhost:27017`
**Test MongoDB runs on**: `mongodb://localhost:27018`

They never interact.

## CI/CD Integration

For GitHub Actions or other CI:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    services:
      mongodb:
        image: mongo:7.0
        ports:
          - 27018:27017  # Map to 27018 for consistency with local setup

    steps:
      - run: npm run test:modules
        env:
          MONGO_URL: mongodb://localhost:27018
```

**Note**: CI environments don't have a production database, so you could use port 27017, but we use 27018 for consistency with local development.

No Docker Compose needed in CI - GitHub Actions services work directly.

---

**Need help?** Check the main [README.md](./README.md) for more troubleshooting tips.
