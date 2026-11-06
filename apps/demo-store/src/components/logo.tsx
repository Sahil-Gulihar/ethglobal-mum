export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden className="text-masala">
        <path d="M6 10h18l-1.6 12.2A4.5 4.5 0 0 1 17.9 26h-5.8a4.5 4.5 0 0 1-4.5-3.8L6 10Z" fill="currentColor" />
        <path d="M24 13h1.6a3.2 3.2 0 0 1 0 6.4h-2.4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M11 6.5c-.9-1.2.9-1.8 0-3M15 6.5c-.9-1.2.9-1.8 0-3M19 6.5c-.9-1.2.9-1.8 0-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      </svg>
      <span className="font-display text-[23px] leading-none tracking-[-0.01em] text-ink">
        Chai <span className="italic text-masala">&amp;</span> Co.
      </span>
    </span>
  );
}
