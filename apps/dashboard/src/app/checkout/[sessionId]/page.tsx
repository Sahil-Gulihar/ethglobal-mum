import type { Metadata } from "next";
import { HostedCheckout } from "./hosted-checkout";
import styles from "./checkout.module.css";
import { LogoMark } from "@/components/brand";
import { Icon } from "@/components/icons";

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
    <main className={`${theme === "dark" ? "checkout-dark" : "checkout-light"} ${styles.page}`} data-theme={theme === "dark" ? "dark" : "light"}>

      <header className={styles.top}>
        <span className={styles.brand}>
          <LogoMark className="size-6" />
          Whitechain <span className={styles.brandSoft}>Commerce</span>
        </span>
        <span className={styles.secure}>
          <Icon name="lock" className="size-3" />
          Secure checkout
        </span>
      </header>

      <section className={styles.center}>
        <HostedCheckout sessionId={sessionId} theme={theme === "dark" ? "dark" : "light"} />
      </section>

      <footer className={styles.bottom}>
        You pay the store directly from your wallet.
      </footer>
    </main>
  );
}
