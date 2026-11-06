"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function DashboardSections({ sections }: { sections: { label: string; content: ReactNode }[] }) {
  const [selected, setSelected] = useState(0);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <nav aria-label="Page sections" className="flex flex-wrap gap-x-5 border-b border-border">
        {sections.map(({ label }, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
            className="min-h-8 border-b border-transparent px-0.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-ring aria-pressed:border-foreground aria-pressed:text-foreground"
          >
            {label}
          </button>
        ))}
      </nav>
      <div key={selected} className="min-w-0">
        {sections[selected].content}
      </div>
    </div>
  );
}

export function DashboardPager({ pages, label = "Page", initial = 0 }: { pages: ReactNode[]; label?: string; initial?: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const current = Math.min(selected ?? initial, pages.length - 1);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div key={current} className="min-w-0">
        {pages[current]}
      </div>
      {pages.length > 1 && (
        <nav aria-label={`${label} navigation`} className="flex items-center justify-end gap-2">
          <span aria-live="polite" className="mr-1 text-xs text-muted-foreground tabular">
            {label} {current + 1} of {pages.length}
          </span>
          <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setSelected(current - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={current === pages.length - 1} onClick={() => setSelected(current + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
