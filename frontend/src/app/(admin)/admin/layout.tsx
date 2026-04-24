// frontend/src/app/(admin)/admin/layout.tsx
import Link from "next/link";
import { type ReactNode } from "react";

import { AdminSidebar } from "@/core/identity/components/AdminSidebar";
import { TenantSwitcher } from "@/core/identity/components/TenantSwitcher";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-56 border-r bg-muted/30">
        <Link
          href="/admin/profile"
          className="block border-b px-4 py-3 text-lg font-semibold tracking-tight"
        >
          DeerFlow Admin
        </Link>
        <AdminSidebar />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-4 border-b px-6">
          <TenantSwitcher />
          <Link
            href="/logout"
            className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-accent"
          >
            Sign out
          </Link>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
