// frontend/tests/e2e/identity/fixtures/mock-backend.ts
import { type Page, type Route } from "@playwright/test";

export interface MockIdentityOptions {
  authenticated?: boolean;
  permissions?: string[];
  tenants?: Array<{ id: number; slug: string; name: string }>;
  workspaces?: Array<{ id: number; slug: string; name: string }>;
  providers?: Array<{
    id: string;
    display_name: string;
    icon_url: string | null;
  }>;
}

const DEFAULT_PROVIDERS = [
  { id: "okta", display_name: "Okta", icon_url: null },
  { id: "keycloak", display_name: "Keycloak", icon_url: null },
];

export async function mockIdentity(
  page: Page,
  opts: MockIdentityOptions = {},
): Promise<void> {
  const providers = opts.providers ?? DEFAULT_PROVIDERS;
  const authenticated = opts.authenticated ?? false;

  await page.route("**/api/auth/providers", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ providers }),
    }),
  );

  await page.route("**/api/me", (route: Route) => {
    if (!authenticated) return route.fulfill({ status: 401, body: "" });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user_id: 42,
        email: "demo@deerflow.local",
        display_name: "Demo",
        avatar_url: null,
        active_tenant_id: 1,
        tenants: opts.tenants ?? [{ id: 1, slug: "default", name: "Default" }],
        workspaces: opts.workspaces ?? [
          { id: 7, slug: "main", name: "Main" },
        ],
        permissions: opts.permissions ?? ["tenant:read", "workspace:read"],
        roles: { "tenant:1": ["tenant_owner"] },
      }),
    });
  });

  await page.route("**/api/auth/logout", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok" }),
    }),
  );

  if (authenticated) {
    await page.context().addCookies([
      {
        name: "deerflow_session",
        value: "fake-cookie-value-for-middleware-check",
        url: "http://localhost:3000",
        httpOnly: true,
      },
    ]);
  }
}
