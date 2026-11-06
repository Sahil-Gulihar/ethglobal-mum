import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
        {eyebrow}
        <h1 className="text-[18px] leading-[30px] font-medium">{title}</h1>
        {description && <p className="text-sm leading-[1.4] tracking-[0.14px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 [&>:is(a,button)]:h-[30px]">{actions}</div>}
    </header>
  );
}
