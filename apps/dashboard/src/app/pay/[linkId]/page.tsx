import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { openPaymentLink } from "@/lib/payment-links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay", robots: { index: false } };

/** Public payment link: opens a fresh hosted checkout for the link's fixed amount. */
export default async function PayLinkPage({ params }: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await params;
  const r = /^pl_[0-9A-Za-z]{20}$/.test(linkId)
    ? await openPaymentLink(linkId)
    : ({ ok: false, message: "This payment link doesn't exist." } as const);
  if (r.ok) redirect(`/checkout/${r.value.sessionId}`);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted p-6">
      <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Payment link unavailable</h1>
        <p className="text-sm text-muted-foreground">{r.message}</p>
        <Link href="/" className="text-sm font-medium text-primary underline underline-offset-4 hover:text-foreground">
          Whitechain Commerce
        </Link>
      </div>
    </main>
  );
}
