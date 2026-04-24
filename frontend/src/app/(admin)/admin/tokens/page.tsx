// frontend/src/app/(admin)/admin/tokens/page.tsx
"use client";

import { useState } from "react";

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
import { useIdentity, useTenantTokens } from "@/core/identity/hooks";

const PAGE_SIZE = 50;

export default function TokensPage() {
  return (
    <RequirePermission perm="token:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const { identity } = useIdentity();
  const tid = identity?.active_tenant_id ?? undefined;
  const [offset, setOffset] = useState(0);
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const { data, isLoading } = useTenantTokens(tid, {
    include_revoked: includeRevoked,
    offset,
    limit: PAGE_SIZE,
  });

  return (
    <section className="p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">API tokens</h1>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeRevoked}
            onChange={(e) => setIncludeRevoked(e.target.checked)}
          />
          Show revoked
        </label>
      </header>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Scopes</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead>Status</TableHead>
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
          {data?.items.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.name}</TableCell>
              <TableCell className="font-mono text-xs">{t.prefix}</TableCell>
              <TableCell className="flex flex-wrap gap-1">
                {t.scopes.map((s) => (
                  <PermBadge key={s} perm={s} />
                ))}
              </TableCell>
              <TableCell>{t.last_used_at?.slice(0, 10) ?? "—"}</TableCell>
              <TableCell>
                {t.revoked_at
                  ? `revoked ${t.revoked_at.slice(0, 10)}`
                  : t.expires_at
                    ? `expires ${t.expires_at.slice(0, 10)}`
                    : "active"}
              </TableCell>
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
