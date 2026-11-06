"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";

export const dashboardLinks: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/dashboard/payments", label: "Payments", icon: "card" },
  { href: "/dashboard/developers", label: "Developers", icon: "code" },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: "webhook" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "analytics" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export function SidebarNav({ group = "all", onNavigate }: { group?: "all" | "main" | "settings"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const links = group === "all" ? dashboardLinks : group === "settings" ? dashboardLinks.slice(-1) : dashboardLinks.slice(0, -1);

  return (
    <nav aria-label={group === "settings" ? "Settings" : "Primary"} className="flex flex-col gap-0.5">
      {links.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            title={item.label}
            onNavigate={onNavigate}
            className={cn(
              "shell-nav-link flex h-8 items-center gap-2 rounded-md px-2.5 text-sm leading-[1.4] tracking-[0.14px] transition-colors focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring",
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            <Icon name={item.icon} className="size-4" />
            <span className="shell-label truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
