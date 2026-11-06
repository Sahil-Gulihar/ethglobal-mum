import Link from "next/link";
import { cn } from "@/lib/utils";

/** Our mark: a monochrome rounded square with a "W" chain stroke. Follows the theme (gray-1000 on background). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-6 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="var(--gray-1000)" />
      <path d="M7.5 10.5 11.2 22l4.8-8.6 4.8 8.6 3.7-11.5" fill="none" stroke="var(--bg-100)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className, href = "/", tone = "default" }: { className?: string; href?: string; tone?: "default" | "light" }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 rounded-md", tone === "light" ? "text-white" : "text-foreground", className)}>
      <LogoMark />
      <span className="text-[15px] font-medium tracking-[-0.02em]">
        Whitechain <span className={tone === "light" ? "text-white/60" : "text-muted-foreground"}>Commerce</span>
      </span>
    </Link>
  );
}
