// frontend/src/app/(admin)/admin/users/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermBadge } from "@/core/identity/components/PermBadge";
import { RequirePermission } from "@/core/identity/components/RequirePermission";
import { useIdentity, useUsers } from "@/core/identity/hooks";

const PAGE_SIZE = 20;

export default function UsersPage() {
  return (
    <RequirePermission perm="membership:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const { identity } = useIdentity();
  const tid = identity?.active_tenant_id ?? undefined;
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError } = useUsers(tid, {
    q,
    offset,
    limit: PAGE_SIZE,
  });

  return (
    <section className="p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <Input
          aria-label="Filter by email"
          placeholder="Filter by email…"
          className="w-64"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
      </header>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last login</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {isError && (
            <TableRow>
              <TableCell colSpan={5} className="text-destructive">
                Failed to load users.
              </TableCell>
            </TableRow>
          )}
          {data?.items.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <Link href={`/admin/users/${u.id}`} className="underline">
                  {u.email}
                </Link>
              </TableCell>
              <TableCell>{u.display_name ?? "—"}</TableCell>
              <TableCell className="flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <PermBadge key={r} perm={r} />
                ))}
              </TableCell>
              <TableCell>{u.status === 1 ? "active" : "disabled"}</TableCell>
              <TableCell>{u.last_login_at?.slice(0, 10) ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <footer className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} total</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-1 disabled:opacity-50"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-1 disabled:opacity-50"
            disabled={!data || offset + PAGE_SIZE >= data.total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      </footer>
    </section>
  );
}
