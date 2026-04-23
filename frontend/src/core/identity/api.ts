// frontend/src/core/identity/api.ts
import { identityFetch } from "./fetcher";
import { type MeResponse, type ProvidersResponse } from "./types";

export const identityApi = {
  me: () => identityFetch<MeResponse>("/api/me"),
  providers: () => identityFetch<ProvidersResponse>("/api/auth/providers"),
  logout: () =>
    identityFetch<{ status: string }>("/api/auth/logout", { method: "POST" }),
  refresh: () =>
    identityFetch<{ access_token: string; expires_in: number }>(
      "/api/auth/refresh",
      { method: "POST" },
    ),
};
