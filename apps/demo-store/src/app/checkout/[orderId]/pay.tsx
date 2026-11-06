"use client";

import { useRouter } from "next/navigation";
import { WhitechainCheckout } from "@whitechain-commerce/react";

// The entire integration on the client: one component.
export function Pay({ orderId, sessionId }: { orderId: string; sessionId: string }) {
  const router = useRouter();

  return (
    <WhitechainCheckout
      sessionId={sessionId}
      theme="dark"
      apiBase={process.env.NEXT_PUBLIC_WC_API_BASE ?? "http://localhost:3000"}
      // UX only: send the shopper to their order page. Fulfilment happens
      // server-side when the signed payment.succeeded webhook arrives.
      onSuccess={() => router.push(`/orders/${orderId}?paid=1`)}
      onError={(e) => console.error("Checkout error", e)}
    />
  );
}
