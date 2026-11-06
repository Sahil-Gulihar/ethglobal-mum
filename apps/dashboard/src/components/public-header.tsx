"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand";

export function PublicHeader() {
  const docs = usePathname().startsWith("/docs");

  return (
    <header className="public-header">
      <div className="public-frame public-header-inner">
        <Wordmark />
        <nav className="public-nav" aria-label="Main navigation">
          <Link href="/#payments" className="public-desktop-link">Payments</Link>
          <Link href="/#developers" className="public-desktop-link">Developers</Link>
          <Link href="/docs" aria-current={docs ? "true" : undefined}>Docs</Link>
        </nav>
        <Link href="/dashboard" className="public-dashboard">Dashboard</Link>
      </div>
    </header>
  );
}
