// frontend/src/core/identity/types.ts

export type Permission = string; // e.g. "tenant:read", "workspace:write"

export type RoleName =
  | "platform_admin"
  | "tenant_owner"
  | "workspace_admin"
  | "member"
  | "viewer";

// /api/me response shape (matches backend MeResponse in routers/me.py).
export interface MeResponse {
  user_id: number;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  active_tenant_id: number | null;
  tenants: Array<{ id: number; slug: string; name: string }>;
  workspaces: Array<{ id: number; slug: string; name: string }>;
  permissions: Permission[];
  // roles is a map keyed by scope: {"platform":[...], "tenant:1":[...], "workspace:7":[...]}
  roles: Record<string, RoleName[]>;
}

export interface AuthProvider {
  id: string;
  display_name: string;
  icon_url: string | null;
}

export interface ProvidersResponse {
  providers: AuthProvider[];
}

export type IdentityError =
  | { kind: "unauthenticated" }
  | { kind: "forbidden"; missing?: Permission }
  | { kind: "network"; status: number; message: string };
