"use client";

import { useState, useTransition } from "react";
import { setRequireVerifiedBuyers, setVerifiedBuyerMethod } from "@/lib/actions/merchant";

type Method = "world_id" | "zg";

const METHODS: { value: Method; title: string; body: string }[] = [
  {
    value: "world_id",
    title: "World ID",
    body: "Buyers prove they're a unique human with World App. No personal data is shared with you.",
  },
  {
    value: "zg",
    title: "0G picture check",
    body: "Buyers name what's in a fresh picture drawn on 0G Private Computer. No app needed.",
  },
];

export function VerifiedBuyersToggle({ initial, initialMethod }: { initial: boolean; initialMethod: Method }) {
  const [on, setOn] = useState(initial);
  const [method, setMethod] = useState<Method>(initialMethod);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function chooseMethod(next: Method) {
    if (next === method) return;
    const prev = method;
    setMethod(next);
    setError(null);
    start(async () => {
      const r = await setVerifiedBuyerMethod(next);
      if (!r.ok) {
        setMethod(prev);
        setError(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">Verified buyers only</span>
          <span className="block text-xs text-muted-foreground">
            Buyers must prove they&apos;re human before the pay button appears. When this is off, the check is optional and buyers can still get the
            Verified buyer badge.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Verified buyers only"
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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">How buyers verify</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {METHODS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer gap-3 rounded-md border px-3.5 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                method === opt.value ? "border-foreground/40 bg-accent/60" : "hover:bg-accent/40"
              }`}
            >
              <input
                type="radio"
                name="verified-buyer-method"
                value={opt.value}
                checked={method === opt.value}
                onChange={() => chooseMethod(opt.value)}
                disabled={pending}
                className="mt-0.5 accent-current"
              />
              <span>
                <span className="block text-sm font-medium">
                  {opt.title}
                  {opt.value === "world_id" && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Recommended</span>}
                </span>
                <span className="block text-xs text-muted-foreground">{opt.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
