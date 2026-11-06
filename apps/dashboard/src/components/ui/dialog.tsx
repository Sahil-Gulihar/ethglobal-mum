"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog> element (focus trap, Escape, top layer for free).
 * Controlled via `open` / `onOpenChange`.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  /** When false, Escape and backdrop clicks don't close it (e.g. while a tx is in flight). */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onOpenChange(false);
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onOpenChange(false);
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-popover p-0 text-popover-foreground shadow-float",
        className,
      )}
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id={titleId} className="text-[15px] leading-5 font-semibold">
                {title}
              </h2>
              {description && <p className="text-[13px] leading-5 text-muted-foreground">{description}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className="-mt-1 -mr-1.5 grid size-7 shrink-0 place-items-center rounded-md text-icon outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
