.PHONY: dev db-migrate db-harden db-verify-audit test

# ── Local development ─────────────────────────────────────
dev:
	cd infra && docker-compose up -d
	pnpm --filter=@ns/api db:push
	pnpm dev

# ── DB setup ──────────────────────────────────────────────

db-migrate:
	pnpm --filter=@ns/api db:migrate

# Apply audit log immutability AFTER migrations have run.
# Requires NS_APP_PASSWORD env var to be set.
# Superuser credentials (nsadmin) are used here — not the app role.
db-harden:
	@test -n "$$NS_APP_PASSWORD" || (echo "ERROR: NS_APP_PASSWORD not set" && exit 1)
	docker exec -i $$(docker-compose -f infra/docker-compose.yml ps -q postgres) \
	  psql -U nsadmin -d nemocnica_snina \
	  -v NS_APP_PASSWORD="$$NS_APP_PASSWORD" \
	  < infra/postgres/audit-immutability.sql
	@echo "✓ audit_log immutability applied"

# Verify the privilege table looks correct
db-verify-audit:
	docker exec -i $$(docker-compose -f infra/docker-compose.yml ps -q postgres) \
	  psql -U nsadmin -d nemocnica_snina -c \
	  "SELECT grantee, privilege_type FROM information_schema.role_table_grants \
	   WHERE table_name = 'audit_log' ORDER BY grantee, privilege_type;"

# ── Tests ─────────────────────────────────────────────────
test:
	pnpm test

test-api:
	pnpm --filter=@ns/api test

# Run only the DB-level audit immutability test (requires real Postgres)
test-audit-immutability:
	DATABASE_URL=$$DATABASE_URL pnpm --filter=@ns/api test -- audit-immutability
