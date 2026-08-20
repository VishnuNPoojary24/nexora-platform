import type { Pool, PoolClient } from "pg";

interface CompanyRecord {
  id: string;
  functional_id: string;
  legal_name: string;
  display_name: string;
  status: string;
  primary_domain: string | null;
  created_at: Date;
  updated_at: Date;
}

interface WorkspaceRecord {
  id: string;
  company_id: string;
  functional_id: string;
  slug: string;
  name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface RoleRecord {
  id: string;
  code: string;
  name: string;
}

interface AuthUserRecord {
  id: string;
  company_id: string | null;
  workspace_id: string | null;
  external_id: string | null;
  email: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  password_hash: string | null;
  password_salt: string | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface MembershipRecord {
  workspace_id: string;
  role_code: string;
  role_name: string;
  is_primary: boolean;
}

export interface AuthSessionRecord {
  user: Omit<AuthUserRecord, "password_hash" | "password_salt">;
  company: CompanyRecord | null;
  workspace: WorkspaceRecord | null;
  memberships: MembershipRecord[];
}

type Executor = Pool | PoolClient;

export class AuthRepository {
  constructor(private readonly db: Pool) {}

  private async getRoleMap(executor: Executor, roleCodes: string[]): Promise<Map<string, RoleRecord>> {
    const result = await executor.query<RoleRecord>("SELECT id, code, name FROM roles WHERE code = ANY($1::text[])", [roleCodes]);
    return new Map(result.rows.map((role) => [role.code, role]));
  }

  private async getSessionByUserId(executor: Executor, userId: string): Promise<AuthSessionRecord | null> {
    const userResult = await executor.query<AuthUserRecord>("SELECT * FROM users WHERE id = $1", [userId]);
    const user = userResult.rows[0];
    if (!user) return null;

    const companyResult = user.company_id
      ? await executor.query<CompanyRecord>("SELECT * FROM companies WHERE id = $1", [user.company_id])
      : { rows: [] as CompanyRecord[] };
    const workspaceResult = user.workspace_id
      ? await executor.query<WorkspaceRecord>("SELECT * FROM workspaces WHERE id = $1", [user.workspace_id])
      : { rows: [] as WorkspaceRecord[] };
    const memberships = await executor.query<MembershipRecord>(
      `SELECT wm.workspace_id, r.code AS role_code, r.name AS role_name, wm.is_primary
       FROM workspace_memberships wm
       INNER JOIN roles r ON r.id = wm.role_id
       WHERE wm.user_id = $1
       ORDER BY wm.is_primary DESC, r.code ASC`,
      [user.id],
    );

    const { password_hash: _passwordHash, password_salt: _passwordSalt, ...safeUser } = user;
    return {
      user: safeUser,
      company: companyResult.rows[0] ?? null,
      workspace: workspaceResult.rows[0] ?? null,
      memberships: memberships.rows,
    };
  }

  async findByEmail(companyFunctionalId: string, email: string): Promise<AuthSessionRecord | null> {
    const result = await this.db.query<{ user_id: string }>(
      `SELECT u.id AS user_id
       FROM users u
       INNER JOIN companies c ON c.id = u.company_id
       WHERE c.functional_id = $1 AND lower(u.email) = lower($2)
       LIMIT 1`,
      [companyFunctionalId, email],
    );
    const userId = result.rows[0]?.user_id;
    return userId ? this.getSessionByUserId(this.db, userId) : null;
  }

  async findById(userId: string): Promise<AuthSessionRecord | null> {
    return this.getSessionByUserId(this.db, userId);
  }

  async bootstrapCompany(input: {
    companyFunctionalId: string;
    companyLegalName: string;
    companyDisplayName: string;
    primaryDomain?: string;
    workspaceFunctionalId: string;
    workspaceSlug: string;
    workspaceName: string;
    admin: {
      email: string;
      display_name: string;
      first_name?: string;
      last_name?: string;
    };
    passwordHash: string;
    passwordSalt: string;
  }): Promise<AuthSessionRecord> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");

      const company = await client.query<CompanyRecord>(
        `INSERT INTO companies (functional_id, legal_name, display_name, primary_domain)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [input.companyFunctionalId, input.companyLegalName, input.companyDisplayName, input.primaryDomain ?? null],
      );

      const workspace = await client.query<WorkspaceRecord>(
        `INSERT INTO workspaces (company_id, functional_id, slug, name)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [company.rows[0]!.id, input.workspaceFunctionalId, input.workspaceSlug, input.workspaceName],
      );

      const user = await client.query<AuthUserRecord>(
        `INSERT INTO users (company_id, workspace_id, external_id, email, display_name, first_name, last_name, is_active, password_hash, password_salt, password_changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, now())
         RETURNING *`,
        [
          company.rows[0]!.id,
          workspace.rows[0]!.id,
          input.admin.email,
          input.admin.email,
          input.admin.display_name,
          input.admin.first_name ?? null,
          input.admin.last_name ?? null,
          input.passwordHash,
          input.passwordSalt,
        ],
      );

      const updatedCompany = await client.query<CompanyRecord>(
        `UPDATE companies
         SET created_by_user_id = $2,
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [company.rows[0]!.id, user.rows[0]!.id],
      );

      const roleMap = await this.getRoleMap(client, ["COMPANY_ADMIN", "WORKSPACE_ADMIN"]);
      const companyAdminRole = roleMap.get("COMPANY_ADMIN");
      const workspaceAdminRole = roleMap.get("WORKSPACE_ADMIN");
      if (!companyAdminRole || !workspaceAdminRole) {
        throw new Error("Default roles are missing");
      }

      await client.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role_id, membership_state, is_primary)
         VALUES ($1, $2, $3, 'ACTIVE', true), ($1, $2, $4, 'ACTIVE', false)
         ON CONFLICT DO NOTHING`,
        [workspace.rows[0]!.id, user.rows[0]!.id, companyAdminRole.id, workspaceAdminRole.id],
      );

      await client.query(
        `INSERT INTO user_identities (user_id, provider, subject, email, last_login_at)
         VALUES ($1, 'local', $2, $3, now())
         ON CONFLICT (provider, subject) DO UPDATE SET email = EXCLUDED.email, last_login_at = now()`,
        [user.rows[0]!.id, input.admin.email.toLowerCase(), input.admin.email],
      );

      await client.query("COMMIT");
      return {
        user: this.safeUser(user.rows[0]! ),
        company: updatedCompany.rows[0] ?? null,
        workspace: workspace.rows[0] ?? null,
        memberships: [
          { workspace_id: workspace.rows[0]!.id, role_code: "COMPANY_ADMIN", role_name: "Company Admin", is_primary: true },
          { workspace_id: workspace.rows[0]!.id, role_code: "WORKSPACE_ADMIN", role_name: "Workspace Admin", is_primary: false },
        ],
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async registerUser(input: {
    companyFunctionalId: string;
    workspaceFunctionalId?: string;
    roleCode: string;
    email: string;
    display_name: string;
    first_name?: string;
    last_name?: string;
    passwordHash: string;
    passwordSalt: string;
  }): Promise<AuthSessionRecord> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");

      const companyResult = await client.query<CompanyRecord>("SELECT * FROM companies WHERE functional_id = $1", [input.companyFunctionalId]);
      const company = companyResult.rows[0];
      if (!company) {
        throw new Error("COMPANY_NOT_FOUND");
      }

      const workspaceResult = input.workspaceFunctionalId
        ? await client.query<WorkspaceRecord>("SELECT * FROM workspaces WHERE company_id = $1 AND functional_id = $2", [company.id, input.workspaceFunctionalId])
        : await client.query<WorkspaceRecord>("SELECT * FROM workspaces WHERE company_id = $1 ORDER BY created_at ASC LIMIT 1", [company.id]);
      const workspace = workspaceResult.rows[0];
      if (!workspace) {
        throw new Error("WORKSPACE_NOT_FOUND");
      }

      const roleMap = await this.getRoleMap(client, [input.roleCode]);
      const role = roleMap.get(input.roleCode);
      if (!role) {
        throw new Error("ROLE_NOT_FOUND");
      }

      const user = await client.query<AuthUserRecord>(
        `INSERT INTO users (company_id, workspace_id, external_id, email, display_name, first_name, last_name, is_active, password_hash, password_salt, password_changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, now())
         RETURNING *`,
        [
          company.id,
          workspace.id,
          input.email,
          input.email,
          input.display_name,
          input.first_name ?? null,
          input.last_name ?? null,
          input.passwordHash,
          input.passwordSalt,
        ],
      );

      await client.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role_id, membership_state, is_primary)
         VALUES ($1, $2, $3, 'ACTIVE', true)
         ON CONFLICT DO NOTHING`,
        [workspace.id, user.rows[0]!.id, role.id],
      );

      await client.query(
        `INSERT INTO user_identities (user_id, provider, subject, email, last_login_at)
         VALUES ($1, 'local', $2, $3, now())
         ON CONFLICT (provider, subject) DO UPDATE SET email = EXCLUDED.email, last_login_at = now()`,
        [user.rows[0]!.id, input.email.toLowerCase(), input.email],
      );

      await client.query("COMMIT");
      return {
        user: this.safeUser(user.rows[0]!),
        company,
        workspace,
        memberships: [{ workspace_id: workspace.id, role_code: role.code, role_name: role.name, is_primary: true }],
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async authenticate(input: { companyFunctionalId: string; workspaceFunctionalId?: string; email: string; password: string }): Promise<{ session: AuthSessionRecord; passwordHash: string; passwordSalt: string } | null> {
    const session = await this.findByEmail(input.companyFunctionalId, input.email);
    if (!session) return null;

    if (input.workspaceFunctionalId && session.workspace?.functional_id !== input.workspaceFunctionalId) {
      const workspaceResult = await this.db.query<WorkspaceRecord>(
        `SELECT w.*
         FROM workspaces w
         INNER JOIN workspace_memberships wm ON wm.workspace_id = w.id
         WHERE wm.user_id = $1 AND w.functional_id = $2
         LIMIT 1`,
        [session.user.id, input.workspaceFunctionalId],
      );
      if (!workspaceResult.rows[0]) return null;
      session.workspace = workspaceResult.rows[0];
    }

    const dbUser = await this.db.query<AuthUserRecord>("SELECT * FROM users WHERE id = $1", [session.user.id]);
    const user = dbUser.rows[0];
    if (!user?.password_hash || !user.password_salt) return null;

    return { session, passwordHash: user.password_hash, passwordSalt: user.password_salt };
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.db.query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
  }

  private safeUser(user: AuthUserRecord): AuthSessionRecord["user"] {
    const { password_hash: _passwordHash, password_salt: _passwordSalt, ...safeUser } = user;
    return safeUser;
  }
}