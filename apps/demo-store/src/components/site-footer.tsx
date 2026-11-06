import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-paper">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-10">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Chai &amp; Co. is a fictional demo store. No tea is shipped and no real money changes hands: payments run on
            Whitechain Sepolia, a test network.
          </p>
        </div>
        <nav aria-label="Shop" className="text-sm">
          <p className="font-medium text-ink">Shop</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <Link href="/#collection" className="transition-colors hover:text-ink">
                The collection
              </Link>
            </li>
            <li>
              <Link href="/#paying" className="transition-colors hover:text-ink">
                Paying with USDT
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Store" className="text-sm">
          <p className="font-medium text-ink">Store</p>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              <Link href="/admin" className="transition-colors hover:text-ink">
                Store admin
              </Link>
            </li>
            <li>Mumbai, India</li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-5 py-5 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between md:px-10">
          <p>
            Payments by <span className="font-medium text-ink">Whitechain Commerce</span>
          </p>
          <p>USDT on Whitechain Sepolia · Non-custodial</p>
        </div>
      </div>
    </footer>
  );
}
