#!/bin/sh
set -e

# Run DB migrations/push before starting the server
# (drizzle push is used in dev; for production, apply migrations separately)

cd /app/server
exec node --enable-source-maps dist/index.mjs
