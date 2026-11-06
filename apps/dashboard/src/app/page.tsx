import Image from "next/image";
import Link from "next/link";
import { getCurrentMerchant } from "@/lib/auth";
import { Wordmark, LogoMark } from "@/components/brand";
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
            <h1>Good business.<br /><em>Better payments.</em></h1>
            <p>Accept USDT with a checkout that sends payments straight to your wallet. Simple for your customers, straightforward for you.</p>
            <div className="landing-hero-actions"><Link href={destination} className="landing-button">Start accepting payments <Icon name="arrowRight" /></Link><a href="#how" className="landing-text-link">See how it works <span>↗</span></a></div>
            <div className="landing-note"><span className="landing-note-icon"><Icon name="shield" /></span><span>Non-custodial by design<br /><small>Your funds go directly to your wallet.</small></span></div>
          </div>
          <div className="hero-stage" aria-label="Illustration of a USDT checkout and a settled payment">
            <div className="stage-orbit orbit-one" /><div className="stage-orbit orbit-two" />
            <div className="stage-label">A smoother way to get paid <span>✳</span></div>
            <div className="stage-checkout">
              <div className="stage-top"><span className="stage-shop">✳</span><div><strong>Chai &amp; Co.</strong><small>Order #4821</small></div><span className="stage-network">Whitechain</span></div>
              <div className="stage-amount"><small>Total due</small><strong>49.99 <span>USDT</span></strong></div>
              <div className="stage-line"><span>Masala chai tin</span><span>24.00</span></div><div className="stage-line"><span>Ceramic cup set</span><span>25.99</span></div>
              <div className="stage-wallet"><span className="stage-wallet-icon">◈</span><div><strong>Wallet connected</strong><small>0x7a3f…91c2</small></div><span>✓</span></div>
              <div className="stage-pay">Pay 49.99 USDT</div><div className="stage-secure"><LogoMark className="size-4" /> Secured by Whitechain Commerce</div>
            </div>
            <div className="stage-receipt"><span>✓</span><div><strong>Payment received</strong><small>49.99 USDT settled</small></div></div>
          </div>
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
