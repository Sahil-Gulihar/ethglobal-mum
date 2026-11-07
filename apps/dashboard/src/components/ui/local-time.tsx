"use client";

import { useSyncExternalStore } from "react";
import { formatDate, formatDateTime } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * Renders a timestamp in the viewer's own time zone.
 *
 * Server components run on Vercel in UTC, so formatting there pins every viewer
 * to UTC. This formats in the browser instead. The server pass (and hydration)
 * renders a UTC fallback, which is swapped for local time right after mount.
 * Components mounted later (client navigation) render local time immediately.
 */
export function LocalTime({
  value,
  mode = "datetime",
  className,
}: {
  value: Date | string | null | undefined;
  mode?: "datetime" | "date";
  className?: string;
}) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!value) return <>—</>;
  const d = typeof value === "string" ? new Date(value) : value;
  const fmt = mode === "date" ? formatDate : formatDateTime;
  const text = isClient ? fmt(d) : fmt(d, "UTC");
  return (
    <time dateTime={d.toISOString()} title={isClient ? d.toString() : undefined} className={className}>
      {text}
    </time>
  );
}
