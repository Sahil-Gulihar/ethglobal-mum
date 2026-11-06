import Image from "next/image";
import Link from "next/link";
import { getCurrentMerchant } from "@/lib/auth";
import { Wordmark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { CodeBlock } from "@/components/code-block";
import { clientSnippet, serverSnippet } from "@/components/snippets";

const steps = [
  ["Set up your store", "Create an account and connect the wallet where you want to receive payments."],
  ["Add checkout", "Create a session on your server and send customers to your hosted checkout."],
  ["Get paid directly", "Your customer pays in USDT. A signed webhook tells your store when the payment settles."],
];

export default async function Landing() {
  const merchant = await getCurrentMerchant();
  const destination = merchant ? "/dashboard" : "/signup";
  const cta = merchant ? "Open dashboard" : "Get started";

  return (
    <>
      <main className="public-frame landing-main">
        <section className="landing-intro">
          <p className="landing-network">Whitechain Sepolia <span>Testnet</span></p>
          <h1>USDT checkout for online stores</h1>
          <p className="landing-lede">Accept USDT on Whitechain and settle directly to your own wallet.</p>
          <div className="public-actions">
            <Link href={destination} className="public-primary">{cta} <Icon name="arrowRight" /></Link>
            <Link href="/docs" className="public-secondary">Read the docs</Link>
          </div>
        </section>

        <section id="payments" className="landing-showcase" aria-label="Payments">
          <figure className="landing-preview">
            <figcaption>Chai House <span>Sample store · Synthetic payments</span></figcaption>
            <div className="landing-preview-body">
              <Image
                src="/product/dashboard-sample.webp"
                alt="Chai House dashboard with three sample payments, 91.99 USDT in gross volume and an 18.00 USDT refund"
                width={1120}
                height={480}
                unoptimized
                preload
              />
              <Image
                src="/product/checkout-sample.webp"
                alt="Dark checkout receipt for the sample 49.99 USDT payment, order 4821"
                width={856}
                height={1164}
                loading="eager"
                unoptimized
              />
            </div>
          </figure>

          <div className="landing-feature-rail">
            <h2>Follow a payment from checkout to settlement</h2>
            <ul aria-label="Payment features">
              <li>Hosted checkout</li>
              <li>Onchain settlement</li>
              <li>Full and partial refunds</li>
              <li>Signed webhooks</li>
            </ul>
          </div>
        </section>

        <section id="how" className="landing-section">
          <h2>From setup to settlement</h2>
          <ol className="landing-steps">
            {steps.map(([title, description], index) => (
              <li key={title}>
                <span aria-hidden="true">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="developers" className="landing-section landing-developers">
          <div>
            <h2>Integrate with your store</h2>
            <p>Create a checkout session on your server, render the checkout, and fulfil orders when the signed webhook arrives.</p>
            <Link href="/docs/quickstart" className="public-secondary">Integration quickstart <Icon name="arrowRight" /></Link>
          </div>
          <div className="landing-code">
            <CodeBlock filename="app/api/checkout/route.ts" code={serverSnippet()} />
            <CodeBlock filename="Checkout.tsx" code={clientSnippet()} />
          </div>
        </section>
      </main>
      <footer className="public-frame landing-footer">
        <Wordmark />
        <p>© {new Date().getFullYear()} Whitechain Commerce</p>
        <Link href="/docs">Docs</Link>
        {!merchant && <Link href="/login">Log in</Link>}
        <a href="https://explorer.testnet.whitechain.io" target="_blank" rel="noreferrer">Whitechain Explorer ↗</a>
      </footer>
    </>
  );
}
