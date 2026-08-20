CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  functional_id text NOT NULL UNIQUE,
  legal_name text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  primary_domain text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED'))
);

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  functional_id text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspaces_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED'))
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'WORKSPACE',
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_scope_check CHECK (scope IN ('SYSTEM', 'COMPANY', 'WORKSPACE'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  module text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  subject text NOT NULL,
  email text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  membership_state text NOT NULL DEFAULT 'ACTIVE',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id, role_id),
  CONSTRAINT workspace_memberships_state_check CHECK (membership_state IN ('ACTIVE', 'INVITED', 'SUSPENDED', 'REVOKED'))
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_functional_id ON companies(functional_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_company_id ON workspaces(company_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_functional_id ON workspaces(functional_id);
CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_identities_provider_subject ON user_identities(provider, subject);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_id ON workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_role_id ON workspace_memberships(role_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace_id ON workspace_memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_workspace_id ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_teams_workspace_id ON teams(workspace_id);
CREATE INDEX IF NOT EXISTS idx_incidents_workspace_id ON incidents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_incidents_company_id ON incidents(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);

INSERT INTO roles (code, name, scope, is_system)
VALUES
  ('COMPANY_ADMIN', 'Company Admin', 'COMPANY', true),
  ('WORKSPACE_ADMIN', 'Workspace Admin', 'WORKSPACE', true),
  ('AGENT', 'Support Agent', 'WORKSPACE', true),
  ('APPROVER', 'Approver', 'WORKSPACE', true),
  ('REQUESTER', 'Requester', 'WORKSPACE', true),
  ('VIEWER', 'Viewer', 'WORKSPACE', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, module)
VALUES
  ('workspaces.manage', 'Manage workspaces', 'administration'),
  ('companies.manage', 'Manage companies', 'administration'),
  ('users.manage', 'Manage users', 'identity'),
  ('teams.manage', 'Manage teams', 'service-desk'),
  ('incidents.create', 'Create incidents', 'service-desk'),
  ('incidents.read', 'Read incidents', 'service-desk'),
  ('incidents.update', 'Update incidents', 'service-desk'),
  ('incidents.assign', 'Assign incidents', 'service-desk'),
  ('incidents.resolve', 'Resolve incidents', 'service-desk'),
  ('approvals.manage', 'Manage approvals', 'service-desk'),
  ('audits.read', 'Read audit logs', 'operations')
ON CONFLICT (code) DO NOTHING;

WITH role_ids AS (
  SELECT code, id FROM roles
), perm_ids AS (
  SELECT code, id FROM permissions
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT role_ids.id, perm_ids.id
FROM role_ids
CROSS JOIN perm_ids
WHERE role_ids.code = 'COMPANY_ADMIN'
ON CONFLICT DO NOTHING;

WITH role_ids AS (
  SELECT code, id FROM roles
), perm_ids AS (
  SELECT code, id FROM permissions
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT role_ids.id, perm_ids.id
FROM role_ids
JOIN perm_ids ON perm_ids.code IN (
  'workspaces.manage',
  'users.manage',
  'teams.manage',
  'incidents.create',
  'incidents.read',
  'incidents.update',
  'incidents.assign',
  'incidents.resolve',
  'approvals.manage',
  'audits.read'
)
WHERE role_ids.code = 'WORKSPACE_ADMIN'
ON CONFLICT DO NOTHING;

WITH role_ids AS (
  SELECT code, id FROM roles
), perm_ids AS (
  SELECT code, id FROM permissions
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT role_ids.id, perm_ids.id
FROM role_ids
JOIN perm_ids ON perm_ids.code IN (
  'incidents.create',
  'incidents.read',
  'incidents.update',
  'incidents.assign',
  'incidents.resolve'
)
WHERE role_ids.code = 'AGENT'
ON CONFLICT DO NOTHING;

WITH role_ids AS (
  SELECT code, id FROM roles
), perm_ids AS (
  SELECT code, id FROM permissions
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT role_ids.id, perm_ids.id
FROM role_ids
JOIN perm_ids ON perm_ids.code IN ('incidents.read', 'approvals.manage')
WHERE role_ids.code = 'APPROVER'
ON CONFLICT DO NOTHING;

WITH role_ids AS (
  SELECT code, id FROM roles
), perm_ids AS (
  SELECT code, id FROM permissions
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT role_ids.id, perm_ids.id
FROM role_ids
JOIN perm_ids ON perm_ids.code IN ('incidents.create', 'incidents.read')
WHERE role_ids.code = 'REQUESTER'
ON CONFLICT DO NOTHING;

WITH role_ids AS (
  SELECT code, id FROM roles
), perm_ids AS (
  SELECT code, id FROM permissions
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT role_ids.id, perm_ids.id
FROM role_ids
JOIN perm_ids ON perm_ids.code IN ('incidents.read')
WHERE role_ids.code = 'VIEWER'
ON CONFLICT DO NOTHING;
