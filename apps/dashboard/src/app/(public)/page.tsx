import Image from "next/image";
import Link from "next/link";
import { getCurrentMerchant } from "@/lib/auth";
import { Wordmark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { CodeBlock } from "@/components/code-block";

const steps = [
  ["Set up your store", "Create an account and connect the wallet where you want to receive payments."],
  ["Add checkout", "Send customers to hosted checkout from your store, or share a fixed-price payment link."],
  ["Get paid directly", "Receive USDT in your payout wallet. Use signed webhooks to update store orders after confirmation."],
];

export default async function Landing() {
  const merchant = await getCurrentMerchant();
  const destination = merchant ? "/dashboard" : "/signup";
  const cta = merchant ? "Open dashboard" : "Get started";

  return (
    <>
      <main className="public-frame landing-main">
        <section className="landing-intro">
          <p className="landing-network">Whitechain Sepolia <span>Testnet only</span></p>
          <h1>Accept on-chain payments on Whitechain</h1>
          <p className="landing-lede">Add USDT as a payment option in your store. Customers pay from their wallets, and funds go straight to yours.</p>
          <div className="public-actions">
            <Link href={destination} className="public-primary">{cta} <Icon name="arrowRight" /></Link>
            <Link href="/docs" className="public-secondary">Integration guide</Link>
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
              <li>Hosted checkout and payment links</li>
              <li>Direct wallet settlement</li>
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
            <p>Add a USDT payment option with a single API call from your store server. Send shoppers to the checkout URL and fulfil orders after verifying the payment webhook.</p>
            <Link href="/docs/quickstart" className="public-secondary">Integration quickstart <Icon name="arrowRight" /></Link>
          </div>
          <div className="landing-code">
            <CodeBlock language="bash" filename="Create a checkout session" code={`curl --fail-with-body "$WC_API_BASE/checkout_sessions" \\
  -H "Authorization: Bearer $WC_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"orderId":"order_123","amount":"49.99","currency":"USDT"}'`} />
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
