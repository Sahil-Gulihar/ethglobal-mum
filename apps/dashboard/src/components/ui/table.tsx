import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* docs/DESIGN.md, Tables: 14px, header 13px/500 secondary on background-200, 1px subtle row rules, hover alpha-100. */
/** `framed` wraps the table in the 1px subtle border with radius 8 (the default containment for dashboard tables). */
export function Table({ className, framed = false, ...props }: HTMLAttributes<HTMLTableElement> & { framed?: boolean }) {
  return (
    <div className={cn("relative w-full min-w-0 overflow-x-auto", framed && "rounded-lg border border-border")}>
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-surface-2 [&_tr]:border-b [&_tr]:border-border [&_tr:hover]:bg-transparent", className)} {...props} />;
}
export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-border transition-colors duration-150 hover:bg-muted", className)} {...props} />;
}
export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-10 px-4 text-left align-middle text-[13px] font-medium whitespace-nowrap text-muted-foreground", className)} {...props} />;
}
export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("h-12 px-4 py-2.5 align-middle whitespace-nowrap tabular", className)} {...props} />;
}
