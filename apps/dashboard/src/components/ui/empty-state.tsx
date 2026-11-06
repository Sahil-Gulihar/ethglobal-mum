import type { ReactNode } from "react";
import type { IconName } from "@/components/icons";

/* docs/DESIGN.md, Empty states: one line of secondary text plus one primary action. No illustrations. */
export function EmptyState({ title, description, action }: { icon?: IconName; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
