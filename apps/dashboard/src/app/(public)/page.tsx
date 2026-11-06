import Image from "next/image";
import Link from "next/link";
import { getCurrentMerchant } from "@/lib/auth";
import { Wordmark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { CodeBlock } from "@/components/code-block";

const checkoutExample = `import { createCheckoutSession } from "@whitechain-commerce/react/server";

const session = await createCheckoutSession({
  apiBase: process.env.WC_API_BASE!,
  secretKey: process.env.WC_SECRET_KEY!,
  orderId: "order_123",
  amount: "49.99",
});

// Redirect the shopper to session.url.`;

const steps = [
  ["Set up your store", "Create an account and connect the wallet where you want to receive payments."],
  ["Add checkout", "Send customers to hosted checkout from your store, or share a fixed-price payment link."],
  ["Get paid directly", "Customer payments go straight to your wallet. Your store gets an update when they’re confirmed."],
];

export default async function Landing() {
  const merchant = await getCurrentMerchant();
  const destination = merchant ? "/dashboard" : "/signup";
  const cta = merchant ? "Open dashboard" : "Get started";

  return (
    <>
      <link rel="stylesheet" href="https://vercel.com/geist/vercel-brand.css" precedence="vbg" />
      <main className="public-frame landing-main vbg-report">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-intro">
            <h1 className="vbg-display" id="landing-title">Accept USDT payments</h1>
            <p className="landing-lede">Let customers pay in USDT. Payments go straight to your wallet, and your store gets an update when an order is paid.</p>
            <div className="public-actions">
              <Link href={destination} className="public-primary">{cta} <Icon name="arrowRight" /></Link>
              <Link href="/docs" className="public-secondary">Integration guide</Link>
            </div>
          </div>

          <figure className="landing-stage">
            <figcaption>Chai House <span>Example payment</span></figcaption>
            <div className="landing-receipt">
              <div className="landing-receipt-total">
                <span>Order #4821</span>
                <p>49.99 <span>USDT</span></p>
              </div>
              <dl>
                <div><dt>Checkout</dt><dd>Payment received</dd></div>
                <div><dt>Paid to</dt><dd>Store wallet</dd></div>
                <div><dt>Store notification</dt><dd>Payment confirmed</dd></div>
              </dl>
            </div>
            <p>Illustrative receipt</p>
          </figure>
        </section>

        <section id="payments" className="landing-section landing-payments" aria-labelledby="payments-title">
          <div>
            <h2 className="vbg-heading-24" id="payments-title">See your payments</h2>
            <p>Track USDT payments in the dashboard and issue full or partial refunds.</p>
          </div>
          <figure className="landing-preview">
            <Image
              src="/product/dashboard-sample.webp"
              alt="Chai House dashboard showing 73.99 USDT received after refunds and three sample payments"
              width={1120}
              height={600}
              unoptimized
            />
            <figcaption>Chai House dashboard · Synthetic payments</figcaption>
          </figure>
        </section>

        <section id="how" className="landing-section">
          <h2 className="vbg-heading-24">Start taking payments</h2>
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
            <h2 className="vbg-heading-24">Integrate with your store</h2>
            <p>Create a checkout session on your server with the TypeScript, Python, or Go SDK and send shoppers to the hosted checkout URL. Verify the payment update before marking the order as paid.</p>
            <Link href="/docs/quickstart" className="public-secondary">Integration quickstart <Icon name="arrowRight" /></Link>
          </div>
          <div className="landing-code">
            <CodeBlock language="typescript" filename="Create a checkout session" code={checkoutExample} />
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
