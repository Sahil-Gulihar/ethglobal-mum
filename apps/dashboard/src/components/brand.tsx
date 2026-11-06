import Link from "next/link";
import { cn } from "@/lib/utils";

/** Our mark: a rounded square with a stylised "W" chain link. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" fill="#3B5BFF" />
      <path d="M7.5 10.5 11.2 22l4.8-8.6 4.8 8.6 3.7-11.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ className, href = "/", tone = "default" }: { className?: string; href?: string; tone?: "default" | "light" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone === "light" ? "text-white" : "text-foreground",
        className,
      )}
    >
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">
        Whitechain <span className={tone === "light" ? "text-white/60" : "text-muted-foreground"}>Commerce</span>
      </span>
    </Link>
  );
}
