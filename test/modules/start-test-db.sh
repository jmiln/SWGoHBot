#!/bin/bash

# Start MongoDB test container
echo "🚀 Starting MongoDB test database..."

cd "$(dirname "$0")"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Start the container
docker compose up -d

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to be ready..."
for i in {1..30}; do
    if docker exec swgohbot-test-mongodb mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        echo "✅ MongoDB test database is ready!"
        echo ""
        echo "📍 Connection URL: mongodb://localhost:27018"
        echo "🗄️  Database: test_db"
        echo "🔌 Port: 27018 (production uses 27017)"
        echo ""
        echo "To run tests:"
        echo "  npm run test:modules"
        echo ""
        echo "To stop the database:"
        echo "  npm run test:db:stop"
        exit 0
    fi
    sleep 1
done

echo "❌ MongoDB failed to start within 30 seconds"
docker compose logs
exit 1
