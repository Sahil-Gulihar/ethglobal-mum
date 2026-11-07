"use client";

import { useState } from "react";
import { IDKitRequestWidget, proofOfHuman, type IDKitResult } from "@worldcoin/idkit";
import { completeBuyerWorldId, startBuyerWorldId } from "@/lib/actions/buyer-world-id";
import type { WorldIdRequest } from "@/lib/world-id";

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** Shown in the card once the buyer is verified. */
export function WorldIdVerifiedRow() {
  return (
    <div className="wcc-gate">
      <span className="wcc-verified">
        <ShieldIcon /> Verified buyer
      </span>
      <span className="wcc-text">Verified with World ID</span>
    </div>
  );
}

/** Verified buyers with World ID: one compact row inside the checkout card with a small "Verify with World ID" button. */
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

  // Rendered inside the WhitechainCheckout card, so it uses the widget's own classes and theme.
  return (
    <div>
      <div className="wcc-gate">
        <div>
          <p className="wcc-title">{required ? "Verify you're human to pay" : "Get the Verified buyer badge"}</p>
          <p className="wcc-text">{required ? "This store only takes payments from real people." : "Optional. The store sees it on your order."}</p>
        </div>
        <button type="button" className="wcc-btn wcc-btn-sm" onClick={start} disabled={busy || open} data-busy={busy}>
          <ShieldIcon /> {busy ? "Opening…" : "Verify with World ID"}
        </button>
      </div>
      {request?.environment === "staging" && (
        <p className="wcc-note">
          Testing?{" "}
          <a href="https://simulator.worldcoin.org" target="_blank" rel="noreferrer">
            Open the World ID simulator
          </a>
        </p>
      )}
      {error && (
        <p className="wcc-note" data-kind="error" role="alert">
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
