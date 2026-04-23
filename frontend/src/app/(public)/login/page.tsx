// frontend/src/app/(public)/login/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { identityApi } from "@/core/identity/api";
import { identityKeys } from "@/core/identity/query-keys";
import { type AuthProvider } from "@/core/identity/types";

const ERROR_MESSAGES: Record<string, string> = {
  oidc_callback_failed:
    "Sign-in via OIDC failed. Please try again or choose another provider.",
  no_membership:
    "Your account has no tenant membership yet. Contact your administrator.",
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const next = searchParams.get("next");

  const { data, isLoading, isError } = useQuery({
    queryKey: identityKeys.providers(),
    queryFn: identityApi.providers,
  });

  const providers: AuthProvider[] = data?.providers ?? [];

  const hrefFor = (id: string) =>
    `/api/auth/oidc/${id}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>

      {error && ERROR_MESSAGES[error] && (
        <div
          role="alert"
          className="w-full rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {ERROR_MESSAGES[error]}
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Loading providers…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          Could not reach the auth service.
        </p>
      )}

      {!isLoading && !isError && providers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No identity providers are configured. Contact your administrator.
        </p>
      )}

      <ul className="flex w-full flex-col gap-2">
        {providers.map((p) => (
          <li key={p.id}>
            <a
              href={hrefFor(p.id)}
              className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Continue with {p.display_name}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
