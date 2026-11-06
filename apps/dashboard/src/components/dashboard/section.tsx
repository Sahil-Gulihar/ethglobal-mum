import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* docs/DESIGN.md, Cards: avoid. A section is a heading-16 title, optional secondary line, then content. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="text-base leading-6 font-medium tracking-[-0.02em]">
            {title}
          </h2>
          {description && <div className="max-w-[68ch] text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Settings-group style containment: 1px subtle border, radius 8. Rows inside are separated by hairlines. */
export function Group({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("min-w-0 rounded-lg border border-border bg-background", className)}>{children}</div>;
}

/** Label / value row for definition lists inside a Group. */
export function DetailRow({ label, children, action }: { label: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-12 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-sm sm:justify-end sm:text-right">
        <span className="min-w-0 truncate">{children}</span>
        {action}
      </dd>
    </div>
  );
}
