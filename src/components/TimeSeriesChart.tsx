import { useEffect, useId, useRef, useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import type { Bucket, DateRange, Grouping } from "../utils/analytics";
import { dateLabel, money } from "../utils/finance";

export default function TimeSeriesChart({
  title,
  subtitle,
  buckets,
  grouping,
  currency,
  expensesOnly = false,
  onInspect,
}: {
  title: string;
  subtitle: string;
  buckets: Bucket[];
  grouping: Grouping;
  currency: string;
  expensesOnly?: boolean;
  onInspect: (range: DateRange) => void;
}) {
  const [mode, setMode] = useState<"bar" | "line">("bar");
  const [selected, setSelected] = useState(0);
  const [width, setWidth] = useState(600);
  const container = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(220, entries[0].contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const format = (amount: number) => money(amount, currency);
  const maximum = Math.max(
    0,
    ...buckets.map((b) => Math.max(b.expense, expensesOnly ? 0 : b.income)),
  );
  const magnitude = maximum ? 10 ** Math.floor(Math.log10(maximum)) : 100;
  const scale = Math.ceil((maximum || 100) / magnitude) * magnitude;
  const left = width < 380 ? 60 : 78;
  const plot = width - left - 14;
  const step = plot / Math.max(1, buckets.length);
  const barWidth = Math.min(18, step * (expensesOnly ? 0.65 : 0.32));
  const x = (index: number) => left + step * (index + 0.5);
  const y = (amount: number) => 206 - (amount / scale) * 170;
  const current = buckets[Math.min(selected, buckets.length - 1)];
  const interval = (b: Bucket) =>
    b.start === b.end
      ? dateLabel(b.start)
      : `${dateLabel(b.start)} – ${dateLabel(b.end)}`;
  const label = (b: Bucket) =>
    new Date(`${b.start}T12:00:00`).toLocaleDateString(
      "en",
      grouping === "month"
        ? { month: "short", year: "2-digit" }
        : { month: "short", day: "numeric" },
    );
  const tickEvery = Math.max(
    1,
    Math.ceil(buckets.length / (width < 450 ? 3 : 6)),
  );
  const axis = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount / 100);
  return (
    <section className="card analytics-chart" aria-labelledby={`${id}-title`}>
      <div className="card-heading">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="chart-switch" aria-label={`${title} chart type`}>
          {(["bar", "line"] as const).map((type) => (
            <button
              key={type}
              aria-pressed={mode === type}
              onClick={() => setMode(type)}
            >
              {type === "bar" ? "Bar" : "Line"}
            </button>
          ))}
        </div>
      </div>
      <div className="analytics-chart-body" ref={container}>
        {maximum === 0 ? (
          <div className="empty">
            <ChartNoAxesCombined size={30} />
            <h3>
              {expensesOnly
                ? "No expenses during this period."
                : "No activity during this period."}
            </h3>
            <p>Add a transaction or choose another date range to see trends.</p>
          </div>
        ) : (
          <>
            <div className="daily-legend">
              {!expensesOnly && (
                <span>
                  <i className="daily-income" />
                  Income
                </span>
              )}
              <span>
                <i className="daily-expense" />
                Expenses
              </span>
            </div>
            <svg
              className="analytics-svg"
              viewBox={`0 0 ${width} 248`}
              width="100%"
              role="group"
              aria-label={`${title}: ${grouping} intervals`}
            >
              {[0, 0.5, 1].map((ratio) => (
                <g key={ratio}>
                  <line
                    x1={left}
                    x2={width - 12}
                    y1={y(scale * ratio)}
                    y2={y(scale * ratio)}
                    stroke="#e2e8e3"
                  />
                  <text
                    x={left - 8}
                    y={y(scale * ratio) + 5}
                    textAnchor="end"
                    className="chart-axis-text"
                  >
                    {axis(scale * ratio)}
                  </text>
                </g>
              ))}
              {mode === "line" && (
                <>
                  {!expensesOnly && (
                    <polyline
                      points={buckets
                        .map((b, i) => `${x(i)},${y(b.income)}`)
                        .join(" ")}
                      fill="none"
                      stroke="#26876b"
                      strokeWidth="2.5"
                    />
                  )}
                  <polyline
                    points={buckets
                      .map((b, i) => `${x(i)},${y(b.expense)}`)
                      .join(" ")}
                    fill="none"
                    stroke="#d18b75"
                    strokeWidth="2.5"
                  />
                </>
              )}
              {buckets.map((b, i) => (
                <g
                  key={b.key}
                  id={`${id}-${i}`}
                  role="button"
                  tabIndex={i === selected ? 0 : -1}
                  aria-label={`${interval(b)}: ${!expensesOnly ? `income ${format(b.income)}, ` : ""}expenses ${format(b.expense)}. Open transactions.`}
                  onMouseEnter={() => setSelected(i)}
                  onFocus={() => setSelected(i)}
                  onClick={() => onInspect(b)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onInspect(b);
                    } else if (
                      ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    ) {
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? buckets.length - 1
                            : Math.max(
                                0,
                                Math.min(
                                  buckets.length - 1,
                                  i + (event.key === "ArrowRight" ? 1 : -1),
                                ),
                              );
                      setSelected(next);
                      document.getElementById(`${id}-${next}`)?.focus();
                    }
                  }}
                >
                  <title>
                    {interval(b)} ·{" "}
                    {expensesOnly ? "" : `Income ${format(b.income)} · `}
                    Expenses {format(b.expense)}
                  </title>
                  <rect
                    x={left + step * i}
                    y={28}
                    width={step}
                    height={184}
                    fill={i === selected ? "#26876b0d" : "transparent"}
                  />
                  {mode === "bar" ? (
                    <>
                      {!expensesOnly && (
                        <rect
                          x={x(i) - barWidth - 1}
                          y={y(b.income)}
                          width={barWidth}
                          height={206 - y(b.income)}
                          rx="2"
                          fill="#26876b"
                        />
                      )}
                      <rect
                        x={expensesOnly ? x(i) - barWidth / 2 : x(i) + 1}
                        y={y(b.expense)}
                        width={barWidth}
                        height={206 - y(b.expense)}
                        rx="2"
                        fill="#d18b75"
                      />
                    </>
                  ) : (
                    <>
                      {!expensesOnly && (
                        <circle
                          cx={x(i)}
                          cy={y(b.income)}
                          r={buckets.length > 60 && i !== selected ? 0 : 3.5}
                          fill="#26876b"
                        />
                      )}
                      <circle
                        cx={x(i)}
                        cy={y(b.expense)}
                        r={buckets.length > 60 && i !== selected ? 0 : 3.5}
                        fill="#d18b75"
                      />
                    </>
                  )}
                  {i % tickEvery === 0 && (
                    <text
                      x={x(i)}
                      y={234}
                      textAnchor="middle"
                      className="chart-axis-text"
                    >
                      {label(b)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
            <div className="chart-detail">
              <label>
                Inspect interval
                <select
                  aria-label={`${title} interval`}
                  value={selected}
                  onChange={(e) => setSelected(Number(e.target.value))}
                >
                  {buckets.map((b, i) => (
                    <option value={i} key={b.key}>
                      {interval(b)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="chart-exact" role="status" aria-live="polite">
                {!expensesOnly && (
                  <span>
                    Income <strong>{format(current.income)}</strong>
                  </span>
                )}
                <span>
                  Expenses <strong>{format(current.expense)}</strong>
                </span>
              </div>
              <button className="text-link" onClick={() => onInspect(current)}>
                View transactions
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
