export type IncidentStatus = "NEW" | "ASSIGNED" | "IN_PROGRESS" | "PENDING" | "RESOLVED" | "CLOSED";
export type IncidentPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface User {
  id: string;
  company_id: string | null;
  workspace_id: string | null;
  external_id: string | null;
  email: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  password_changed_at?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  functional_id: string;
  legal_name: string;
  display_name: string;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  primary_domain: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  company_id: string;
  functional_id: string;
  slug: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMembership {
  workspace_id: string;
  role_code: string;
  role_name: string;
  is_primary: boolean;
}

export interface AuthSession {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: User;
  company: Company | null;
  workspace: Workspace | null;
  memberships: WorkspaceMembership[];
}

export interface BootstrapCompanyInput {
  companyFunctionalId: string;
  companyLegalName: string;
  companyDisplayName: string;
  primaryDomain?: string;
  workspaceFunctionalId: string;
  workspaceSlug: string;
  workspaceName: string;
  admin: {
    email: string;
    password: string;
    display_name: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface RegisterUserInput {
  companyFunctionalId: string;
  workspaceFunctionalId?: string;
  roleCode: string;
  email: string;
  password: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginInput {
  companyFunctionalId: string;
  workspaceFunctionalId?: string;
  email: string;
  password: string;
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
