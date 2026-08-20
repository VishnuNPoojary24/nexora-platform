import type { Request, Response } from "express";
import { uuidParamSchema } from "../validation/common.js";
import { createUserSchema, updateUserSchema, userListQuerySchema } from "../validation/user.validation.js";
import type { UserService } from "../services/user.service.js";
import { ok, paginated } from "./helpers.js";

export class UserController {
  constructor(private readonly users: UserService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const query = userListQuerySchema.parse(req.query);
    const result = await this.users.list(query);
    paginated(res, result, query.page, query.pageSize);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(req.params);
    ok(res, await this.users.get(id));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const body = createUserSchema.parse(req.body);
    res.status(201);
    ok(res, await this.users.create(body));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = uuidParamSchema.parse(req.params);
    const body = updateUserSchema.parse(req.body);
    ok(res, await this.users.update(id, body));
  };
}
