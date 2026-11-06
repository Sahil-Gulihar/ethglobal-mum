import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
        {eyebrow}
        <h1 className="text-3xl font-medium leading-tight tracking-tight sm:text-[2rem]">{title}</h1>
        {description && <p className="text-sm leading-[1.4] tracking-[0.14px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
