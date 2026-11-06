"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";

export const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/dashboard/payments", label: "Payments", icon: "card" },
  { href: "/dashboard/developers", label: "Developers", icon: "code" },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: "webhook" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
}

/* docs/DESIGN.md, Sidebar: 14px/500 secondary text; active item primary text on gray-alpha-100, radius 6. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void; orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard">
      <ul className="flex flex-col gap-0.5">
        {navItems.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors duration-150 max-md:h-10",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon name={it.icon} className={cn("size-4", active ? "text-foreground" : "text-faint")} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Top bar breadcrumb: business / section (/ detail). The page body still owns the h1. */
export function TopbarTitle({ business }: { business: string }) {
  const pathname = usePathname();
  const section = [...navItems].reverse().find((it) => isActive(pathname, it.href));
  const detail = section && section.href !== "/dashboard" && pathname !== section.href;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="hidden min-w-0 truncate text-muted-foreground lg:block">{business}</li>
        <li aria-hidden className="hidden text-gray-500 lg:block">
          /
        </li>
        <li className="min-w-0 truncate">
          {detail ? (
            <Link href={section.href} className="font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground">
              {section.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground" aria-current="page">
              {section?.label ?? "Dashboard"}
            </span>
          )}
        </li>
        {detail && (
          <>
            <li aria-hidden className="text-gray-500">
              /
            </li>
            <li className="truncate font-medium text-foreground" aria-current="page">
              {section.href === "/dashboard/payments" ? "Payment" : "Detail"}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
