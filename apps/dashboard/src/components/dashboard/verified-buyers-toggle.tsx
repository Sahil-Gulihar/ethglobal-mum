"use client";

import { useState, useTransition } from "react";
import { setRequireVerifiedBuyers } from "@/lib/actions/merchant";

export function VerifiedBuyersToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">Verified buyers only</span>
          <span className="block text-xs text-muted-foreground">
            Buyers pass a 0G human check before the pay button appears. When this is off, the check is optional and buyers can still earn the badge.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const next = !on;
              setOn(next);
              setError(null);
              const r = await setRequireVerifiedBuyers(next);
              if (!r.ok) {
                setOn(!next);
                setError(r.error);
              }
            })
          }
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? "bg-success" : "bg-muted-foreground/30"}`}
        >
          <span className={`inline-block size-5 rounded-full bg-background shadow transition-transform ${on ? "translate-x-5.5" : "translate-x-0.5"}`} />
        </button>
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
