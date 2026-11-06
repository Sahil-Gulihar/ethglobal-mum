import type { Metadata } from "next";
import { HostedCheckout } from "./hosted-checkout";
import styles from "./checkout.module.css";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Pay with USDT on Whitechain.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await params;
  const { theme } = await searchParams;

  return (
    <main className={styles.page}>
      <div className={styles.glowA} aria-hidden />
      <div className={styles.glowB} aria-hidden />
      <div className={styles.grid} aria-hidden />

      <header className={styles.top}>
        <span className={styles.brand}>
          <Mark />
          Whitechain <span className={styles.brandSoft}>Commerce</span>
        </span>
        <span className={styles.secure}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="2" />
          </svg>
          Secure checkout
        </span>
      </header>

      <section className={styles.center}>
        <HostedCheckout sessionId={sessionId} theme={theme === "dark" ? "dark" : "light"} />
      </section>

      <footer className={styles.bottom}>
        Funds go straight from your wallet to the merchant on Whitechain. We never hold your money.
      </footer>
    </main>
  );
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="7" fill="#3B5BFF" />
      <path d="M6 8l2.6 8L12 9.5 15.4 16 18 8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
