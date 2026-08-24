#!/usr/bin/env sh
# Provision or migrate the database — safe to run on every deploy.
#
# Why this exists: prisma/migrations/0001_baseline is an EMPTY marker. The core
# tables (bookings, availability_slots, staff_users, audit_log, ...) were created
# outside Prisma with `db push`, and only the later migrations are real DDL. So
# `migrate deploy` against a genuinely EMPTY database fails with
# 'relation "bookings" does not exist' — nothing ever creates them.
#
# This automates Prisma's documented baselining flow:
#
#   empty / untracked DB -> `db push` to create the current schema, then mark
#                           every migration applied so history is consistent.
#   tracked DB           -> plain `migrate deploy`.
#
# Rewriting 0001_baseline into real DDL would be tidier, but the chain is not
# self-consistent from empty (later migrations ALTER tables the baseline never
# creates) and getting it wrong risks the production database. `migrate deploy`
# stays the steady-state path; `db push` only ever touches an untracked DB.
set -eu

# Runs from the repo root, from scripts/, or from inside the API container
# (WORKDIR=/repo/apps/api).
if [ ! -f prisma/schema.prisma ]; then
  cd "$(dirname "$0")/.." 2>/dev/null || true
  [ -f apps/api/prisma/schema.prisma ] && cd apps/api
fi
[ -f prisma/schema.prisma ] || { echo "!! cannot locate prisma/schema.prisma"; exit 1; }

PRISMA="node node_modules/prisma/build/index.js"
SCHEMA="--schema prisma/schema.prisma"

echo "==> probing for the core schema"
# Do NOT infer from `migrate status`: infra/postgres/init.sql pre-creates roles
# and objects on first boot, so a brand-new database is never truly "empty" and
# status reports the migrations as merely un-applied. Probe a core table that
# only `db push` creates instead.
if $PRISMA db execute --stdin $SCHEMA >/dev/null 2>&1 <<'SQL'
SELECT 1 FROM "bookings" LIMIT 1;
SQL
then
  CORE_EXISTS=yes
else
  CORE_EXISTS=no
fi
echo "    core schema present: $CORE_EXISTS"

if [ "$CORE_EXISTS" = "no" ]; then
  echo "==> untracked database — baselining"
  $PRISMA db push $SCHEMA --skip-generate
  for dir in prisma/migrations/*/; do
    [ -d "$dir" ] || continue
    name="$(basename "$dir")"
    echo "    marking $name as applied"
    $PRISMA migrate resolve --applied "$name" $SCHEMA >/dev/null 2>&1 || true
  done
  echo "==> baselined"
else
  echo "==> tracked database — applying pending migrations"
  if ! $PRISMA migrate deploy $SCHEMA; then
    cat >&2 <<'MSG'

!! migrate deploy failed.

   If this is P3009 (a previous migration is recorded as failed), inspect it and
   then clear the record before redeploying:

     prisma migrate resolve --rolled-back <migration_name>

   Never resolve --applied to silence a genuine failure.
MSG
    exit 1
  fi
fi

$PRISMA migrate status $SCHEMA || true
