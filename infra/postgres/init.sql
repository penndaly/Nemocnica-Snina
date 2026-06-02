-- Create Strapi CMS database alongside the operational DB
CREATE DATABASE nemocnica_strapi;
GRANT ALL PRIVILEGES ON DATABASE nemocnica_strapi TO nsadmin;

-- Enforce append-only audit log at the DB level
-- (app layer also enforces this; belt-and-suspenders)
-- Applied after Prisma migrations run.
-- DROP RULE will be blocked for audit_log via a separate POLICY.
