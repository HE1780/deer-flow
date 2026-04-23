// frontend/src/core/identity/api.ts
import { identityFetch } from "./fetcher";
import {
  type AuditFilters,
  type AuditRow,
  type CursorListResponse,
  type MeResponse,
  type OffsetListResponse,
  type PermissionsResponse,
  type ProvidersResponse,
  type RolesResponse,
  type SwitchTenantResponse,
  type TenantDetail,
  type TenantRow,
  type TokenRow,
  type UserRow,
  type WorkspaceMemberRow,
  type WorkspaceRow,
} from "./types";

function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    // Only primitives survive URL encoding; objects would stringify to
    // "[object Object]" which silently corrupts the query. Skip them.
    if (typeof v === "string") p.set(k, v);
    else if (typeof v === "number" || typeof v === "boolean")
      p.set(k, v.toString());
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const identityApi = {
  // --- A1 surface (unchanged) ---
  me: () => identityFetch<MeResponse>("/api/me"),
  providers: () => identityFetch<ProvidersResponse>("/api/auth/providers"),
  logout: () =>
    identityFetch<{ status: string }>("/api/auth/logout", { method: "POST" }),
  refresh: () =>
    identityFetch<{ access_token: string; expires_in: number }>(
      "/api/auth/refresh",
      { method: "POST" },
    ),

  // --- A2: admin reads ---
  switchTenant: (tenantId: number) =>
    identityFetch<SwitchTenantResponse>("/api/me/switch-tenant", {
      method: "POST",
      body: JSON.stringify({ tenant_id: tenantId }),
    }),

  listTenants: (
    params: { q?: string; offset?: number; limit?: number } = {},
  ) =>
    identityFetch<OffsetListResponse<TenantRow>>(
      `/api/admin/tenants${qs(params)}`,
    ),
  getTenant: (id: number) =>
    identityFetch<TenantDetail>(`/api/admin/tenants/${id}`),

  listUsers: (
    tenantId: number,
    params: { q?: string; offset?: number; limit?: number } = {},
  ) =>
    identityFetch<OffsetListResponse<UserRow>>(
      `/api/tenants/${tenantId}/users${qs(params)}`,
    ),
  getUser: (tenantId: number, userId: number) =>
    identityFetch<UserRow>(`/api/tenants/${tenantId}/users/${userId}`),

  listWorkspaces: (
    tenantId: number,
    params: { offset?: number; limit?: number } = {},
  ) =>
    identityFetch<OffsetListResponse<WorkspaceRow>>(
      `/api/tenants/${tenantId}/workspaces${qs(params)}`,
    ),
  listWorkspaceMembers: (
    tenantId: number,
    wsId: number,
    params: { offset?: number; limit?: number } = {},
  ) =>
    identityFetch<OffsetListResponse<WorkspaceMemberRow>>(
      `/api/tenants/${tenantId}/workspaces/${wsId}/members${qs(params)}`,
    ),

  listTenantTokens: (
    tenantId: number,
    params: { include_revoked?: boolean; offset?: number; limit?: number } = {},
  ) =>
    identityFetch<OffsetListResponse<TokenRow>>(
      `/api/tenants/${tenantId}/tokens${qs(params)}`,
    ),

  listAudit: (tenantId: number, filters: AuditFilters = {}) =>
    identityFetch<CursorListResponse<AuditRow>>(
      `/api/tenants/${tenantId}/audit${qs(filters as Record<string, unknown>)}`,
    ),

  listRoles: () => identityFetch<RolesResponse>("/api/roles"),
  listPermissions: () =>
    identityFetch<PermissionsResponse>("/api/permissions"),
};
