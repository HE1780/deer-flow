// frontend/src/app/(admin)/admin/roles/page.tsx
"use client";

import { useRoles } from "@/core/identity/hooks";
import type { RoleRow } from "@/core/identity/types";

export default function RolesPage() {
  const { data, isLoading } = useRoles();
  if (isLoading)
    return (
      <section className="p-6 text-muted-foreground" role="status">
        Loading…
      </section>
    );
  const grouped = new Map<string, RoleRow[]>();
  (data?.roles ?? []).forEach((r) => {
    const arr = grouped.get(r.scope) ?? [];
    arr.push(r);
    grouped.set(r.scope, arr);
  });
  return (
    <section className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Roles</h1>
      {(["platform", "tenant", "workspace"] as const).map((scope) => (
        <div key={scope} className="mb-6">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {scope}
          </h2>
          <ul className="space-y-3">
            {(grouped.get(scope) ?? []).map((r) => (
              <li key={r.role_key} className="rounded-md border p-3">
                <p className="font-medium">{r.display_name ?? r.role_key}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{r.role_key}</code>
                  {r.is_builtin && <span className="ml-2">· builtin</span>}
                </p>
                {r.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
