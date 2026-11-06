"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";

const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/dashboard/payments", label: "Payments", icon: "card" },
  { href: "/dashboard/developers", label: "Developers", icon: "code" },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: "webhook" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export function SidebarNav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "overflow-x-auto")}>
      {items.map((it) => {
        const active = it.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon name={it.icon} className={cn("size-4", active ? "text-primary" : "")} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
