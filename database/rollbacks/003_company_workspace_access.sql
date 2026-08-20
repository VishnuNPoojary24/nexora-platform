ALTER TABLE audit_logs
  DROP COLUMN IF EXISTS company_id,
  DROP COLUMN IF EXISTS workspace_id;

ALTER TABLE incidents
  DROP COLUMN IF EXISTS company_id,
  DROP COLUMN IF EXISTS workspace_id;

ALTER TABLE teams
  DROP COLUMN IF EXISTS workspace_id;

ALTER TABLE users
  DROP COLUMN IF EXISTS workspace_id,
  DROP COLUMN IF EXISTS company_id;

DROP TABLE IF EXISTS workspace_memberships;
DROP TABLE IF EXISTS user_identities;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS workspaces;
DROP TABLE IF EXISTS companies;