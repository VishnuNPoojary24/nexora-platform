import { pool } from "../config/database.js";
import { publishEvent } from "../config/rabbitmq.js";
import { NotFoundError } from "../errors/app-error.js";
import type { AuditRepository } from "../repositories/audit.repository.js";
import type { IncidentRepository } from "../repositories/incident.repository.js";
import type { CreateIncidentInput, IncidentListQuery, UpdateIncidentInput } from "../validation/incident.validation.js";

export class IncidentService {
  constructor(
    private readonly incidents: IncidentRepository,
    private readonly audit: AuditRepository,
  ) {}

  list(query: IncidentListQuery) {
    return this.incidents.list(query);
  }

  async get(id: string) {
    const incident = await this.incidents.findById(id);
    if (!incident) throw new NotFoundError("INCIDENT_NOT_FOUND", "Incident was not found");
    return incident;
  }

  async create(input: CreateIncidentInput, requestId: string, actorUserId?: string) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const incident = await this.incidents.create(input, client);
      await this.audit.create(
        {
          actorUserId,
          action: "INCIDENT_CREATED",
          entityType: "incident",
          entityId: incident.id,
          newValues: incident,
          requestId,
        },
        client,
      );
      await client.query("COMMIT");

      publishEvent("incident.created", { incidentId: incident.id, number: incident.number, requestId }).catch((error: unknown) => {
        console.warn(JSON.stringify({ level: "warn", requestId, message: "incident.created publish failed", error: String(error) }));
      });

      return incident;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, input: UpdateIncidentInput, requestId: string, actorUserId?: string) {
    const oldIncident = await this.get(id);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const incident = await this.incidents.update(id, input, client);
      if (!incident) throw new NotFoundError("INCIDENT_NOT_FOUND", "Incident was not found");

      await this.audit.create(
        {
          actorUserId,
          action: oldIncident.status !== incident.status ? "INCIDENT_STATUS_CHANGED" : "INCIDENT_UPDATED",
          entityType: "incident",
          entityId: incident.id,
          oldValues: oldIncident,
          newValues: incident,
          requestId,
        },
        client,
      );

      await client.query("COMMIT");
      return incident;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
