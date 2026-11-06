import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <path d="M24 166 165 204 202 275 228 232H257L282 275 316 217 324 208 291 174 373 175 408 198 489 208 386 228Q378 230 374 237L306 359H273L241 301 208 359H162L97 260H135L77 236Z" />
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
      <span className="text-[14px] font-medium tracking-tight">
        Whitechain <span className={tone === "light" ? "text-white/60" : "text-muted-foreground"}>Commerce</span>
      </span>
    </Link>
  );
}
