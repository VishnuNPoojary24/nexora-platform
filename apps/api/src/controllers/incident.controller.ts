import type { Request, Response } from "express";
import type { IncidentService } from "../services/incident.service.js";
import { uuidParamSchema } from "../validation/common.js";
import { createIncidentSchema, incidentListQuerySchema, updateIncidentSchema } from "../validation/incident.validation.js";
import { ok, paginated } from "./helpers.js";

export class IncidentController {
  constructor(private readonly incidents: IncidentService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = incidentListQuerySchema.parse(req.query);
    const result = await this.incidents.list(query);
    paginated(res, result, query.page, query.pageSize);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(req.params);
    ok(res, await this.incidents.get(id));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = createIncidentSchema.parse(req.body);
    res.status(201);
    ok(res, await this.incidents.create(body, req.requestId, req.user?.id));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(req.params);
    const body = updateIncidentSchema.parse(req.body);
    ok(res, await this.incidents.update(id, body, req.requestId, req.user?.id));
  };
}
