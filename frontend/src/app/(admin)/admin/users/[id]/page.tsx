// frontend/src/app/(admin)/admin/users/[id]/page.tsx
"use client";

import Link from "next/link";
import { use } from "react";

import { PermBadge } from "@/core/identity/components/PermBadge";
import { RequirePermission } from "@/core/identity/components/RequirePermission";
import { useIdentity, useUser } from "@/core/identity/hooks";

interface Props {
  params: Promise<{ id: string }>;
}

export default function UserDetailPage({ params }: Props) {
  const { id } = use(params);
  return (
    <RequirePermission perm="membership:read">
      <Inner userId={Number(id)} />
    </RequirePermission>
  );
}

function Inner({ userId }: { userId: number }) {
  const { identity } = useIdentity();
  const tid = identity?.active_tenant_id ?? undefined;
  const { data, isLoading, isError } = useUser(tid, userId);
  if (isLoading)
    return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (isError || !data)
    return <p className="p-6 text-destructive">User not found.</p>;
  return (
    <section className="p-6">
      <Link
        href="/admin/users"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Users
      </Link>
      <h1 className="mt-1 text-xl font-semibold">
        {data.display_name ?? data.email}
      </h1>
      <p className="text-sm text-muted-foreground">{data.email}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Roles</dt>
          <dd className="flex flex-wrap gap-1">
            {data.roles.map((r) => (
              <PermBadge key={r} perm={r} />
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{data.status === 1 ? "active" : "disabled"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last login</dt>
          <dd>{data.last_login_at?.slice(0, 10) ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
