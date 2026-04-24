// frontend/src/app/(admin)/admin/audit/page.tsx
"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequirePermission } from "@/core/identity/components/RequirePermission";
import { useAudit, useIdentity } from "@/core/identity/hooks";
import type { AuditFilters } from "@/core/identity/types";

export default function AuditPage() {
  return (
    <RequirePermission perm="audit:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const { identity } = useIdentity();
  const tid = identity?.active_tenant_id ?? undefined;
  const [filters, setFilters] = useState<AuditFilters>({ limit: 50 });
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const currentCursor = cursorStack[cursorStack.length - 1];

  const { data, isLoading } = useAudit(tid, {
    ...filters,
    cursor: currentCursor,
  });

  return (
    <section className="p-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Audit log</h1>
        <Input
          aria-label="Filter action"
          placeholder="Action (e.g. user.login.success)"
          className="w-72"
          value={filters.action ?? ""}
          onChange={(e) => {
            setCursorStack([undefined]);
            setFilters({
              ...filters,
              action: e.target.value || undefined,
            });
          }}
        />
        <Select
          value={filters.result ?? "all"}
          onValueChange={(v) => {
            setCursorStack([undefined]);
            setFilters({
              ...filters,
              result:
                v === "all" ? undefined : (v as "success" | "failure"),
            });
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time (UTC)</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Resource</TableHead>
            <TableHead>Result</TableHead>
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
          {data?.items.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">
                {e.created_at?.replace("T", " ").slice(0, 19) ?? "—"}
              </TableCell>
              <TableCell>{e.user_id ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{e.action}</TableCell>
              <TableCell>
                {e.resource_type
                  ? `${e.resource_type}:${e.resource_id ?? ""}`
                  : "—"}
              </TableCell>
              <TableCell
                className={e.result === "failure" ? "text-destructive" : ""}
              >
                {e.result}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <footer className="mt-4 flex gap-2 text-sm">
        <button
          type="button"
          className="rounded-md border px-3 py-1 disabled:opacity-50"
          disabled={cursorStack.length <= 1}
          onClick={() => setCursorStack(cursorStack.slice(0, -1))}
        >
          Prev
        </button>
        <button
          type="button"
          className="rounded-md border px-3 py-1 disabled:opacity-50"
          disabled={!data?.next_cursor}
          onClick={() => {
            if (data?.next_cursor)
              setCursorStack([...cursorStack, data.next_cursor]);
          }}
        >
          Next
        </button>
      </footer>
    </section>
  );
}
