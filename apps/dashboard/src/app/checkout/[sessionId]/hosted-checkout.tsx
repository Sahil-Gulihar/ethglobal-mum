"use client";

import { useEffect, useState } from "react";
import { WhitechainCheckout, type CheckoutSuccess } from "@whitechain-commerce/react";
import styles from "./checkout.module.css";

const REDIRECT_MS = 2000;

export function HostedCheckout({ sessionId, theme }: { sessionId: string; theme: "light" | "dark" }) {
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    if (!redirectTo) return;
    const t = setTimeout(() => window.location.assign(redirectTo), REDIRECT_MS);
    return () => clearTimeout(t);
  }, [redirectTo]);

  return (
    <div className={styles.cardWrap}>
      <WhitechainCheckout
        sessionId={sessionId}
        apiBase=""
        theme={theme}
        onSuccess={(r: CheckoutSuccess) => {
          // Already paid before we loaded: show that state and let "Return to store" do the redirect.
          if (r.successUrl && !r.alreadyPaid) setRedirectTo(r.successUrl);
        }}
        onError={(e) => console.error("[whitechain-checkout]", e)}
      />
      <p className={styles.redirect} data-show={redirectTo ? "true" : "false"} aria-live="polite">
        {redirectTo ? "Payment confirmed. Taking you back to the store…" : " "}
      </p>
    </div>
  );
}
