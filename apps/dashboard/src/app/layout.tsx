import type { Metadata } from "next";
import type { ReactNode } from "react";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl()),
  title: { default: "Whitechain Commerce", template: "%s · Whitechain Commerce" },
  twitter: { card: "summary" },
  description: "Non-custodial USDT checkout on Whitechain. Instant settlement to your own wallet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
