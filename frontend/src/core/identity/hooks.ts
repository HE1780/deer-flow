// frontend/src/core/identity/hooks.ts
"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";

import { identityApi } from "./api";
import { identityKeys } from "./query-keys";
import {
  type AuditFilters,
  type IdentityError,
  type MeResponse,
  type Permission,
} from "./types";

export function useIdentity() {
  const query = useQuery<MeResponse, IdentityError>({
    queryKey: identityKeys.me(),
    queryFn: identityApi.me,
    retry: false,
    staleTime: 60_000,
  });

  return {
    identity: query.data,
    isLoading: query.isLoading,
    isAuthenticated: query.isSuccess && !!query.data,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useHasPermission(perm: Permission): boolean {
  const { identity } = useIdentity();
  return useMemo(
    () => !!identity?.permissions.includes(perm),
    [identity, perm],
  );
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: identityApi.logout,
    onSettled: () => {
      qc.removeQueries({ queryKey: identityKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// A2: admin mutations + list queries
// ---------------------------------------------------------------------------

export function useSwitchTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: number) => identityApi.switchTenant(tenantId),
    onSuccess: () => {
      // Identity cookie is re-issued server-side; re-fetch everything identity-scoped.
      void qc.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

export function useTenants(
  params: { q?: string; offset?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: [...identityKeys.tenants(), params],
    queryFn: () => identityApi.listTenants(params),
    placeholderData: keepPreviousData,
  });
}

export function useTenant(id: number | undefined) {
  return useQuery({
    queryKey: id ? identityKeys.tenant(id) : [...identityKeys.tenants(), "disabled"],
    queryFn: () => identityApi.getTenant(id!),
    enabled: !!id,
  });
}

export function useUsers(
  tenantId: number | undefined,
  params: { q?: string; offset?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: tenantId
      ? [...identityKeys.users(tenantId), params]
      : [...identityKeys.all, "users", "disabled"],
    queryFn: () => identityApi.listUsers(tenantId!, params),
    placeholderData: keepPreviousData,
    enabled: !!tenantId,
  });
}

export function useUser(
  tenantId: number | undefined,
  userId: number | undefined,
) {
  return useQuery({
    queryKey:
      tenantId && userId
        ? identityKeys.user(tenantId, userId)
        : [...identityKeys.all, "user", "disabled"],
    queryFn: () =>
      identityApi.getUser(tenantId!, userId!),
    enabled: !!tenantId && !!userId,
  });
}

export function useWorkspaces(
  tenantId: number | undefined,
  params: { offset?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: tenantId
      ? [...identityKeys.workspaces(tenantId), params]
      : [...identityKeys.all, "workspaces", "disabled"],
    queryFn: () => identityApi.listWorkspaces(tenantId!, params),
    placeholderData: keepPreviousData,
    enabled: !!tenantId,
  });
}

export function useWorkspaceMembers(
  tenantId: number | undefined,
  wsId: number | undefined,
  params: { offset?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey:
      tenantId && wsId
        ? [...identityKeys.workspaceMembers(tenantId, wsId), params]
        : [...identityKeys.all, "workspace-members", "disabled"],
    queryFn: () =>
      identityApi.listWorkspaceMembers(
        tenantId!,
        wsId!,
        params,
      ),
    placeholderData: keepPreviousData,
    enabled: !!tenantId && !!wsId,
  });
}

export function useTenantTokens(
  tenantId: number | undefined,
  params: { include_revoked?: boolean; offset?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: tenantId
      ? [...identityKeys.tokens(), tenantId, params]
      : [...identityKeys.tokens(), "disabled"],
    queryFn: () =>
      identityApi.listTenantTokens(tenantId!, params),
    placeholderData: keepPreviousData,
    enabled: !!tenantId,
  });
}

export function useAudit(
  tenantId: number | undefined,
  filters: AuditFilters,
) {
  const filterKey = JSON.stringify(filters);
  return useQuery({
    queryKey: tenantId
      ? identityKeys.audit(tenantId, filterKey)
      : [...identityKeys.all, "audit", "disabled"],
    queryFn: () => identityApi.listAudit(tenantId!, filters),
    placeholderData: keepPreviousData,
    enabled: !!tenantId,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: identityKeys.roles(),
    queryFn: () => identityApi.listRoles(),
    staleTime: 5 * 60_000, // roles rarely change
  });
}
