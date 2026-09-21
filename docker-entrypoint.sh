#!/bin/sh
set -e

# Migrations need an unpooled connection (see schema.prisma's DIRECT_URL doc
# comment) — fall back to DATABASE_URL so this is a no-op wherever the two
# are already the same (local dev, docker-compose, any non-pooled Postgres).
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

echo "Applying database migrations..."
npx prisma migrate deploy

if [ "$SEED_ON_START" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed || true
fi

exec "$@"
