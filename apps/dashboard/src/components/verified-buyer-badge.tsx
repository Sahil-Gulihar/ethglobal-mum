/** Shown to buyers who passed the 0G human check, and to merchants on those buyers' payments. */
export function VerifiedBuyerBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success-soft px-2.5 py-1 text-xs font-semibold text-success ${className}`}>
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <path fill="currentColor" d="M8 0l2 1.6 2.5-.3.9 2.4 2.3 1.1-.4 2.5L16 9.4l-1.7 1.9.1 2.5-2.5.6-1.4 2.1L8 15.4l-2.5 1.1-1.4-2.1-2.5-.6.1-2.5L0 9.4l.7-2.1L.3 4.8l2.3-1.1.9-2.4 2.5.3z" />
        <path fill="var(--card)" d="M6.9 10.9L4.6 8.6l1-1 1.3 1.3 3.5-3.5 1 1z" />
      </svg>
      Verified buyer
    </span>
  );
}
