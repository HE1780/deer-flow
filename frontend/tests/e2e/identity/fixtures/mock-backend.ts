// frontend/tests/e2e/identity/fixtures/mock-backend.ts
import { type Page, type Route } from "@playwright/test";

import type {
  AuditRow,
  CursorListResponse,
  OffsetListResponse,
  RoleRow,
  TenantDetail,
  TenantRow,
  TokenRow,
  UserRow,
  WorkspaceMemberRow,
  WorkspaceRow,
} from "@/core/identity/types";

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

// ---------------------------------------------------------------------------
// A2 admin-read route mocks — opt-in per spec via mockAdmin(page, opts).
// ---------------------------------------------------------------------------

export interface MockAdminOptions {
  tenants?: OffsetListResponse<TenantRow>;
  tenantDetail?: Record<number, TenantDetail>;
  users?: OffsetListResponse<UserRow>;
  userDetail?: Record<number, UserRow>;
  workspaces?: OffsetListResponse<WorkspaceRow>;
  workspaceMembers?: Record<number, OffsetListResponse<WorkspaceMemberRow>>;
  tokens?: OffsetListResponse<TokenRow>;
  audit?: CursorListResponse<AuditRow>;
  auditPage2?: CursorListResponse<AuditRow>; // served when ?cursor= is set
  roles?: { roles: RoleRow[] };
}

export async function mockAdmin(
  page: Page,
  opts: MockAdminOptions = {},
): Promise<void> {
  // /api/admin/tenants/{id} — register BEFORE the list route so the regex
  // beats the wildcard.
  await page.route(/\/api\/admin\/tenants\/(\d+)/, (route: Route) => {
    const id = Number(
      (/\/tenants\/(\d+)/.exec(route
        .request()
        .url()))?.[1] ?? 0,
    );
    const detail = opts.tenantDetail?.[id];
    return route.fulfill(
      detail
        ? {
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(detail),
          }
        : { status: 404, body: "" },
    );
  });

  await page.route("**/api/admin/tenants*", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(opts.tenants ?? { items: [], total: 0 }),
    }),
  );

  // /api/tenants/{tid}/users/{uid} — register before the list route.
  await page.route(
    /\/api\/tenants\/(\d+)\/users\/(\d+)/,
    (route: Route) => {
      const uid = Number(
        (/\/users\/(\d+)/.exec(route
          .request()
          .url()))?.[1] ?? 0,
      );
      const detail = opts.userDetail?.[uid];
      return route.fulfill(
        detail
          ? {
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(detail),
            }
          : { status: 404, body: "" },
      );
    },
  );

  await page.route(/\/api\/tenants\/(\d+)\/users(\?|$)/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(opts.users ?? { items: [], total: 0 }),
    }),
  );

  await page.route(
    /\/api\/tenants\/(\d+)\/workspaces\/(\d+)\/members/,
    (route: Route) => {
      const wid = Number(
        (/\/workspaces\/(\d+)\/members/.exec(route
          .request()
          .url()))?.[1] ?? 0,
      );
      const data = opts.workspaceMembers?.[wid] ?? { items: [], total: 0 };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    },
  );

  await page.route(
    /\/api\/tenants\/(\d+)\/workspaces(\?|$)/,
    (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(opts.workspaces ?? { items: [], total: 0 }),
      }),
  );

  await page.route(/\/api\/tenants\/(\d+)\/tokens/, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(opts.tokens ?? { items: [], total: 0 }),
    }),
  );

  await page.route(/\/api\/tenants\/(\d+)\/audit/, (route: Route) => {
    const hasCursor = route.request().url().includes("cursor=");
    const payload =
      hasCursor && opts.auditPage2
        ? opts.auditPage2
        : (opts.audit ?? { items: [], next_cursor: null });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  await page.route("**/api/roles", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(opts.roles ?? { roles: [] }),
    }),
  );
}
