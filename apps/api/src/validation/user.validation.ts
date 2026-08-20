import { z } from "zod";
import { paginationSchema } from "./common.js";

export const userListQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
});

export const createUserSchema = z.object({
  external_id: z.string().trim().optional(),
  email: z.email(),
  display_name: z.string().trim().min(1),
  first_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  is_active: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
