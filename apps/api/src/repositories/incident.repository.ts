import type { Pool, PoolClient } from "pg";
import type { CreateIncidentInput, IncidentListQuery, UpdateIncidentInput } from "../validation/incident.validation.js";
import type { IncidentRecord, ListResult } from "./types.js";

const sortableColumns = {
  number: "number",
  title: "title",
  priority: "priority",
  status: "status",
  created_at: "created_at",
} as const;

export class IncidentRepository {
  constructor(private readonly db: Pool) {}

  async list(query: IncidentListQuery): Promise<ListResult<IncidentRecord>> {
    const where: string[] = [];
    const values: unknown[] = [];

    if (query.search) {
      values.push(`%${query.search}%`);
      where.push(`(number ILIKE $${values.length} OR title ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }

    if (query.status) {
      values.push(query.status);
      where.push(`status = $${values.length}`);
    }

    if (query.priority) {
      values.push(query.priority);
      where.push(`priority = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sortBy = sortableColumns[query.sortBy];
    const sortDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
    values.push(query.pageSize, (query.page - 1) * query.pageSize);

    const result = await this.db.query<IncidentRecord & { total_count: string }>(
      `SELECT *, count(*) OVER() AS total_count
       FROM incidents
       ${whereSql}
       ORDER BY ${sortBy} ${sortDirection}
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  async findById(id: string): Promise<IncidentRecord | null> {
    const result = await this.db.query<IncidentRecord>("SELECT * FROM incidents WHERE id = $1", [id]);
    return result.rows[0] ?? null;
  }

  async create(input: CreateIncidentInput, client?: PoolClient): Promise<IncidentRecord> {
    const executor = client ?? this.db;
    const result = await executor.query<IncidentRecord>(
      `INSERT INTO incidents (title, description, priority, status, reported_by, assigned_to, assignment_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.title,
        input.description ?? null,
        input.priority,
        input.status,
        input.reported_by ?? null,
        input.assigned_to ?? null,
        input.assignment_group ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async update(id: string, input: UpdateIncidentInput, client?: PoolClient): Promise<IncidentRecord | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const executor = client ?? this.db;
    const result = await executor.query<IncidentRecord>(
      `UPDATE incidents
       SET title = $2,
           description = $3,
           priority = $4,
           status = $5,
           assigned_to = $6,
           assignment_group = $7,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.title ?? current.title,
        input.description ?? current.description,
        input.priority ?? current.priority,
        input.status ?? current.status,
        input.assigned_to ?? current.assigned_to,
        input.assignment_group ?? current.assignment_group,
      ],
    );
    return result.rows[0] ?? null;
  }
}
