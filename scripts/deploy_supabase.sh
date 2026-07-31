#!/usr/bin/env bash
set -euo pipefail

echo "Supabase deploy helper — apply migrations, seed DB, sync Prisma (optional), and deploy functions"

# Required environment variables:
# DATABASE_URL — full Postgres connection string for the Supabase DB
# SUPABASE_PROJECT_REF — Supabase project ref (from Supabase dashboard)
# SUPABASE_URL — https://<project-ref>.supabase.co
# SUPABASE_SERVICE_ROLE_KEY — service role key (kept secret)

: "${DATABASE_URL:?Need to set DATABASE_URL}"
: "${SUPABASE_PROJECT_REF:?Need to set SUPABASE_PROJECT_REF}"
: "${SUPABASE_URL:?Need to set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Need to set SUPABASE_SERVICE_ROLE_KEY}"

# Behavior flags (can be set as env vars):
# PRISMA_INTROSPECT=true  -> run `npx prisma db pull` (this will overwrite prisma/schema.prisma to match the DB)
# PRISMA_INTROSPECT=false -> skip db pull and only run `npx prisma generate` (safe if you maintain schema.prisma by hand)
PRISMA_INTROSPECT=${PRISMA_INTROSPECT:-false}

echo "Applying DB migrations via psql..."
# Run migrations in order. Add new migrations here as files are added.
for f in \
  migrations/0002-enable-pgcrypto-extension.sql \
  migrations/0001-create-payments-table.sql \
  migrations/0003-add-idempotency-key.sql \
  migrations/0004-create-bill-validations.sql; do
  if [ -f "$f" ]; then
    echo "Applying $f"
    psql "$DATABASE_URL" -f "$f"
  else
    echo "Warning: $f not found, skipping"
  fi
done

echo "Seeding DB (supabase/seed/*.sql)..."
for f in supabase/seed/batch_*.sql; do
  if [ -f "$f" ]; then
    echo "Seeding $f"
    psql "$DATABASE_URL" -f "$f"
  else
    echo "No seed file matching $f"
  fi
done

# Prisma sync behavior
if [ "$PRISMA_INTROSPECT" = "true" ] || [ "$PRISMA_INTROSPECT" = "1" ]; then
  echo "PRISMA_INTROSPECT is true — running 'npx prisma db pull' (this WILL overwrite prisma/schema.prisma to match the database)."
  npx prisma db pull
  echo "Running 'npx prisma generate'..."
  npx prisma generate
else
  echo "PRISMA_INTROSPECT is false — skipping 'npx prisma db pull'."
  echo "Only running 'npx prisma generate' to build the client from the existing prisma/schema.prisma..."
  npx prisma generate
fi

echo "Linking Supabase project (supabase CLI)..."
if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found — please install it (npm i -g supabase) and login with 'supabase login'"
  exit 1
fi

supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "Setting Supabase secrets (SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL)..."
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" --project-ref "$SUPABASE_PROJECT_REF"
supabase secrets set SUPABASE_URL="$SUPABASE_URL" --project-ref "$SUPABASE_PROJECT_REF"

echo "Deploying Edge Functions from supabase/functions/*"
for dir in supabase/functions/*; do
  if [ -d "$dir" ]; then
    name=$(basename "$dir")
    echo "Deploying function: $name"
    supabase functions deploy "$name" --project-ref "$SUPABASE_PROJECT_REF" || echo "Failed to deploy $name"
  fi
done

cat <<'EOF'
Done.
Next steps:
 1) Locally, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local for the Vite client.
 2) If you want the script to overwrite prisma/schema.prisma from the DB, set PRISMA_INTROSPECT=true before running.
 3) Test endpoints and functions. Use supabase functions invoke <name> --project-ref <ref> for quick tests.
 4) For production, configure RLS policies in Supabase and only use the anon key on the public client.
EOF
