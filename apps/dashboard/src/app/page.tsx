import Link from "next/link";
import { getCurrentMerchant } from "@/lib/auth";
import { LogoMark, Wordmark } from "@/components/brand";
import { clientSnippet, serverSnippet } from "@/components/snippets";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { CheckoutHero } from "@/components/marketing/checkout-hero";
import { CodePanel } from "@/components/marketing/code-panel";

const EXPLORER = "https://explorer.testnet.whitechain.io";

const steps = [
  { title: "Create an account", body: "Sign up, connect the wallet you want to be paid in and copy a secret key." },
  { title: "Drop in the checkout", body: "Create a session on your server and render one React component. About 20 lines." },
  { title: "Get paid in USDT", body: "Customers pay from any browser wallet. You receive a signed webhook the moment it settles." },
];

const features = [
  {
    title: "Non-custodial by design",
    body: "USDT moves from your customer's wallet to yours in a single transfer. The router contract never holds a balance, so there is nothing to freeze or withdraw.",
  },
  {
    title: "Settles in about a block",
    body: "Funds land in your payout wallet as soon as the payment confirms. No payout schedule, no reserve, no waiting on a batch.",
  },
  {
    title: "Refunds linked onchain",
    body: "Full or partial refunds reference the original payment, so you, your customer and any auditor can trace every cent.",
  },
  {
    title: "Verified merchants",
    body: "Every merchant is registered onchain to a payout address. Proof of Human verification (one person, one store) is coming soon.",
  },
];

const devPoints = [
  "Typed React SDK and server helpers",
  "HMAC-signed webhooks with automatic retries",
  "Every payment verified against the PaymentSettled event",
  "One payment per order, enforced onchain",
];

const container = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";

export default async function Landing() {
  const merchant = await getCurrentMerchant();
  const start = merchant ? "/dashboard" : "/signup";

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className={`${container} flex h-16 items-center justify-between gap-6`}>
          <div className="flex items-center gap-8">
            <Wordmark />
            <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <a href="#how" className="transition-colors duration-150 hover:text-foreground">
                How it works
              </a>
              <a href="#features" className="transition-colors duration-150 hover:text-foreground">
                Features
              </a>
              <a href="#developers" className="transition-colors duration-150 hover:text-foreground">
                Developers
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {merchant ? (
              <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                  Log in
                </Link>
                <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: copy, then the product shot running off the section's bottom rule */}
        <section className="border-b border-border">
          <div className={`${container} flex flex-col items-center pt-16 text-center sm:pt-24`}>
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className="status-dot text-success" aria-hidden />
              Live on Whitechain Sepolia testnet
            </p>
            <h1 className="mt-5 max-w-[16ch] text-[2.5rem] leading-[44px] font-[450] tracking-[-0.05em] sm:text-5xl sm:leading-[56px] sm:tracking-[-0.06em]">
              USDT checkout that pays your own wallet
            </h1>
            <p className="mt-5 max-w-[56ch] text-lg leading-7 text-muted-foreground">
              A hosted checkout and React SDK for stablecoin payments on Whitechain. Customers pay from their browser wallet and the funds reach your
              payout address in about a block, with nobody holding them in between.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={start} className={buttonVariants({ size: "lg" })}>
                {merchant ? "Open dashboard" : "Start accepting payments"}
              </Link>
              <a href="#developers" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                See the integration
              </a>
            </div>
          </div>
          <div className={`${container} mt-14 sm:mt-16`}>
            <div className="mx-auto max-w-[1152px]">
              <CheckoutHero />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-4 border-b border-border">
          <div className={`${container} py-20 sm:py-24`}>
            <SectionHead id="how-title" title="Live in an afternoon" body="Three steps from sign-up to your first settled payment." />
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
              {steps.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-2 border-t border-border pt-5">
                  <span className="font-mono text-[13px] text-faint tabular">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 text-base font-medium tracking-[-0.02em]">{s.title}</h3>
                  <p className="max-w-[40ch] text-sm leading-5 text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features: a ruled grid, no cards */}
        <section id="features" aria-labelledby="features-title" className="scroll-mt-4 border-b border-border">
          <div className={`${container} py-20 sm:py-24`}>
            <SectionHead
              id="features-title"
              title="Crypto payments without the custody risk"
              body="Built on a router contract that can only move funds one way: from your customer to you."
            />
            <div className="mt-12 grid overflow-hidden rounded-lg border border-border sm:grid-cols-2">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className={[
                    "flex flex-col gap-2 p-6 sm:p-8",
                    i > 0 ? "border-t border-border" : "",
                    i === 1 ? "sm:border-t-0" : "",
                    i % 2 === 1 ? "sm:border-l sm:border-border" : "",
                  ].join(" ")}
                >
                  <h3 className="text-base font-medium tracking-[-0.02em]">{f.title}</h3>
                  <p className="max-w-[52ch] text-sm leading-5 text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Developers */}
        <section id="developers" aria-labelledby="dev-title" className="scroll-mt-4 border-b border-border">
          <div className={`${container} grid items-start gap-12 py-20 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]`}>
            <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-8">
              <SectionHead
                id="dev-title"
                title="One component, one webhook"
                body="Price the order on your server, render the checkout, and fulfil from a signed webhook that is checked against the onchain settlement event."
              />
              <ul className="flex flex-col border-t border-border text-sm">
                {devPoints.map((t) => (
                  <li key={t} className="border-b border-border py-3">
                    {t}
                  </li>
                ))}
              </ul>
              <Link href={start} className={buttonVariants({ variant: "secondary", className: "w-fit" })}>
                {merchant ? "Get your API keys" : "Create an account for API keys"}
              </Link>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <CodePanel filename="app/api/checkout/route.ts" code={serverSnippet()} />
              <CodePanel filename="components/checkout.tsx" code={clientSnippet()} />
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section aria-labelledby="cta-title">
          <div className={`${container} flex flex-col items-center py-20 text-center sm:py-28`}>
            <h2 id="cta-title" className="max-w-[22ch] text-[2rem] leading-10 font-[450] tracking-[-0.05em] sm:text-[2.5rem] sm:leading-[48px]">
              Take USDT today and keep every cent in your own wallet
            </h2>
            <p className="mt-4 max-w-[48ch] text-muted-foreground">Free on testnet. Setup takes a few minutes.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={start} className={buttonVariants({ size: "lg" })}>
                {merchant ? "Open dashboard" : "Start accepting payments"}
              </Link>
              {!merchant && (
                <Link href="/login" className={buttonVariants({ size: "lg", variant: "ghost" })}>
                  Log in
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={`${container} flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-3">
            <LogoMark className="size-5" />
            <span className="text-[13px] text-muted-foreground">© {new Date().getFullYear()} Whitechain Commerce. Testnet preview.</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
              <a href="#developers" className="transition-colors duration-150 hover:text-foreground">
                Developers
              </a>
              <a href={EXPLORER} target="_blank" rel="noreferrer" className="transition-colors duration-150 hover:text-foreground">
                Explorer
              </a>
              <Link href="/login" className="transition-colors duration-150 hover:text-foreground">
                Log in
              </Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ id, title, body }: { id: string; title: string; body?: string }) {
  return (
    <div className="flex max-w-[60ch] flex-col gap-3">
      <h2 id={id} className="text-2xl leading-8 font-[450] tracking-[-0.04em] sm:text-[2rem] sm:leading-10">
        {title}
      </h2>
      {body && <p className="text-base leading-6 text-muted-foreground">{body}</p>}
    </div>
  );
}
