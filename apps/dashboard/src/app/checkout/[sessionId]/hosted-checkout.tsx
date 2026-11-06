"use client";

import { useEffect, useState } from "react";
import { WhitechainCheckout, type CheckoutSuccess } from "@whitechain-commerce/react";
import styles from "./checkout.module.css";
import { HumanCheck } from "./human-check";
import { WorldIdBuyerCheck } from "./world-id-check";
import { VerifiedBuyerBadge } from "@/components/verified-buyer-badge";

const REDIRECT_MS = 2000;

export function HostedCheckout({
  sessionId,
  theme,
  buyerCheck,
}: {
  sessionId: string;
  theme: "light" | "dark";
  buyerCheck: { required: boolean; verified: boolean; method?: "world_id" | "zg" } | null;
}) {
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [verified, setVerified] = useState(!!buyerCheck?.verified);
  // Merchants who turn on "Verified buyers only" get the pay button only after the buyer check (World ID or 0G) passes.
  const worldId = (buyerCheck?.method ?? "world_id") === "world_id";
  const gated = !!buyerCheck?.required && !verified;

  useEffect(() => {
    if (!redirectTo) return;
    const t = setTimeout(() => window.location.assign(redirectTo), REDIRECT_MS);
    return () => clearTimeout(t);
  }, [redirectTo]);

  return (
    <div className={styles.cardWrap}>
      {buyerCheck &&
        !verified &&
        (worldId ? (
          <WorldIdBuyerCheck sessionId={sessionId} required={buyerCheck.required} onVerified={() => setVerified(true)} />
        ) : (
          <HumanCheck sessionId={sessionId} required={buyerCheck.required} onVerified={() => setVerified(true)} />
        ))}
      {buyerCheck && verified && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
          <VerifiedBuyerBadge />
          <span className="text-xs text-muted-foreground">{worldId ? "Verified with World ID" : "Checked on 0G Private Computer"}</span>
        </div>
      )}
      {!gated && <WhitechainCheckout
        sessionId={sessionId}
        apiBase=""
        theme={theme}
        onSuccess={(r: CheckoutSuccess) => {
          // Already paid before we loaded: show that state and let "Return to store" do the redirect.
          if (r.successUrl && !r.alreadyPaid) setRedirectTo(r.successUrl);
        }}
        onError={(e) => console.error("[whitechain-checkout]", e)}
      />}
      <p className={styles.redirect} data-show={redirectTo ? "true" : "false"} aria-live="polite">
        {redirectTo ? "Payment confirmed. Taking you back to the store…" : " "}
      </p>
    </div>
  );
}
