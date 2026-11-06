const dayLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function SettlementChart({ daily }: { daily: { date: string; count: number }[] }) {
  const width = 1000;
  const height = 240;
  const step = Math.max(1, Math.ceil(Math.max(...daily.map((day) => day.count)) / 4));
  const ticks = [4, 3, 2, 1, 0].map((tick) => tick * step);
  const total = daily.reduce((sum, day) => sum + day.count, 0);
  const interval = width / (daily.length - 1);
  const points = daily.map((day, i) => ({
    ...day,
    x: i * interval,
    y: height - day.count * height / (step * 4),
  }));
  const line = points.map(({ x, y }, i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");

  return (
    <section aria-labelledby="settlement-heading" className="settlement-chart flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="settlement-heading" className="text-[18px] font-medium tracking-tight">Payment activity</h2>
        <span className="flex min-h-7 items-center bg-[#18191b] px-3 text-sm text-[#8a9099]">Last 14 days</span>
      </div>
      <div>
        <p className="mb-3 text-[13px] text-muted-foreground">Settled payments</p>
        <p className="text-[48px] leading-none font-light tracking-tight tabular">{total}</p>
      </div>
      <figure aria-label="Daily settled payments, UTC" className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 text-xs text-[var(--chart-text)]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-40 w-full sm:h-[var(--plot-height)] overflow-visible"
          role="img"
          aria-label={daily.map(({ date, count }) => `${date}: ${count}`).join(", ")}
        >
          <defs>
            <linearGradient id="settlement-fill" x2="0" y2="1">
              <stop stopColor="var(--chart-line)" stopOpacity=".15" />
              <stop offset="1" stopColor="var(--chart-line)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((tick, i) => (
            <path key={tick} d={`M0 ${i * height / 4}H${width}`} stroke="var(--chart-grid)" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${line} L${width},${height} H0 Z`} fill="url(#settlement-fill)" />
          <path d={line} fill="none" stroke="var(--chart-line)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          {points.map(({ date, count, x, y }) => (
            <g key={date} className="group">
              <rect x={Math.max(0, x - interval / 2)} width={x === 0 || x === width ? interval / 2 : interval} height={height} fill="transparent">
                <title>{`${dayLabel.format(new Date(date))}: ${count} settled`}</title>
              </rect>
              <path className="pointer-events-none opacity-0 group-hover:opacity-100" d={`M${x} 0V${height}M0 ${y}H${width}`} stroke="var(--chart-crosshair)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </svg>
        <div aria-hidden className="flex h-40 -translate-y-2 sm:h-[var(--plot-height)] flex-col justify-between tabular">
          {ticks.map((tick) => <span key={tick} className="leading-none">{tick}</span>)}
        </div>
        <div aria-hidden className="relative h-7 border-t border-[var(--chart-border)] tabular">
          {daily.map(({ date }, i) => {
            if (i === 0 || i === daily.length - 1) {
              return (
                <time key={date} dateTime={date} className={`absolute top-2 whitespace-nowrap ${i === 0 ? "left-0" : "right-0"}`}>
                  {dayLabel.format(new Date(date))}
                </time>
              );
            }
            if (i % 3 !== 0) return null;
            return (
              <time
                key={date}
                dateTime={date}
                className="absolute top-2 hidden -translate-x-1/2 whitespace-nowrap sm:inline"
                style={{ left: `${i * 100 / (daily.length - 1)}%` }}
              >
                {dayLabel.format(new Date(date))}
              </time>
            );
          })}
        </div>
        {total === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center">
            No payments settled in this period.
          </p>
        )}
      </figure>
      <p className="flex items-center gap-2 text-xs text-[var(--chart-text)]">
        <span aria-hidden className="h-px w-4 bg-[var(--chart-line)]" /> Settled payments per day · UTC
      </p>
    </section>
  );
}
