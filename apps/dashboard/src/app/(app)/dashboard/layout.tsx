import type { ReactNode } from "react";
import { requireMerchant } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { Wordmark } from "@/components/brand";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const m = await requireMerchant();
  const initials = m.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-5 md:flex">
        <div className="px-2 pb-6">
          <Wordmark href="/dashboard" />
        </div>
        <SidebarNav />
        <div className="mt-auto flex flex-col gap-2 rounded-xl border bg-card p-3">
          <p className="text-xs font-medium">Test mode</p>
          <p className="text-xs text-muted-foreground">Payments settle in testnet USDT on Whitechain Sepolia.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/85 px-4 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="md:hidden">
              <Wordmark href="/dashboard" className="[&>span]:hidden" />
            </span>
            <span aria-hidden className="hidden size-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white sm:grid">
              {initials || "M"}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{m.name}</span>
              <span className="truncate text-xs text-muted-foreground">{m.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="info" dot className="hidden sm:inline-flex">
              Whitechain Sepolia
            </Badge>
            {m.status !== "active" && <Badge tone="warning">Pending verification</Badge>}
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon name="logout" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </form>
          </div>
        </header>
        <div className="border-b px-2 py-2 md:hidden">
          <SidebarNav orientation="horizontal" />
        </div>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
