import { z } from "zod";

const functionalIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Use letters, numbers, dashes, or underscores");

const passwordSchema = z.string().min(8).max(128);

const personSchema = z.object({
  email: z.email(),
  password: passwordSchema,
  display_name: z.string().trim().min(1),
  first_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
});

export const bootstrapCompanySchema = z.object({
  companyFunctionalId: functionalIdSchema,
  companyLegalName: z.string().trim().min(2),
  companyDisplayName: z.string().trim().min(2),
  primaryDomain: z.string().trim().optional(),
  workspaceFunctionalId: functionalIdSchema,
  workspaceSlug: functionalIdSchema,
  workspaceName: z.string().trim().min(2),
  admin: personSchema,
});

export const registerUserSchema = z.object({
  companyFunctionalId: functionalIdSchema,
  workspaceFunctionalId: functionalIdSchema.optional(),
  roleCode: z.string().trim().min(2).max(64).default("REQUESTER"),
  ...personSchema.shape,
});

export const loginSchema = z.object({
  companyFunctionalId: functionalIdSchema,
  workspaceFunctionalId: functionalIdSchema.optional(),
  email: z.email(),
  password: passwordSchema,
});

export const authMeSchema = z.object({
  id: z.uuid(),
});

export type BootstrapCompanyInput = z.infer<typeof bootstrapCompanySchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;