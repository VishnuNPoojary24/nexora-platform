import type { Pool } from "pg";
import type { CreateUserInput, UpdateUserInput, UserListQuery } from "../validation/user.validation.js";
import type { ListResult, UserRecord } from "./types.js";

export class UserRepository {
  constructor(private readonly db: Pool) {}

  async list(query: UserListQuery): Promise<ListResult<UserRecord>> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (query.search) {
      values.push(`%${query.search}%`);
      where.push(`(email ILIKE $${values.length} OR display_name ILIKE $${values.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    values.push(query.pageSize, (query.page - 1) * query.pageSize);

    const result = await this.db.query<UserRecord & { total_count: string }>(
      `SELECT *, count(*) OVER() AS total_count
       FROM users
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.db.query<UserRecord>("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] ?? null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const result = await this.db.query<UserRecord>(
      `INSERT INTO users (external_id, email, display_name, first_name, last_name, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.external_id ?? null, input.email, input.display_name, input.first_name ?? null, input.last_name ?? null, input.is_active],
    );
    return result.rows[0]!;
  }

  async update(id: string, input: UpdateUserInput): Promise<UserRecord | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const result = await this.db.query<UserRecord>(
      `UPDATE users
       SET external_id = $2,
           email = $3,
           display_name = $4,
           first_name = $5,
           last_name = $6,
           is_active = $7,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.external_id ?? current.external_id,
        input.email ?? current.email,
        input.display_name ?? current.display_name,
        input.first_name ?? current.first_name,
        input.last_name ?? current.last_name,
        input.is_active ?? current.is_active,
      ],
    );
    return result.rows[0] ?? null;
  }
}
