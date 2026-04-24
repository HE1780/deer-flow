// frontend/src/app/(admin)/admin/workspaces/[id]/members/page.tsx
"use client";

import Link from "next/link";
import { use, useState } from "react";

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
import { useIdentity, useWorkspaceMembers } from "@/core/identity/hooks";

const PAGE_SIZE = 50;

interface Props {
  params: Promise<{ id: string }>;
}

export default function WorkspaceMembersPage({ params }: Props) {
  const { id } = use(params);
  return (
    <RequirePermission perm="membership:read">
      <Inner wsId={Number(id)} />
    </RequirePermission>
  );
}

function Inner({ wsId }: { wsId: number }) {
  const { identity } = useIdentity();
  const tid = identity?.active_tenant_id ?? undefined;
  const [offset, setOffset] = useState(0);
  const { data, isLoading } = useWorkspaceMembers(tid, wsId, {
    offset,
    limit: PAGE_SIZE,
  });

  return (
    <section className="p-6">
      <Link
        href="/admin/workspaces"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Workspaces
      </Link>
      <h1 className="mt-1 text-xl font-semibold">Members</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {data?.items.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{m.email}</TableCell>
              <TableCell>{m.display_name ?? "—"}</TableCell>
              <TableCell>
                <PermBadge perm={m.role} />
              </TableCell>
              <TableCell>{m.joined_at?.slice(0, 10) ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <footer className="mt-4 flex gap-2 text-sm">
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
      </footer>
    </section>
  );
}
