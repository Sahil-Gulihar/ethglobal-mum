import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { apiKeys, db } from "@/lib/db";
import { getCurrentMerchant } from "@/lib/auth";
import { connectCode, parseConnectRequest } from "@/lib/agent/connect-code";
import { Wordmark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConnectForm } from "./connect-form";

export const metadata: Metadata = { title: "Connect an agent", robots: { index: false } };

type Params = { h?: string | string[]; p?: string | string[]; n?: string | string[] };

const CAN = [
  "See your account, sales, payments and refunds",
  "Create checkout sessions and payment links",
  "Turn payment links on or off",
  "Start refunds (they wait for you to sign them)",
];
const CANNOT = ["Change your payout wallet", "Sign refunds or move funds", "Create or revoke API keys", "Verify your identity"];

export default async function ConnectPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const raw = { h: one(sp.h), p: one(sp.p), n: one(sp.n) };

  const merchant = await getCurrentMerchant();
  if (!merchant) {
    const qs = new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"));
    redirect(`/login?next=${encodeURIComponent(`/connect?${qs}`)}`);
  }

  const req = parseConnectRequest(raw);
  const existing = req
    ? (await db.select({ merchantId: apiKeys.merchantId }).from(apiKeys).where(eq(apiKeys.keyHash, req.hash)).limit(1))[0]
    : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-muted px-6 py-7 sm:px-10">
      <Wordmark />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        {!req ? (
          <Card className="p-6 animate-fade-up">
            <h1 className="text-xl font-semibold tracking-tight">This link doesn&apos;t work</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The connect link is incomplete or was changed. Ask your agent to start again, for example with{" "}
              <code className="font-mono text-foreground">npx whitechain-mcp login</code>.
            </p>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline", className: "mt-6" })}>Go to dashboard</Link>
          </Card>
        ) : (
          <Card className="overflow-hidden animate-fade-up">
            <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center">
              <span className="grid size-12 place-items-center rounded-md border-[0.5px] bg-accent text-accent-foreground">
                <Icon name="agent" className="size-6" />
              </span>
              <h1 className="text-xl font-semibold tracking-tight">Connect an agent</h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground break-all">{req.name}</span> wants to use{" "}
                <span className="font-medium text-foreground">{merchant.name}</span>.
              </p>
            </div>

            <div className="mx-6 rounded-md border-[0.5px] bg-muted/60 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">Confirmation code</span>
                <span className="font-mono text-lg font-semibold tracking-[0.15em]">{connectCode(req.hash)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">Key</span>
                <span className="font-mono text-xs text-muted-foreground">{req.prefix}…</span>
              </div>
            </div>
            <p className="mx-6 mt-2 text-xs text-muted-foreground">
              Only approve if this code matches the one your agent shows you, and you started this yourself.
            </p>

            <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-foreground">It will be able to</p>
                <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  {CAN.map((t) => (
                    <li key={t} className="flex gap-2"><Icon name="check" className="mt-px size-3.5 shrink-0 text-success" />{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-foreground">It won&apos;t be able to</p>
                <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  {CANNOT.map((t) => (
                    <li key={t} className="flex gap-2"><Icon name="close" className="mt-px size-3.5 shrink-0" />{t}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t px-6 py-5">
              {existing ? (
                <Alert tone="success">
                  {existing.merchantId === merchant.id
                    ? "This agent is already connected. You can revoke it anytime in Developers."
                    : "This agent is already connected."}
                </Alert>
              ) : merchant.status !== "active" ? (
                <div className="flex flex-col gap-3">
                  <Alert tone="warning">Verify your account before connecting an agent. Agents can only use verified accounts.</Alert>
                  <Link href="/dashboard/setup" className={buttonVariants({ variant: "ink", size: "lg", className: "w-full" })}>
                    <Icon name="shield" /> Verify account
                  </Link>
                </div>
              ) : (
                <ConnectForm h={req.hash} p={req.prefix} n={req.name} />
              )}
            </div>
          </Card>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Signed in as {merchant.email}. The agent keeps its key on its own machine; we only store a fingerprint of it.
        </p>
      </main>
    </div>
  );
}
