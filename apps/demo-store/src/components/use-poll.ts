"use client";

import { useEffect, useState } from "react";

/** Polls a JSON endpoint. `intervalFor` can slow down once nothing is expected to change. */
export function usePoll<T>(url: string, intervalFor: (data: T | null) => number = () => 2000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    fetch(url, { cache: "no-store", signal: ctrl.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled && e.name !== "AbortError") setError(e.message);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [url, tick]);

  useEffect(() => {
    const t = setTimeout(() => setTick((n) => n + 1), intervalFor(data));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, error, tick]);

  return { data, error };
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return new Date(iso).toLocaleString();
}

export function shortHash(h: string): string {
  return h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h;
}
