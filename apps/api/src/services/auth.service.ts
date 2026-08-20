import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT } from "jose";
import { env } from "../config/env.js";
import type { AuthRepository, AuthSessionRecord } from "../repositories/auth.repository.js";
import type { BootstrapCompanyInput, LoginInput, RegisterUserInput } from "../validation/auth.validation.js";

const scrypt = promisify(scryptCallback);

async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return {
    salt,
    hash: derivedKey.toString("hex"),
  };
}

async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const actual = Buffer.from(derivedKey.toString("hex"), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function signSession(session: AuthSessionRecord): Promise<string> {
  const primaryMembership = session.memberships.find((membership) => membership.is_primary) ?? session.memberships[0];
  return new SignJWT({
    email: session.user.email,
    displayName: session.user.display_name,
    companyId: session.company?.id,
    workspaceId: session.workspace?.id ?? primaryMembership?.workspace_id,
    roles: session.memberships.map((membership) => membership.role_code),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(session.user.id)
    .setIssuer("nexora-api")
    .setIssuedAt()
    .setExpirationTime(`${env.AUTH_JWT_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(env.AUTH_JWT_SECRET));
}

export class AuthService {
  constructor(private readonly auth: AuthRepository) {}

  async bootstrapCompany(input: BootstrapCompanyInput) {
    const { hash, salt } = await hashPassword(input.admin.password);
    const session = await this.auth.bootstrapCompany({
      companyFunctionalId: input.companyFunctionalId,
      companyLegalName: input.companyLegalName,
      companyDisplayName: input.companyDisplayName,
      workspaceFunctionalId: input.workspaceFunctionalId,
      workspaceSlug: input.workspaceSlug,
      workspaceName: input.workspaceName,
      admin: {
        email: input.admin.email,
        display_name: input.admin.display_name,
        ...(input.admin.first_name ? { first_name: input.admin.first_name } : {}),
        ...(input.admin.last_name ? { last_name: input.admin.last_name } : {}),
      },
      passwordHash: hash,
      passwordSalt: salt,
      ...(input.primaryDomain ? { primaryDomain: input.primaryDomain } : {}),
    });
    const accessToken = await signSession(session);
    return { ...session, accessToken, tokenType: "Bearer", expiresIn: env.AUTH_JWT_TTL_SECONDS };
  }

  async registerUser(input: RegisterUserInput) {
    const { hash, salt } = await hashPassword(input.password);
    const session = await this.auth.registerUser({
      companyFunctionalId: input.companyFunctionalId,
      ...(input.workspaceFunctionalId ? { workspaceFunctionalId: input.workspaceFunctionalId } : {}),
      roleCode: input.roleCode,
      email: input.email,
      display_name: input.display_name,
      ...(input.first_name ? { first_name: input.first_name } : {}),
      ...(input.last_name ? { last_name: input.last_name } : {}),
      passwordHash: hash,
      passwordSalt: salt,
    });
    const accessToken = await signSession(session);
    return { ...session, accessToken, tokenType: "Bearer", expiresIn: env.AUTH_JWT_TTL_SECONDS };
  }

  async login(input: LoginInput) {
    const result = await this.auth.authenticate({
      companyFunctionalId: input.companyFunctionalId,
      email: input.email,
      password: input.password,
      ...(input.workspaceFunctionalId ? { workspaceFunctionalId: input.workspaceFunctionalId } : {}),
    });
    if (!result) {
      return null;
    }

    const ok = await verifyPassword(input.password, result.passwordSalt, result.passwordHash);
    if (!ok) {
      return null;
    }

    await this.auth.touchLastLogin(result.session.user.id);
    const refreshed = await this.auth.findById(result.session.user.id);
    if (!refreshed) {
      return null;
    }
    const accessToken = await signSession(refreshed);
    return { ...refreshed, accessToken, tokenType: "Bearer", expiresIn: env.AUTH_JWT_TTL_SECONDS };
  }

  async me(userId: string) {
    const session = await this.auth.findById(userId);
    if (!session) return null;
    const accessToken = await signSession(session);
    return { ...session, accessToken, tokenType: "Bearer", expiresIn: env.AUTH_JWT_TTL_SECONDS };
  }
}