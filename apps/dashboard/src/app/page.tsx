import Image from "next/image";
import Link from "next/link";
import { getCurrentMerchant } from "@/lib/auth";
import { Wordmark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { CodeBlock } from "@/components/code-block";
import { clientSnippet, serverSnippet } from "@/components/snippets";

const benefits = [
  ["01", "Your money stays yours", "Payments go directly from your customer’s wallet to yours. There’s no balance to withdraw."],
  ["02", "Ready when you are", "Settlement happens onchain, without waiting for a payout schedule."],
  ["03", "A clear trail, both ways", "Payments and full or partial refunds stay linked to the original order."],
];

export default async function Landing() {
  const merchant = await getCurrentMerchant();
  const destination = merchant ? "/dashboard" : "/signup";
  return (
    <div className="landing">
      <header className="landing-header">
        <Wordmark />
        <nav aria-label="Main navigation" className="landing-nav"><a href="#how">How it works</a><a href="#benefits">Why Whitechain</a><a href="#developers">Developers</a></nav>
        <div className="landing-header-actions"><Link href={merchant ? "/dashboard" : "/login"}>{merchant ? "Dashboard" : "Log in"}</Link><Link href={destination} className="landing-button landing-button-small">Get started <Icon name="arrowRight" /></Link></div>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-kicker"><span /> Built for Whitechain</div>
            <h1>Accept USDT.<br />Get paid directly.</h1>
            <p>Give customers a checkout for USDT on Whitechain. Payments go straight to your wallet.</p>
            <div className="landing-hero-actions"><Link href={destination} className="landing-button">Start accepting payments <Icon name="arrowRight" /></Link><a href="#how" className="landing-text-link">See how it works <span>↗</span></a></div>
            <div className="landing-note"><span className="landing-note-icon"><Icon name="shield" /></span><span>Non-custodial by design<br /><small>Your funds go directly to your wallet.</small></span></div>
          </div>
          <figure className="hero-stage">
            <Image
              src="/product/checkout-review.webp"
              alt="Chai & Co. checkout showing a 49.99 USDT payment ready to confirm on Whitechain Sepolia"
              width={880}
              height={1334}
              unoptimized
              preload
            />
            <figcaption>Whitechain Commerce checkout · Sample order</figcaption>
          </figure>
        </section>
        <section className="landing-strip"><span>Made for merchants, built onchain.</span><span>USDT payments</span><span>Direct settlement</span><span>Onchain refunds</span></section>
        <section id="benefits" className="landing-section benefits-section"><div className="section-intro"><p className="section-label">The better way to pay</p><h2>Less between you<br />and your money.</h2><p>A little less waiting, a lot more control. Everything you need to accept stablecoin payments, without giving up custody.</p></div><div className="benefits-list">{benefits.map(([number,title,body]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div><span className="benefit-plus">✳</span></article>)}</div></section>
        <section id="how" className="how-section"><div className="landing-section"><div className="how-heading"><div><p className="section-label">From setup to settlement</p><h2>Three steps.<br />One less thing to worry about.</h2></div><p>Bring your store onchain without rebuilding the way you do business.</p></div><div className="how-grid">{[["1", "Set up your store", "Create an account and connect the wallet where you want to receive payments."],["2", "Add checkout", "Create a session on your server and add the checkout to your store."],["3", "Get paid directly", "Your customer pays in USDT, and you receive a signed webhook when it settles."]].map(([n,title,body]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
        <section id="developers" className="landing-section developer-section"><div><p className="section-label">For developers</p><h2>Made to fit<br />your stack.</h2><p>Create a session on your server, render the checkout, and fulfil from a signed webhook.</p><Link href={destination} className="landing-button">Get your API keys <Icon name="arrowRight" /></Link></div><div className="developer-code"><CodeBlock filename="app/api/checkout/route.ts" code={serverSnippet()} /><CodeBlock filename="Checkout.tsx" code={clientSnippet()} /></div></section>
        <section className="landing-cta"><div><p className="section-label">Ready when you are</p><h2>Let’s make money<br /><em>move better.</em></h2><p>Get started with Whitechain Commerce.</p><Link href={destination} className="landing-button landing-button-light">Get started <Icon name="arrowRight" /></Link></div><div className="mascot-wrap"><Image src="/brand/mascot-1280.webp" alt="" width={1280} height={853} sizes="(max-width: 800px) 30vw, 340px" /></div></section>
      </main>
      <footer className="landing-footer"><Wordmark /><p>© {new Date().getFullYear()} Whitechain Commerce.</p><nav aria-label="Footer"><a href="#benefits">Why Whitechain</a><a href="#developers">Developers</a><a href="https://explorer.testnet.whitechain.io" target="_blank" rel="noreferrer">Explorer ↗</a></nav></footer>
    </div>
  );
}
