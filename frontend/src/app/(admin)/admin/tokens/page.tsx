// frontend/src/app/(admin)/admin/tokens/page.tsx
"use client";

import { CopyIcon, KeyIcon, PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import { PermBadge } from "@/core/identity/components/PermBadge";
import { RequirePermission } from "@/core/identity/components/RequirePermission";
import {
  useCreateTenantToken,
  useHasPermission,
  useIdentity,
  useRevokeTenantToken,
  useTenantTokens,
} from "@/core/identity/hooks";
import { type CreateTokenResult } from "@/core/identity/types";

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

  const canCreate = useHasPermission("token:create");
  const canRevoke = useHasPermission("token:revoke");
  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreateTokenResult | null>(
    null,
  );

  return (
    <section className="p-6" data-testid="tokens-page">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">API tokens</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeRevoked}
              onChange={(e) => setIncludeRevoked(e.target.checked)}
            />
            Show revoked
          </label>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              data-testid="tokens-new-btn"
            >
              <PlusIcon className="size-4" /> New token
            </Button>
          )}
        </div>
      </header>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Scopes</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead>Status</TableHead>
            {canRevoke && <TableHead aria-label="actions" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {data?.items.map((t) => (
            <TableRow key={t.id} data-testid={`token-row-${t.id}`}>
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
              {canRevoke && (
                <TableCell>
                  {!t.revoked_at && tid && (
                    <RevokeButton tenantId={tid} tokenId={t.id} />
                  )}
                </TableCell>
              )}
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

      {createOpen && tid && identity && (
        <CreateTokenDialog
          tenantId={tid}
          callerUserId={identity.user_id}
          onClose={() => setCreateOpen(false)}
          onCreated={(t) => {
            setCreatedToken(t);
            setCreateOpen(false);
          }}
        />
      )}
      {createdToken && (
        <PlaintextDialog
          token={createdToken}
          onClose={() => setCreatedToken(null)}
        />
      )}
    </section>
  );
}

function CreateTokenDialog({
  tenantId,
  callerUserId,
  onClose,
  onCreated,
}: {
  tenantId: number;
  callerUserId: number;
  onClose: () => void;
  onCreated: (t: CreateTokenResult) => void;
}) {
  const [name, setName] = useState("");
  const [scopesText, setScopesText] = useState("skill:invoke");
  const create = useCreateTenantToken(tenantId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="token-create-dialog">
        <DialogHeader>
          <DialogTitle>Create API token</DialogTitle>
          <DialogDescription>
            The plaintext is shown once. Copy it now — we never store it in
            recoverable form.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            create.mutate(
              {
                name: name.trim(),
                scopes: scopesText
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                user_id: callerUserId,
              },
              { onSuccess: onCreated },
            );
          }}
        >
          <label className="grid gap-1 text-sm">
            <span>Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ci-bot, ingest-job, …"
              required
              data-testid="token-name-input"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Scopes (comma-separated)</span>
            <Input
              value={scopesText}
              onChange={(e) => setScopesText(e.target.value)}
              placeholder="skill:invoke, thread:read"
              data-testid="token-scopes-input"
            />
          </label>
          {create.isError && (
            <p className="text-sm text-red-600" role="alert">
              Failed to create token. Check your permissions and try again.
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
              disabled={create.isPending || !name.trim()}
              data-testid="token-submit-btn"
            >
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlaintextDialog({
  token,
  onClose,
}: {
  token: CreateTokenResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the value so it's selectable on open. Browsers' clipboard API
  // sometimes needs a user gesture, so we keep the explicit Copy button too.
  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const onCopy = async () => {
    await navigator.clipboard.writeText(token.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="token-plaintext-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyIcon className="size-5" /> Token created
          </DialogTitle>
          <DialogDescription>
            Copy this value now — once you close this dialog, only the prefix
            <span className="font-mono"> {token.prefix} </span> remains.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            readOnly
            value={token.plaintext}
            className="font-mono"
            data-testid="token-plaintext-value"
          />
          <Button
            type="button"
            size="sm"
            onClick={onCopy}
            data-testid="token-copy-btn"
          >
            <CopyIcon className="size-4" /> {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" data-testid="token-plaintext-close-btn">
              Done
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeButton({ tenantId, tokenId }: { tenantId: number; tokenId: number }) {
  const revoke = useRevokeTenantToken(tenantId);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setConfirming(true)}
        data-testid={`token-revoke-${tokenId}`}
      >
        Revoke
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <Button
        size="sm"
        variant="destructive"
        onClick={() => revoke.mutate(tokenId)}
        disabled={revoke.isPending}
        data-testid={`token-revoke-confirm-${tokenId}`}
      >
        Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}
