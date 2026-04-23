// frontend/src/core/identity/fetcher.ts
import { type IdentityError } from "./types";

type Listener = () => void;
const listeners = new Set<Listener>();

export function onSessionExpired(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetSessionExpiredListeners(): void {
  listeners.clear();
}

function emitSessionExpired(): void {
  for (const fn of listeners) fn();
}

export async function identityFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const resp = await fetch(input, {
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    ...init,
  });

  if (resp.status === 401) {
    emitSessionExpired();
    const err: IdentityError = { kind: "unauthenticated" };
    throw err;
  }
  if (resp.status === 403) {
    let missing: string | undefined;
    try {
      const body = (await resp.json()) as { detail?: { missing?: string } };
      missing = body?.detail?.missing;
    } catch {
      // 403 without JSON body is valid; missing stays undefined.
    }
    const err: IdentityError = { kind: "forbidden", missing };
    throw err;
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err: IdentityError = {
      kind: "network",
      status: resp.status,
      message: text,
    };
    throw err;
  }

  return (await resp.json()) as T;
}
