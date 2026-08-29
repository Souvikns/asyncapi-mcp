#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/asyncapi_mcp"

echo "==> Starting PostgreSQL with Docker Compose..."
docker compose up -d db

echo "==> Waiting for PostgreSQL to accept connections..."
attempts=0
until docker compose exec -T db pg_isready -U postgres -d asyncapi_mcp >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
        echo "ERROR: PostgreSQL did not become ready in time. Check 'docker compose logs db'."
        exit 1
    fi
    sleep 1
done

if [ ! -f web/dist/index.html ]; then
    echo "==> Building the website (first run only)..."
    npm --prefix web install
    npm --prefix web run build
fi

echo ""
echo "==============================================="
echo "  AsyncAPI MCP Server is starting"
echo ""
echo "  Website:      http://localhost:${PORT}"
echo "  MCP endpoint: http://localhost:${PORT}/mcp"
echo "  Health check: http://localhost:${PORT}/health"
echo ""
echo "  Sign up on the website to create an API key."
echo ""
echo "  Ctrl+C stops the app. The database keeps"
echo "  running — stop it with: docker compose down"
echo "==============================================="
echo ""

exec npm run dev
