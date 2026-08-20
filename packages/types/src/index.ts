export type IncidentStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "PENDING" | "RESOLVED" | "CLOSED";
export type IncidentPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface User {
  id: string;
  external_id: string | null;
  email: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Incident {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: IncidentStatus;
  priority: IncidentPriority;
  reported_by: string | null;
  assigned_to: string | null;
  assignment_group: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedApiResponse<T> {
  success: true;
  data: T[];
  pagination: Pagination;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export interface IncidentListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: IncidentStatus;
  priority?: IncidentPriority;
  sortBy?: "number" | "title" | "priority" | "status" | "created_at";
  sortDirection?: "asc" | "desc";
}

export type CreateIncidentInput = Pick<Incident, "title" | "priority" | "status"> &
  Partial<Pick<Incident, "description" | "assigned_to" | "assignment_group" | "reported_by">>;

export type UpdateIncidentInput = Partial<CreateIncidentInput>;

export type CreateUserInput = Pick<User, "email" | "display_name"> &
  Partial<Pick<User, "external_id" | "first_name" | "last_name" | "is_active">>;

export type UpdateUserInput = Partial<CreateUserInput>;

export type CreateTeamInput = Pick<Team, "name"> & Partial<Pick<Team, "description" | "is_active">>;
export type UpdateTeamInput = Partial<CreateTeamInput>;
