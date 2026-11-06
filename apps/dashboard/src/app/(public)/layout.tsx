import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";
import "./public.css";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-site">
      <PublicHeader />
      {children}
    </div>
  );
}
