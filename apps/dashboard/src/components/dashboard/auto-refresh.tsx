"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetches the server component tree on an interval while `active` (e.g. until the indexer marks a refund).
 * Pauses while a modal <dialog> is open: a refresh can re-render the parent without the dialog's trigger
 * (e.g. the onboarding checklist moving past "Create an API key"), which would unmount the dialog and
 * lose state such as the one-time secret key.
 */
export function AutoRefresh({ active, intervalMs = 5000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && !document.querySelector("dialog[open]")) router.refresh();
    }, intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, router]);
  return null;
}
