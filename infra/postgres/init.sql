-- Runs on first container start (superuser context).

-- Create Strapi CMS database
CREATE DATABASE nemocnica_strapi;
GRANT ALL PRIVILEGES ON DATABASE nemocnica_strapi TO nsadmin;

-- Note: audit-immutability.sql is run separately after Prisma migrations,
-- because the audit_log table must exist first.
-- See Makefile target: make db-harden
