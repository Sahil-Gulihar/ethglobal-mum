"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoMark, Wordmark } from "@/components/brand";
import { dashboardLinks, SidebarNav } from "./sidebar-nav";
import { Icon } from "@/components/icons";

const panelButton = "grid size-8 shrink-0 place-items-center rounded-[5px] text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

export function DashboardShell({ account, network, children }: { account: ReactNode; network: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const section = dashboardLinks.find(({ href }) => href === pathname || (href !== "/dashboard" && pathname.startsWith(`${href}/`)));
  const isSetup = pathname === "/dashboard/setup";
  const parent = isSetup ? dashboardLinks[0] : section && section.href !== pathname ? section : null;
  const [compact, setCompact] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 721px)");
    const closeOnDesktop = () => {
      if (desktop.matches) drawer.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="dark dashboard-shell text-foreground" data-compact={compact}>
      <aside className="dashboard-rail min-h-0 flex-col">
        <div className="flex h-8 shrink-0 items-center gap-1">
          <Wordmark href="/dashboard" className="shell-label min-w-0 shrink [&>span]:text-xs" />
          <button
            type="button"
            className={`${panelButton} rail-toggle ml-auto`}
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!compact}
            onClick={() => setCompact(!compact)}
          >
            {compact ? <LogoMark className="size-6" /> : <Icon name="panel" />}
          </button>
          <Link href="/dashboard" aria-label="Dashboard" className={`${panelButton} rail-compact-home`}><LogoMark className="size-6" /></Link>
        </div>
        <div className="mt-8 flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
          <SidebarNav group="main" />
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-3">
          <div className="shell-label">{network}</div>
          <SidebarNav group="settings" />
          <div className="border-t border-border pt-2">{account}</div>
        </div>
      </aside>

      <header className="dashboard-mobile-header items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" aria-label="Open navigation" aria-haspopup="dialog" className={panelButton} onClick={() => drawer.current?.showModal()}>
            <Icon name="panel" />
          </button>
          <Wordmark href="/dashboard" className="[&>span]:text-xs" />
        </div>
        {network}
      </header>
      <dialog
        ref={drawer}
        aria-label="Navigation"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(320px,85vw)] max-w-none border-r border-border bg-[var(--dashboard-chrome)] p-5 text-foreground shadow-2xl"
        onClick={(event) => { if (event.target === event.currentTarget) drawer.current?.close(); }}
      >
        <div className="flex min-h-full flex-col gap-6">
          <div className="flex items-center justify-between gap-2">
            <Wordmark href="/dashboard" />
            <button type="button" aria-label="Close navigation" className={panelButton} onClick={() => drawer.current?.close()}><Icon name="close" /></button>
          </div>
          <SidebarNav onNavigate={() => drawer.current?.close()} />
          <div className="mt-auto border-t border-border pt-2">{account}</div>
        </div>
      </dialog>

      <div className="dashboard-inset flex min-w-0 flex-col rounded-md border-[0.5px] border-[var(--dashboard-frame)] bg-background">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b-[0.5px] border-white/10 px-4 text-sm min-[721px]:px-5">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
            {parent ? (
              <>
                <Link href={parent.href} className="text-muted-foreground hover:text-foreground">{parent.label}</Link>
                <span aria-hidden="true" className="text-muted-foreground">/</span>
                <span aria-current="page">{isSetup ? "Setup" : "Payment details"}</span>
              </>
            ) : <span aria-current="page">{section?.label ?? "Dashboard"}</span>}
          </nav>
        </header>
        <main key={pathname} className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-4 px-4 pt-4 pb-4 min-[721px]:px-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
