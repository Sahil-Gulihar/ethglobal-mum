"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { approveAgentConnect } from "@/lib/actions/agent-connect";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";

export function ConnectForm({ h, p, n }: { h: string; p: string; n: string }) {
  const [state, setState] = useState<"idle" | "done" | "cancelled">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (state === "done")
    return (
      <div className="flex flex-col gap-4" role="status">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success-soft text-success"><Icon name="check" /></span>
          <p className="text-sm">
            <span className="font-medium break-all">{n}</span> is connected. You can revoke it anytime in Developers.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">You can close this tab and go back to your agent.</p>
        <Link href="/dashboard/developers" className={buttonVariants({ variant: "outline", className: "w-full" })}>Open Developers</Link>
      </div>
    );

  if (state === "cancelled")
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Cancelled. Nothing was connected, and you can close this tab.</p>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", className: "w-full" })}>Go to dashboard</Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <Button
        variant="ink"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await approveAgentConnect({ h, p, n });
            if (r.ok) setState("done");
            else setError(r.error);
          })
        }
      >
        {pending ? <Spinner /> : <Icon name="plug" />} Approve and connect
      </Button>
      <Button variant="ghost" className="w-full" disabled={pending} onClick={() => setState("cancelled")}>
        Cancel
      </Button>
    </div>
  );
}
