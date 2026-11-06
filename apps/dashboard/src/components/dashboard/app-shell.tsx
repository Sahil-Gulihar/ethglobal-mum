"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { logoutAction } from "@/lib/actions/auth";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Quiet footer note for the sidebar: we only run on testnet. */
export function TestModeNote() {
  return (
    <div className="flex flex-col gap-1 px-2 text-[13px] leading-[18px]">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <span aria-hidden className="status-dot text-warning" />
        Test mode
      </p>
      <p className="text-muted-foreground">Payments settle in testnet USDT on Whitechain Sepolia.</p>
    </div>
  );
}

/** Network label for the top bar: plain metadata with a green dot. */
export function NetworkLabel({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[13px] font-medium whitespace-nowrap text-muted-foreground", className)}>
      <span aria-hidden className="status-dot text-success" />
      Whitechain Sepolia
    </span>
  );
}

const itemClass =
  "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-foreground transition-colors duration-150 hover:bg-muted [&_svg]:text-muted-foreground";

/** Business name trigger; the panel holds the email, theme control, settings and log out. */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 max-w-56 items-center gap-1.5 rounded-md border border-border-default px-2.5 text-sm font-medium transition-colors duration-150 hover:bg-muted max-md:h-10",
          open && "bg-muted",
        )}
      >
        <span className="truncate">{name}</span>
        <Icon name="chevronsUpDown" className="size-3.5 text-muted-foreground" />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute top-[calc(100%+6px)] right-0 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-elevation"
        >
          <div className="flex flex-col px-2.5 pt-2 pb-2.5">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-[13px] text-muted-foreground">{email}</span>
          </div>
          <div className="-mx-1 border-t border-border" />
          <div className="flex h-11 items-center justify-between gap-3 px-2.5">
            <span className="text-sm text-foreground">Theme</span>
            <ThemeToggle />
          </div>
          <div className="-mx-1 border-t border-border" />
          <div className="flex flex-col pt-1">
            <Link href="/dashboard/settings" className={itemClass}>
              <Icon name="settings" /> Settings
            </Link>
            <form action={logoutAction}>
              <button type="submit" className={itemClass}>
                <Icon name="logout" /> Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** Below md the sidebar becomes a sheet opened from the top bar. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="-ml-1.5 grid size-10 shrink-0 place-items-center rounded-md text-foreground transition-colors duration-150 hover:bg-muted md:hidden"
      >
        <Icon name="menu" className="size-5" />
      </button>
      <dialog
        ref={ref}
        aria-label="Navigation"
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-0 border-r border-border bg-sidebar p-0 text-foreground md:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between pr-2 pl-4">
            <Wordmark href="/dashboard" />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="grid size-10 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              <Icon name="x" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
          <div className="flex flex-col gap-4 border-t border-border px-2 py-4">
            <NetworkLabel className="px-2" />
            <TestModeNote />
          </div>
        </div>
      </dialog>
    </>
  );
}
