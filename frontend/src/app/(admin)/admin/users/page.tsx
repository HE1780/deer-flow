// frontend/src/app/(admin)/admin/users/page.tsx
"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/core/i18n/hooks";
import { PermBadge } from "@/core/identity/components/PermBadge";
import { RequirePermission } from "@/core/identity/components/RequirePermission";
import {
  useCreateUser,
  useHasPermission,
  useIdentity,
  useUsers,
} from "@/core/identity/hooks";

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
  const { t } = useI18n();
  const tid = identity?.active_tenant_id ?? undefined;
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError } = useUsers(tid, {
    q,
    offset,
    limit: PAGE_SIZE,
  });
  const canInvite = useHasPermission("membership:invite");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <section className="p-6" data-testid="users-page">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.admin.pages.usersTitle}</h1>
        <div className="flex items-center gap-3">
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
          {canInvite && (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              data-testid="users-new-btn"
            >
              <PlusIcon className="size-4" /> {t.admin.actions.newUser}
            </Button>
          )}
        </div>
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

      {createOpen && tid && (
        <CreateUserDialog
          tenantId={tid}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </section>
  );
}

function CreateUserDialog({
  tenantId,
  onClose,
}: {
  tenantId: number;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const create = useCreateUser(tenantId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="users-create-dialog">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Adds the user to this tenant. They sign in via OIDC the first time
            and inherit the tenant&apos;s default workspace role.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              {
                email: email.trim(),
                display_name: displayName.trim() || undefined,
              },
              { onSuccess: onClose },
            );
          }}
        >
          <label className="grid gap-1 text-sm">
            <span>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="users-create-email"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Display name (optional)</span>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              data-testid="users-create-display-name"
            />
          </label>
          {create.isError && (
            <p className="text-sm text-red-600" role="alert">
              Could not create user. The email may already be a member of this
              tenant.
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={create.isPending || !email.trim()}
              data-testid="users-create-submit"
            >
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
