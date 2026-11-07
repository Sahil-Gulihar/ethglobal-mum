import { useState } from "react";
import { IDKitRequestWidget, proofOfHuman, type IDKitResult } from "@worldcoin/idkit";
import { startWorldId, verifyWorldId, type WorldIdStart } from "./api.ts";

type Request = Extract<WorldIdStart, { verified: false }>;

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** Verified buyers: a small "Verify with World ID" row inside the checkout card. Works on any origin (CORS API). */
export function WorldIdGate({ apiBase, sessionId, onVerified }: { apiBase: string; sessionId: string; onVerified: () => void }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await startWorldId(apiBase, sessionId);
      if (r.verified) return onVerified();
      setRequest(r);
      setOpen(true);
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(result: IDKitResult) {
    try {
      await verifyWorldId(apiBase, sessionId, result);
    } catch (e) {
      const msg = (e as Error).message || "World ID couldn't verify you. Try again.";
      setError(msg);
      // Close the widget so the specific reason shows here instead of IDKit's generic "Verification declined".
      setOpen(false);
      setRequest(null);
      throw e;
    }
  }

  return (
    <div>
      <div className="wcc-gate">
        <div>
          <p className="wcc-title">Verify you're human to pay</p>
          <p className="wcc-text">This store only takes payments from real people.</p>
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

/** Shown in the card once the buyer is verified. */
export function VerifiedRow() {
  return (
    <div className="wcc-gate">
      <span className="wcc-verified">
        <ShieldIcon /> Verified buyer
      </span>
      <span className="wcc-text">Verified with World ID</span>
    </div>
  );
}
