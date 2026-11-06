export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden className="text-masala">
        <g className="steam" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
          <path d="M11 9c-1.5-2 1.5-3 0-5" />
          <path d="M16 9c-1.5-2 1.5-3 0-5" />
          <path d="M21 9c-1.5-2 1.5-3 0-5" />
        </g>
        <path d="M6 12h18l-1.6 11.2A4 4 0 0 1 18.4 27h-6.8a4 4 0 0 1-4-3.8L6 12Z" fill="currentColor" />
        <path d="M24 14.5h1.5a3 3 0 0 1 0 6H23.4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8.5 16h13" stroke="#fbf6ee" strokeWidth="1.2" opacity="0.5" />
      </svg>
      <span className="font-display text-lg font-bold tracking-tight text-ink">
        Chai <span>&amp;</span> Co.
      </span>
    </span>
  );
}
