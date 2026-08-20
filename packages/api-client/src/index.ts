import type {
  ApiErrorResponse,
  AuthSession,
  BootstrapCompanyInput,
  ApiResponse,
  CreateIncidentInput,
  CreateTeamInput,
  CreateUserInput,
  Incident,
  IncidentListQuery,
  LoginInput,
  PaginatedApiResponse,
  RegisterUserInput,
  Team,
  UpdateIncidentInput,
  UpdateTeamInput,
  UpdateUserInput,
  User,
} from "@nexora/types";

export interface ApiClientOptions {
  baseUrl?: string;
  getAccessToken?: () => string | undefined;
}

export class NexoraApiError extends Error {
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(code: string, message: string, requestId?: string, details?: unknown) {
    super(message);
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

const defaultBaseUrl = "http://localhost:3000";

function toQuery(params: { [key: string]: string | number | undefined }): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const output = search.toString();
  return output ? `?${output}` : "";
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? defaultBaseUrl;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = options.getAccessToken?.();
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

    const payload = (await response.json()) as ApiResponse<T> | ApiErrorResponse | T;
    if (!response.ok || (typeof payload === "object" && payload !== null && "success" in payload && payload.success === false)) {
      const errorPayload = payload as ApiErrorResponse;
      throw new NexoraApiError(
        errorPayload.error?.code ?? "API_ERROR",
        errorPayload.error?.message ?? "API request failed",
        errorPayload.error?.requestId,
        errorPayload.error?.details,
      );
    }

    if (typeof payload === "object" && payload !== null && "success" in payload && payload.success === true && "data" in payload) {
      return payload.data as T;
    }

    return payload as T;
  }

  async function paginated<T>(path: string): Promise<PaginatedApiResponse<T>> {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        ...(options.getAccessToken?.() ? { Authorization: `Bearer ${options.getAccessToken?.()}` } : {}),
      },
    });
    const payload = (await response.json()) as PaginatedApiResponse<T> | ApiErrorResponse;
    if (!response.ok || payload.success === false) {
      const errorPayload = payload as ApiErrorResponse;
      throw new NexoraApiError(errorPayload.error.code, errorPayload.error.message, errorPayload.error.requestId, errorPayload.error.details);
    }
    return payload as PaginatedApiResponse<T>;
  }

  return {
    bootstrapCompany: (input: BootstrapCompanyInput) =>
      request<AuthSession>("/api/v1/auth/bootstrap-company", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    registerUser: (input: RegisterUserInput) =>
      request<AuthSession>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    login: (input: LoginInput) =>
      request<AuthSession>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    me: () => request<AuthSession>("/api/v1/auth/me"),
    getIncidents: (query: IncidentListQuery = {}) => paginated<Incident>(`/api/v1/incidents${toQuery({ ...query })}`),
    getIncident: (id: string) => request<Incident>(`/api/v1/incidents/${id}`),
    createIncident: (input: CreateIncidentInput) =>
      request<Incident>("/api/v1/incidents", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateIncident: (id: string, input: UpdateIncidentInput) =>
      request<Incident>(`/api/v1/incidents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    getUsers: (query: { page?: number; pageSize?: number; search?: string } = {}) => paginated<User>(`/api/v1/users${toQuery(query)}`),
    getUser: (id: string) => request<User>(`/api/v1/users/${id}`),
    createUser: (input: CreateUserInput) =>
      request<User>("/api/v1/users", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateUser: (id: string, input: UpdateUserInput) =>
      request<User>(`/api/v1/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    getTeams: (query: { page?: number; pageSize?: number; search?: string } = {}) => paginated<Team>(`/api/v1/teams${toQuery(query)}`),
    getTeam: (id: string) => request<Team>(`/api/v1/teams/${id}`),
    createTeam: (input: CreateTeamInput) =>
      request<Team>("/api/v1/teams", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateTeam: (id: string, input: UpdateTeamInput) =>
      request<Team>(`/api/v1/teams/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
  };
}

export const apiClient = createApiClient({
  baseUrl: typeof import.meta !== "undefined" ? import.meta.env.VITE_API_URL : defaultBaseUrl,
  getAccessToken:
    typeof window !== "undefined"
      ? () => window.localStorage.getItem("nexora-auth-token") ?? undefined
      : undefined,
});
