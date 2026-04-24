// frontend/src/app/(admin)/admin/profile/page.tsx
"use client";

import { CopyIcon, KeyIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateMyToken,
  useIdentity,
  useMySessions,
  useMyTokens,
  useRevokeMySession,
  useRevokeMyToken,
} from "@/core/identity/hooks";
import { type CreateTokenResult } from "@/core/identity/types";

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
    <main className="mx-auto max-w-3xl p-8" data-testid="profile-page">
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

      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic" data-testid="profile-tab-basic">
            Basic
          </TabsTrigger>
          <TabsTrigger value="tokens" data-testid="profile-tab-tokens">
            My tokens
          </TabsTrigger>
          <TabsTrigger value="sessions" data-testid="profile-tab-sessions">
            My sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4 space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Active tenant
            </h2>
            <p className="text-sm">
              {identity.active_tenant_id != null
                ? (identity.tenants.find(
                    (t) => t.id === identity.active_tenant_id,
                  )?.name ?? `#${identity.active_tenant_id}`)
                : "(none)"}
            </p>
          </section>
          <section>
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
        </TabsContent>

        <TabsContent value="tokens" className="mt-4">
          <MyTokensTab />
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <MySessionsTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function MyTokensTab() {
  const { data, isLoading } = useMyTokens();
  const revoke = useRevokeMyToken();
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<CreateTokenResult | null>(null);

  return (
    <div className="space-y-3" data-testid="my-tokens-tab">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          data-testid="my-token-new-btn"
        >
          <PlusIcon className="size-4" /> New token
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Scopes</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead aria-label="actions" />
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
          {data?.length === 0 && !isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No personal tokens yet.
              </TableCell>
            </TableRow>
          )}
          {data?.map((t) => (
            <TableRow key={t.id} data-testid={`my-token-row-${t.id}`}>
              <TableCell>{t.name}</TableCell>
              <TableCell className="font-mono text-xs">{t.prefix}</TableCell>
              <TableCell className="font-mono text-xs">
                {t.scopes.join(", ")}
              </TableCell>
              <TableCell>{t.last_used_at?.slice(0, 10) ?? "—"}</TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => revoke.mutate(t.id)}
                  disabled={revoke.isPending}
                  data-testid={`my-token-revoke-${t.id}`}
                >
                  Revoke
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {createOpen && (
        <CreateMyTokenDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(t) => {
            setCreated(t);
            setCreateOpen(false);
          }}
        />
      )}
      {created && (
        <PlaintextDialog token={created} onClose={() => setCreated(null)} />
      )}
    </div>
  );
}

function CreateMyTokenDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (t: CreateTokenResult) => void;
}) {
  const [name, setName] = useState("");
  const [scopesText, setScopesText] = useState("skill:invoke");
  const create = useCreateMyToken();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="my-token-create-dialog">
        <DialogHeader>
          <DialogTitle>Create personal token</DialogTitle>
          <DialogDescription>
            Inherits your current tenant. The plaintext is shown once.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              {
                name: name.trim(),
                scopes: scopesText
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
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
              required
              data-testid="my-token-name-input"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Scopes (comma-separated)</span>
            <Input
              value={scopesText}
              onChange={(e) => setScopesText(e.target.value)}
              data-testid="my-token-scopes-input"
            />
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={create.isPending || !name.trim()}
              data-testid="my-token-submit-btn"
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
      <DialogContent data-testid="my-token-plaintext-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyIcon className="size-5" /> Token created
          </DialogTitle>
          <DialogDescription>
            Copy now — only the prefix
            <span className="font-mono"> {token.prefix} </span> remains after
            this dialog closes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            readOnly
            value={token.plaintext}
            className="font-mono"
            data-testid="my-token-plaintext-value"
          />
          <Button type="button" size="sm" onClick={onCopy}>
            <CopyIcon className="size-4" /> {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MySessionsTab() {
  const { data, isLoading } = useMySessions();
  const revoke = useRevokeMySession();
  return (
    <div className="space-y-3" data-testid="my-sessions-tab">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session id</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>User agent</TableHead>
            <TableHead aria-label="actions" />
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
          {data?.length === 0 && !isLoading && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No active sessions.
              </TableCell>
            </TableRow>
          )}
          {data?.map((s) => (
            <TableRow key={s.sid} data-testid={`my-session-row-${s.sid}`}>
              <TableCell className="font-mono text-xs">
                {s.sid.slice(0, 8)}…
              </TableCell>
              <TableCell>
                {s.created_at?.replace("T", " ").slice(0, 19) ?? "—"}
              </TableCell>
              <TableCell>{s.ip ?? "—"}</TableCell>
              <TableCell className="max-w-xs truncate" title={s.user_agent ?? ""}>
                {s.user_agent ?? "—"}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => revoke.mutate(s.sid)}
                  disabled={revoke.isPending}
                  data-testid={`my-session-revoke-${s.sid}`}
                >
                  Revoke
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
