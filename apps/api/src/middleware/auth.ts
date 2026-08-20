import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";

const jwks = createRemoteJWKSet(new URL(`${env.KEYCLOAK_ISSUER}/protocol/openid-connect/certs`));

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  try {
    const token = header.slice("Bearer ".length);
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.KEYCLOAK_ISSUER,
      audience: env.KEYCLOAK_CLIENT_ID,
    });
    const realmRoles = (payload.realm_access as { roles?: string[] } | undefined)?.roles ?? [];
    req.user = {
      externalId: payload.sub ?? "unknown",
      roles: realmRoles,
    };
    if (typeof payload.email === "string") {
      req.user.email = payload.email;
    }
  } catch {
    delete req.user;
  }

  next();
}
