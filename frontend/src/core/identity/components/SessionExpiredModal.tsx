// frontend/src/core/identity/components/SessionExpiredModal.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { onSessionExpired } from "@/core/identity/fetcher";

export function SessionExpiredModal() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    return onSessionExpired(() => setOpen(true));
  }, []);

  const nextParam =
    pathname && pathname !== "/login"
      ? `?next=${encodeURIComponent(pathname)}`
      : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription>
            Your session is no longer valid. Please sign in again to continue.
          </DialogDescription>
        </DialogHeader>
        <Link
          href={`/login${nextParam}`}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to sign-in
        </Link>
      </DialogContent>
    </Dialog>
  );
}
