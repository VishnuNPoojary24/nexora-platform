import type { Request, Response } from "express";
import type { TeamService } from "../services/team.service.js";
import { uuidParamSchema } from "../validation/common.js";
import { createTeamSchema, teamListQuerySchema, updateTeamSchema } from "../validation/team.validation.js";
import { ok, paginated } from "./helpers.js";

export class TeamController {
  constructor(private readonly teams: TeamService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = teamListQuerySchema.parse(req.query);
    const result = await this.teams.list(query);
    paginated(res, result, query.page, query.pageSize);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(req.params);
    ok(res, await this.teams.get(id));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = createTeamSchema.parse(req.body);
    res.status(201);
    ok(res, await this.teams.create(body));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(req.params);
    const body = updateTeamSchema.parse(req.body);
    ok(res, await this.teams.update(id, body));
  };
}
