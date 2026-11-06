import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { PublicHeader } from "@/components/public-header";
import "./public.css";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`public-site ${GeistSans.variable} ${GeistMono.variable}`}>
      <PublicHeader />
      {children}
    </div>
  );
}
