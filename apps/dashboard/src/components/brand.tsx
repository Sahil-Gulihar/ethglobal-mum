import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return <Image src="/brand/logo-128.webp" width={32} height={32} alt="" loading="eager" className={cn("size-7 shrink-0 rounded-sm", className)} />;
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
