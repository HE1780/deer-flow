// frontend/src/app/(admin)/admin/tenants/[id]/page.tsx
"use client";

import Link from "next/link";
import { use } from "react";

import { RequirePermission } from "@/core/identity/components/RequirePermission";
import { useTenant } from "@/core/identity/hooks";

interface Props {
  params: Promise<{ id: string }>;
}

export default function TenantDetailPage({ params }: Props) {
  const { id } = use(params);
  const tenantId = Number(id);
  return (
    <RequirePermission perm="tenant:read">
      <Inner id={tenantId} />
    </RequirePermission>
  );
}

function Inner({ id }: { id: number }) {
  const { data, isLoading, isError } = useTenant(id);
  if (isLoading)
    return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (isError || !data)
    return <p className="p-6 text-destructive">Tenant not found.</p>;
  return (
    <section className="p-6">
      <header className="mb-4">
        <Link
          href="/admin/tenants"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Tenants
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{data.name}</h1>
        <p className="text-sm text-muted-foreground">
          <code>/{data.slug}</code> · #{data.id}
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Plan</dt>
          <dd>{data.plan}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{data.status === 1 ? "active" : "disabled"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Workspaces</dt>
          <dd>{data.workspace_count}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Members</dt>
          <dd>{data.member_count}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{data.created_at?.slice(0, 10) ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
