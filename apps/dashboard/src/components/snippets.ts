/** Integration snippets shown on the landing page and in the dashboard. Kept in sync with @whitechain-commerce/react. */
export function clientSnippet(apiBase = "https://commerce.example.com") {
  return `"use client";
import { WhitechainCheckout } from "@whitechain-commerce/react";

export function Checkout({ sessionId }: { sessionId: string }) {
  return (
    <WhitechainCheckout
      sessionId={sessionId}
      apiBase="${apiBase}"
      onSuccess={(p) => {
        // UI only. Fulfil the order from the webhook.
        window.location.href = \`/orders/\${p.orderId}\`;
      }}
    />
  );
}`;
}

export function serverSnippet(apiBase = "https://commerce.example.com") {
  return `import { createCheckoutSession } from "@whitechain-commerce/react/server";

export async function POST() {
  const session = await createCheckoutSession({
    apiBase: "${apiBase}",
    secretKey: process.env.WC_SECRET_KEY!, // sk_test_...
    orderId: "order_456",
    amount: "49.99", // USDT, priced on your server
  });
  return Response.json({ sessionId: session.id });
}`;
}

export function webhookSnippet() {
  return `import { verifyWebhook } from "@whitechain-commerce/react/server";

export async function POST(req: Request) {
  const body = await req.text(); // the raw body: the signature covers these exact bytes
  let event;
  try {
    event = verifyWebhook(body, req.headers.get("wc-signature"), process.env.WC_WEBHOOK_SECRET!);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }
  if (event.type === "payment.succeeded") {
    // mark event.data.payment.orderId as paid (dedupe on event.id)
  }
  return new Response("ok");
}`;
}
