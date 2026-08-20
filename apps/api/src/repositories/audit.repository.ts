import type { Pool, PoolClient } from "pg";

export interface AuditInput {
  actorUserId?: string | undefined;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  requestId: string;
}

export class AuditRepository {
  constructor(private readonly db: Pool) {}

  async create(input: AuditInput, client?: PoolClient): Promise<void> {
    const executor = client ?? this.db;
    await executor.query(
      `INSERT INTO audit_logs (
        actor_user_id, action, entity_type, entity_id, old_values, new_values, request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.actorUserId ?? null,
        input.action,
        input.entityType,
        input.entityId,
        input.oldValues ? JSON.stringify(input.oldValues) : null,
        input.newValues ? JSON.stringify(input.newValues) : null,
        input.requestId,
      ],
    );
  }
}
