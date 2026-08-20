import { z } from "zod";
import { paginationSchema } from "./common.js";

export const teamListQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
});

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  is_active: z.boolean().default(true),
});

export const updateTeamSchema = createTeamSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamListQuery = z.infer<typeof teamListQuerySchema>;
