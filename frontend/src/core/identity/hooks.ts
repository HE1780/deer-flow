// frontend/src/core/identity/hooks.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { identityApi } from "./api";
import { identityKeys } from "./query-keys";
import { type IdentityError, type MeResponse, type Permission } from "./types";

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
