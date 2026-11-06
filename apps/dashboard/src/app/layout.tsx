import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl()),
  title: { default: "White Money", template: "%s · White Money" },
  twitter: { card: "summary" },
  description: "Accept on-chain USDT payments in your store with White Money. Hosted checkout, payment links and direct wallet settlement.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
