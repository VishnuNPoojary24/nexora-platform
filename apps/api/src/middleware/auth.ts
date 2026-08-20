import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";

const jwks = createRemoteJWKSet(new URL(`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/certs`));
const localJwtKey = new TextEncoder().encode(env.AUTH_JWT_SECRET);

async function verifyLocalToken(token: string) {
  return jwtVerify(token, localJwtKey, {
    issuer: "nexora-api",
  });
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  try {
    const token = header.slice("Bearer ".length);
    try {
      const { payload } = await verifyLocalToken(token);
      req.user = {
        externalId: typeof payload.sub === "string" ? payload.sub : "unknown",
        roles: Array.isArray(payload.roles) ? payload.roles.filter((role): role is string => typeof role === "string") : [],
        ...(typeof payload.sub === "string" ? { id: payload.sub } : {}),
        ...(typeof payload.email === "string" ? { email: payload.email } : {}),
        ...(typeof payload.companyId === "string" ? { companyId: payload.companyId } : {}),
        ...(typeof payload.workspaceId === "string" ? { workspaceId: payload.workspaceId } : {}),
        ...(typeof payload.displayName === "string" ? { displayName: payload.displayName } : {}),
      };
    } catch {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: env.KEYCLOAK_ISSUER,
        audience: env.KEYCLOAK_CLIENT_ID,
      });
      const realmRoles = (payload.realm_access as { roles?: string[] } | undefined)?.roles ?? [];
      req.user = {
        externalId: payload.sub ?? "unknown",
        roles: realmRoles,
        ...(typeof payload.email === "string" ? { email: payload.email } : {}),
      };
    }
  } catch {
    delete req.user;
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
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

  next();
}
