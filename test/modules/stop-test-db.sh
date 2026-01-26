#!/bin/bash

# Stop MongoDB test container
echo "🛑 Stopping MongoDB test database..."

cd "$(dirname "$0")"

docker compose down

echo "✅ MongoDB test database stopped"
echo ""
echo "To remove all test data permanently:"
echo "  docker compose down -v"
