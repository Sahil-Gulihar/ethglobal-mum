import type { ReactNode } from "react";
import { requireMerchant } from "@/lib/auth";
import { Wordmark } from "@/components/brand";
import { SidebarNav, TopbarTitle } from "@/components/dashboard/sidebar-nav";
import { MobileNav, NetworkLabel, TestModeNote, UserMenu } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";

/* docs/DESIGN.md, Sidebar (app shell): full-height sticky sidebar on background-200, compact top bar, user menu. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const m = await requireMerchant();

  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <a
        href="#main"
        className="fixed top-2 left-2 z-50 -translate-y-16 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform duration-150 focus:translate-y-0"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col self-start border-r border-border bg-sidebar md:flex">
        <div className="flex h-14 shrink-0 items-center px-4">
          <Wordmark href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <SidebarNav />
        </div>
        <div className="shrink-0 px-2 pt-4 pb-5">
          <TestModeNote />
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav />
            <TopbarTitle business={m.name} />
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {m.status !== "active" && (
              <Badge tone="warning" className="max-sm:hidden">
                Pending verification
              </Badge>
            )}
            <NetworkLabel className="max-sm:hidden" />
            <UserMenu name={m.name} email={m.email} />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-10 px-4 pt-8 pb-16 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
