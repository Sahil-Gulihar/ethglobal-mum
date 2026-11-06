import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentMerchant } from "@/lib/auth";
import { Wordmark, LogoMark } from "@/components/brand";
import { CodeBlock } from "@/components/code-block";
import { clientSnippet, serverSnippet } from "@/components/snippets";
import { buttonVariants } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/icons";

const features: { icon: IconName; title: string; body: string }[] = [
  { icon: "shield", title: "Non-custodial by design", body: "USDT moves from your customer’s wallet to yours in a single transfer. Our router never holds a balance, so there’s nothing to freeze or withdraw." },
  { icon: "zap", title: "Instant settlement", body: "Funds land in your payout wallet in the same block the customer pays. No payout schedule, no T+2, no reserve." },
  { icon: "user", title: "Verified merchants", body: "Every merchant is registered onchain to a payout address. Proof of Human verification (one person, one store) is coming soon." },
  { icon: "undo", title: "Refunds linked onchain", body: "Full or partial refunds reference the original payment, so you, your customer and any auditor can trace every cent." },
];

const steps: { n: string; title: string; body: string }[] = [
  { n: "01", title: "Create an account", body: "Sign up, connect the wallet you want to be paid in and grab a secret key." },
  { n: "02", title: "Drop in the checkout", body: "Create a session on your server and render one React component. About 20 lines." },
  { n: "03", title: "Get paid in USDT", body: "Customers pay from any browser wallet. You receive a signed webhook the moment it settles." },
];

export default async function Landing() {
  const merchant = await getCurrentMerchant();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Hero */}
      <div className="relative isolate overflow-hidden bg-ink text-white">
        <div aria-hidden className="pointer-events-none absolute -top-48 left-1/2 -z-10 size-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(59_91_255/0.45),transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <Wordmark tone="light" />
          <nav aria-label="Main" className="hidden items-center gap-8 text-sm text-white/70 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#developers" className="hover:text-white">Developers</a>
          </nav>
          <div className="flex items-center gap-2">
            {merchant ? (
              <Link href="/dashboard" className={buttonVariants({ size: "sm", className: "rounded-full px-4" })}>
                Dashboard <Icon name="arrowRight" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden h-8 items-center rounded-full px-4 text-sm font-medium text-white/80 hover:text-white sm:inline-flex">
                  Log in
                </Link>
                <Link href="/signup" className={buttonVariants({ size: "sm", className: "rounded-full px-4" })}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pt-16 pb-24 lg:grid-cols-[1.1fr_1fr] lg:pt-24 lg:pb-32">
          <div className="flex flex-col gap-7 animate-fade-up">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
              <span aria-hidden className="size-1.5 rounded-full bg-[#5CF2B4]" /> Now live on Whitechain Sepolia
            </span>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
              Accept USDT payments on <span className="text-[#8EA2FF]">Whitechain</span>
            </h1>
            <p className="max-w-xl text-lg text-pretty text-white/70">
              A checkout your customers already know how to use, with settlement straight to your own wallet. No custody, no payout delays, refunds in two clicks.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={merchant ? "/dashboard" : "/signup"} className={buttonVariants({ size: "lg" })}>
                Start accepting payments <Icon name="arrowRight" />
              </Link>
              <a href="#developers" className={buttonVariants({ size: "lg", variant: "ghost", className: "text-white hover:bg-white/10" })}>
                <Icon name="code" /> View the integration
              </a>
            </div>
            <dl className="mt-4 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-6">
              <Stat k="~2s" v="to settle" />
              <Stat k="0%" v="custody" />
              <Stat k="20" v="lines to integrate" />
            </dl>
          </div>
          <CheckoutMock />
        </section>
      </div>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-8 px-6 py-24">
        <SectionHead eyebrow="Why Whitechain Commerce" title="Crypto payments without the custody risk" body="Everything a merchant needs to take stablecoin payments, built on a router contract that can only move funds the way you expect." />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col gap-4 rounded-2xl border bg-card p-6 transition-shadow hover:shadow-[0_8px_30px_rgb(11_11_18/0.06)]">
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-primary">
                <Icon name={f.icon} className="size-5" />
              </span>
              <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-8 border-y bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <SectionHead eyebrow="How it works" title="Live in an afternoon" />
          <ol className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="flex flex-col gap-3 border-t-2 border-primary pt-6">
                <span className="font-mono text-sm text-primary">{s.n}</span>
                <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Developers */}
      <section id="developers" className="mx-auto grid w-full max-w-6xl scroll-mt-8 items-start gap-12 px-6 py-24 lg:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-6 lg:sticky lg:top-12">
          <SectionHead align="left" eyebrow="For developers" title="One component. One webhook." body="Price the order on your server, render the checkout, and fulfil from a signed webhook verified against the onchain settlement event." />
          <ul className="flex flex-col gap-3 text-sm">
            {["Typed React SDK and server helpers", "HMAC-signed webhooks with automatic retries", "Every payment verified against PaymentSettled", "Idempotent, one payment per order, enforced onchain"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-5 place-items-center rounded-full bg-success-soft text-success">
                  <Icon name="check" className="size-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <Link href="/signup" className={buttonVariants({ variant: "ink", className: "w-fit" })}>
            Get your API keys <Icon name="arrowRight" />
          </Link>
        </div>
        <div className="flex flex-col gap-4">
          <CodeBlock filename="app/api/checkout/route.ts" code={serverSnippet()} />
          <CodeBlock filename="Checkout.tsx" code={clientSnippet()} />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="relative isolate overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center text-white sm:px-16">
          <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 size-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(59_91_255/0.5),transparent)]" />
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Start taking USDT today. Keep every cent in your own wallet.</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">Free on testnet. Set up takes a few minutes.</p>
          <Link href={merchant ? "/dashboard" : "/signup"} className={buttonVariants({ size: "lg", className: "mt-8" })}>
            Start accepting payments <Icon name="arrowRight" />
          </Link>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="size-6" />
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()} Whitechain Commerce. Testnet preview.</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#developers" className="hover:text-foreground">Developers</a>
            <a href="https://explorer.testnet.whitechain.io" target="_blank" rel="noreferrer" className="hover:text-foreground">Explorer</a>
            <Link href="/login" className="hover:text-foreground">Log in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="sr-only">{v}</dt>
      <dd className="text-2xl font-semibold tracking-tight tabular">{k}</dd>
      <dd className="text-xs text-white/60">{v}</dd>
    </div>
  );
}

function SectionHead({ eyebrow, title, body, align = "center" }: { eyebrow: string; title: string; body?: ReactNode; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto flex max-w-2xl flex-col items-center gap-4 text-center" : "flex flex-col gap-4"}>
      <span className="text-sm font-semibold text-primary">{eyebrow}</span>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {body && <p className="text-pretty text-muted-foreground">{body}</p>}
    </div>
  );
}

/** Static illustration of the hosted checkout (not interactive). */
function CheckoutMock() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-sm lg:ml-auto">
      <div className="absolute -inset-4 rounded-[2rem] bg-white/5 blur-2xl" />
      <div className="relative rounded-3xl border border-white/10 bg-white p-6 text-ink shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-[#F4EBDD] text-sm font-bold text-[#8a5a2b]">C</span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Chai &amp; Co.</span>
              <span className="text-xs text-[#5b5f72]">Order #4821</span>
            </div>
          </div>
          <span className="rounded-full bg-[#eef1ff] px-2 py-0.5 text-[11px] font-medium text-[#2a44d6]">Whitechain Sepolia</span>
        </div>
        <div className="mt-6 flex flex-col gap-1">
          <span className="text-xs text-[#5b5f72]">Total due</span>
          <span className="text-4xl font-semibold tracking-tight tabular">
            49.99 <span className="text-lg font-medium text-[#5b5f72]">USDT</span>
          </span>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          {[
            ["Masala chai tin", "24.00"],
            ["Ceramic cup set", "25.99"],
          ].map(([n, a]) => (
            <div key={n} className="flex justify-between text-sm">
              <span className="text-[#5b5f72]">{n}</span>
              <span className="tabular">{a}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#e6e7ee] px-3 py-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-[#F6851B]/15 text-xs font-bold text-[#E2761B]">M</span>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium">MetaMask</span>
            <span className="font-mono text-xs text-[#5b5f72]">0x7a3f…91c2</span>
          </div>
          <span className="text-xs font-medium text-[#0e8a5f]">152.40 USDT</span>
        </div>
        <div className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-[#3B5BFF] text-sm font-semibold text-white">Pay 49.99 USDT</div>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#5b5f72]">
          <LogoMark className="size-3.5" /> Secured by Whitechain Commerce
        </p>
      </div>
      <div className="absolute -bottom-11 -left-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141420] px-4 py-3 text-white shadow-xl">
        <span className="grid size-8 place-items-center rounded-full bg-[#5CF2B4]/15 text-[#5CF2B4]">
          <Icon name="check" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium">Payment settled</span>
          <span className="text-xs text-white/60">+49.99 USDT · 1 block</span>
        </div>
      </div>
    </div>
  );
}
