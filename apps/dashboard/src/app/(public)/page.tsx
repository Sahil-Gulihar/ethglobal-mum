import Image from "next/image";
import Link from "next/link";
import { getCurrentMerchant } from "@/lib/auth";
import { Wordmark } from "@/components/brand";
import { Icon } from "@/components/icons";
import { CodeBlock } from "@/components/code-block";

const checkoutExample = String.raw`curl --fail-with-body "$WC_API_BASE/checkout_sessions" \
  -H "Authorization: Bearer $WC_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"order_4821","amount":"49.99","currency":"USDT"}'`;

const steps = [
  ["Set up your store", "Create an account and connect the wallet where you want to receive payments."],
  ["Add checkout", "Send customers to hosted checkout from your store, or share a fixed-price payment link."],
  ["Get paid directly", "Your customer pays in USDT. A signed webhook tells your store when the payment settles."],
];

export default async function Landing() {
  const merchant = await getCurrentMerchant();
  const destination = merchant ? "/dashboard" : "/signup";
  const cta = merchant ? "Open dashboard" : "Get started";

  return (
    <>
      <main className="public-frame landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-intro">
            <h1 id="landing-title">Accept on-chain payments on Whitechain</h1>
            <p className="landing-lede">Let customers pay in USDT on Whitechain. Payments settle directly to your wallet, and signed webhooks tell your store when to fulfil an order.</p>
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
                <div><dt>Settlement</dt><dd>Merchant wallet</dd></div>
                <div><dt>Store notification</dt><dd>Signed webhook</dd></div>
              </dl>
            </div>
            <p>Illustrative receipt</p>
          </figure>
        </section>

        <section id="payments" className="landing-section landing-payments" aria-labelledby="payments-title">
          <div>
            <h2 id="payments-title">See what settled</h2>
            <p>Track USDT payments in the dashboard and issue full or partial refunds.</p>
          </div>
          <figure className="landing-preview">
            <Image
              src="/product/dashboard-sample.webp"
              alt="Chai House dashboard showing three sample payments, 91.99 USDT in gross volume, and an 18.00 USDT refund"
              width={1120}
              height={480}
              unoptimized
            />
            <figcaption>Chai House dashboard · Synthetic payments</figcaption>
          </figure>
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
            <p>Create a checkout session on your server and send customers to the hosted checkout URL in the response. Verify the signed webhook before fulfilling the order.</p>
            <Link href="/docs/quickstart" className="public-secondary">Integration quickstart <Icon name="arrowRight" /></Link>
          </div>
          <div className="landing-code">
            <CodeBlock language="bash" filename="Create a checkout session" code={checkoutExample} />
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
