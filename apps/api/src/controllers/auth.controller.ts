import type { Request, Response } from "express";
import { ok } from "./helpers.js";
import { bootstrapCompanySchema, loginSchema, registerUserSchema } from "../validation/auth.validation.js";
import type { AuthService } from "../services/auth.service.js";

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  bootstrapCompany = async (req: Request, res: Response): Promise<void> => {
    const body = bootstrapCompanySchema.parse(req.body);
    res.status(201);
    ok(res, await this.auth.bootstrapCompany(body));
  };

  registerUser = async (req: Request, res: Response): Promise<void> => {
    const body = registerUserSchema.parse(req.body);
    res.status(201);
    ok(res, await this.auth.registerUser(body));
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const body = loginSchema.parse(req.body);
    const session = await this.auth.login(body);
    if (!session) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid credentials",
          requestId: req.requestId,
        },
      });
      return;
    }
    ok(res, session);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication is required",
          requestId: req.requestId,
        },
      });
      return;
    }

    const session = await this.auth.me(req.user.id);
    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Session was not found",
          requestId: req.requestId,
        },
      });
      return;
    }

    ok(res, session);
  };
}