import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1280 1280" fill="currentColor" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <path d="M123 430H244L317 649 410 430H488L571 649 661 430H779L887 590 1002 430H1128V824H1007V622L883 796 731 574 633 824H521L444 634 365 824H261Z" />
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
      <span className="whitespace-nowrap text-[14px] font-medium tracking-tight">
        White Money
      </span>
    </Link>
  );
}
