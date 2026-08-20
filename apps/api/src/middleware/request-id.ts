import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const requestIdPattern = /^[a-zA-Z0-9._:-]{8,128}$/;

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
      id?: string;
      externalId: string;
      email?: string;
      roles: string[];
    };
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header("X-Request-ID");
  req.requestId = supplied && requestIdPattern.test(supplied) ? supplied : randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
}
