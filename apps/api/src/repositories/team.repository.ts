import type { Pool } from "pg";
import type { CreateTeamInput, TeamListQuery, UpdateTeamInput } from "../validation/team.validation.js";
import type { ListResult, TeamRecord } from "./types.js";

export class TeamRepository {
  constructor(private readonly db: Pool) {}

  async list(query: TeamListQuery): Promise<ListResult<TeamRecord>> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (query.search) {
      values.push(`%${query.search}%`);
      where.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    values.push(query.pageSize, (query.page - 1) * query.pageSize);

    const result = await this.db.query<TeamRecord & { total_count: string }>(
      `SELECT *, count(*) OVER() AS total_count
       FROM teams
       ${whereSql}
       ORDER BY name ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  async findById(id: string): Promise<TeamRecord | null> {
    const result = await this.db.query<TeamRecord>("SELECT * FROM teams WHERE id = $1", [id]);
    return result.rows[0] ?? null;
  }

  async create(input: CreateTeamInput): Promise<TeamRecord> {
    const result = await this.db.query<TeamRecord>(
      `INSERT INTO teams (name, description, is_active)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.name, input.description ?? null, input.is_active],
    );
    return result.rows[0]!;
  }

  async update(id: string, input: UpdateTeamInput): Promise<TeamRecord | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const result = await this.db.query<TeamRecord>(
      `UPDATE teams
       SET name = $2,
           description = $3,
           is_active = $4,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, input.name ?? current.name, input.description ?? current.description, input.is_active ?? current.is_active],
    );
    return result.rows[0] ?? null;
  }
}
