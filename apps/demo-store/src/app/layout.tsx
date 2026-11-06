import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/components/cart";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Chai & Co. · Small-batch masala chai",
  description: "A demo merchant paying in USDT on Whitechain via Whitechain Commerce.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <CartProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>Chai &amp; Co. is a fictional demo store. No real tea will be shipped.</p>
              <p>
                Payments by <span className="font-medium text-ink">Whitechain Commerce</span> · USDT on Whitechain
                Sepolia
              </p>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
