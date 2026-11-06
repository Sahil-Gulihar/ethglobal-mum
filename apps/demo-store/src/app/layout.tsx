import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { CartProvider } from "@/components/cart";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chai & Co. · Small-batch masala chai",
  description: "A demo merchant paying in USDT on Whitechain via White Money.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-full flex-col">
        <CartProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>Chai &amp; Co. is a fictional demo store. No real tea will be shipped.</p>
              <p>
                Payments by <span className="font-medium text-ink">White Money</span>
              </p>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
