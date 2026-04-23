// frontend/src/app/(admin)/admin/profile/page.tsx
"use client";

import Link from "next/link";

import { useIdentity } from "@/core/identity/hooks";

export default function ProfilePage() {
  const { identity, isLoading } = useIdentity();

  if (isLoading) {
    return (
      <main className="p-8 text-muted-foreground" role="status">
        Loading…
      </main>
    );
  }

  if (!identity) {
    return (
      <main className="p-8">
        <p>Not signed in.</p>
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-6 flex items-center gap-4">
        {identity.avatar_url && (
          <img
            src={identity.avatar_url}
            alt=""
            className="h-12 w-12 rounded-full"
          />
        )}
        <div>
          <h1 className="text-xl font-semibold">
            {identity.display_name ?? identity.email ?? `user ${identity.user_id}`}
          </h1>
          <p className="text-sm text-muted-foreground">{identity.email}</p>
        </div>
        <Link
          href="/logout"
          className="ml-auto inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-accent"
        >
          Sign out
        </Link>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Active tenant
        </h2>
        <p className="text-sm">
          {identity.active_tenant_id != null
            ? (identity.tenants.find((t) => t.id === identity.active_tenant_id)
                ?.name ?? `#${identity.active_tenant_id}`)
            : "(none)"}
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Workspaces
        </h2>
        <ul className="list-disc pl-6 text-sm">
          {identity.workspaces.map((w) => (
            <li key={w.id}>{w.name}</li>
          ))}
          {identity.workspaces.length === 0 && (
            <li className="list-none text-muted-foreground">(none)</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Permissions
        </h2>
        <div className="flex flex-wrap gap-1">
          {identity.permissions.map((p) => (
            <code
              key={p}
              className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono"
            >
              {p}
            </code>
          ))}
        </div>
      </section>
    </main>
  );
}
