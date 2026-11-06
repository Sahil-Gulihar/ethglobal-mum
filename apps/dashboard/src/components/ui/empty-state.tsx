import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

export function EmptyState({ icon = "inbox", title, description, action }: { icon?: IconName; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-11 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon name={icon} className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
