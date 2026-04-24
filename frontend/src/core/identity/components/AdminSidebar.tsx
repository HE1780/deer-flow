// frontend/src/core/identity/components/AdminSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { useIdentity } from "../hooks";

interface Item {
  href: string;
  label: string;
  requires?: string; // permission tag
  platformOnly?: true;
}

const ITEMS: Item[] = [
  { href: "/admin/profile", label: "Profile" },
  { href: "/admin/tenants", label: "Tenants", platformOnly: true },
  { href: "/admin/users", label: "Users", requires: "membership:read" },
  { href: "/admin/roles", label: "Roles" }, // any authenticated user
  { href: "/admin/workspaces", label: "Workspaces", requires: "workspace:read" },
  { href: "/admin/tokens", label: "Tokens", requires: "token:read" },
  { href: "/admin/audit", label: "Audit", requires: "audit:read" },
];

export function AdminSidebar() {
  const { identity } = useIdentity();
  const pathname = usePathname();

  const platformRoles = identity?.roles?.platform ?? [];
  const visible = ITEMS.filter((i) => {
    if (i.platformOnly) return platformRoles.includes("platform_admin");
    if (i.requires)
      return !!identity?.permissions.includes(i.requires);
    return true;
  });

  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1 p-2">
      {visible.map((i) => {
        const active =
          pathname === i.href || pathname?.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm hover:bg-accent",
              active && "bg-accent font-medium",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
