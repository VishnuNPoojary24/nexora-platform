import { z } from "zod";
import { paginationSchema } from "./common.js";

export const incidentStatusSchema = z.enum(["NEW", "ASSIGNED", "IN_PROGRESS", "PENDING", "RESOLVED", "CLOSED"]);
export const incidentPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const incidentListQuerySchema = paginationSchema.extend({
  search: z.string().trim().optional(),
  status: incidentStatusSchema.optional(),
  priority: incidentPrioritySchema.optional(),
  sortBy: z.enum(["number", "title", "priority", "status", "created_at"]).default("created_at"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const createIncidentSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional(),
  priority: incidentPrioritySchema.default("MEDIUM"),
  status: incidentStatusSchema.default("NEW"),
  reported_by: z.uuid().optional(),
  assigned_to: z.uuid().optional().nullable(),
  assignment_group: z.uuid().optional().nullable(),
});

export const updateIncidentSchema = createIncidentSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type IncidentListQuery = z.infer<typeof incidentListQuerySchema>;
