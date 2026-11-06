import type { Metadata } from "next";
import { HostedCheckout, type CheckoutTheme } from "./hosted-checkout";
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
  const { theme: rawTheme } = await searchParams;
  // ?theme=light|dark forces a theme; anything else follows the OS.
  const theme: CheckoutTheme = rawTheme === "dark" || rawTheme === "light" ? rawTheme : "auto";

  return (
    <div className={styles.page} data-theme={theme}>
      <header className={styles.top}>
        <span className={styles.brand}>
          <LogoMark />
          <span>
            Whitechain <span className={styles.brandSoft}>Commerce</span>
          </span>
        </span>
        <span className={styles.secure}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="2" />
          </svg>
          Secure checkout
        </span>
      </header>

      <main className={styles.center}>
        <h1 className={styles.srOnly}>Checkout</h1>
        <HostedCheckout sessionId={sessionId} theme={theme} />
      </main>

      <footer className={styles.bottom}>
        Funds go straight from your wallet to the merchant on Whitechain. We never hold your money.
      </footer>
    </div>
  );
}

/** Monochrome mark (same drawing as the dashboard's LogoMark), using this page's scoped tokens. */
function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden className={styles.mark}>
      <rect width="32" height="32" rx="8" fill="var(--co-fg)" />
      <path
        d="M7.5 10.5 11.2 22l4.8-8.6 4.8 8.6 3.7-11.5"
        fill="none"
        stroke="var(--co-bg-100)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
