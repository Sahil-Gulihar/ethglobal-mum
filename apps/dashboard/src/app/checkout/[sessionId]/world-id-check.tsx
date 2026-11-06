"use client";

import { useState } from "react";
import { IDKitRequestWidget, proofOfHuman, type IDKitResult } from "@worldcoin/idkit";
import { completeBuyerWorldId, startBuyerWorldId } from "@/lib/actions/buyer-world-id";
import type { WorldIdRequest } from "@/lib/world-id";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/icons";

/** Verified buyers with World ID: one compact row with the same button as merchant onboarding. */
export function WorldIdBuyerCheck({ sessionId, required, onVerified }: { sessionId: string; required: boolean; onVerified: () => void }) {
  const [request, setRequest] = useState<WorldIdRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await startBuyerWorldId(sessionId);
      if (!r.ok) return setError(r.error);
      if (r.value.verified) return onVerified();
      setRequest(r.value);
      setOpen(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(result: IDKitResult) {
    const r = await completeBuyerWorldId(sessionId, result);
    if (!r.ok) {
      setError(r.error);
      // Close the widget so the specific reason shows here instead of IDKit's generic "Verification declined".
      setOpen(false);
      setRequest(null);
      throw new Error(r.error);
    }
  }

  return (
    <div className="mb-3 rounded-lg border bg-card px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{required ? "Verify you're human to pay" : "Get the Verified buyer badge"}</div>
          <div className="text-xs text-muted-foreground">{required ? "This store only takes payments from real people." : "Optional. The store sees it on your order."}</div>
        </div>
        <Button size="sm" onClick={start} disabled={busy || open} className="shrink-0">
          {busy ? <Spinner /> : <Icon name="shield" />} Verify with World ID
        </Button>
      </div>
      {request?.environment === "staging" && (
        <a href="https://simulator.worldcoin.org" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-4">
          Testing? Open the World ID simulator
        </a>
      )}
      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {request && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={request.appId}
          action={request.action}
          rp_context={request.rpContext}
          allow_legacy_proofs={true}
          preset={proofOfHuman({ signal: request.signal })}
          environment={request.environment}
          handleVerify={verify}
          onSuccess={() => {
            setRequest(null);
            onVerified();
          }}
          onError={(code) => setError((e) => e ?? `World ID verification didn't finish (${code}).`)}
        />
      )}
    </div>
  );
}
