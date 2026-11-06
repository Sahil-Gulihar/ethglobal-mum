import { cn } from "@/lib/utils";

/* Skeletons at the content's own geometry, in the placeholder ink. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-full bg-black/[0.06]", className)} />;
}
