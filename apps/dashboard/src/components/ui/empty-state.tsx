import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

/* Gray art only for empty states: a quiet glyph on the well, one line, one action. */
export function EmptyState({ icon = "inbox", title, description, action }: { icon?: IconName; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="grid size-10 place-items-center rounded-lg bg-well text-icon shadow-[inset_0_0_0_1px_var(--border)]">
        <Icon name={icon} className="size-[18px]" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        {description && <p className="max-w-sm text-[13px] leading-5 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
