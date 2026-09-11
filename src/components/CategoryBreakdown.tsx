import { useState } from "react";
import type { Breakdown } from "../utils/analytics";
import { money } from "../utils/finance";
export default function CategoryBreakdown({
  title,
  items,
  currency,
  income = false,
  onInspect,
}: {
  title: string;
  items: Breakdown[];
  currency: string;
  income?: boolean;
  onInspect: (id: string) => void;
}) {
  const [mode, setMode] = useState<"donut" | "bar">(income ? "bar" : "donut");
  const [all, setAll] = useState(false);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const gradient = items
    .map((item, i) => {
      const start = items.slice(0, i).reduce((sum, c) => sum + c.percentage, 0);
      return `${item.color} ${start}% ${start + item.percentage}%`;
    })
    .join(",");
  return (
    <section className="card analytics-chart">
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          <p>
            {income
              ? "Where your income comes from."
              : "Where your money goes."}
          </p>
        </div>
        <div className="chart-switch" aria-label={`${title} chart type`}>
          {(["donut", "bar"] as const).map((type) => (
            <button
              key={type}
              aria-pressed={mode === type}
              onClick={() => setMode(type)}
            >
              {type === "donut" ? "Donut" : "Bar"}
            </button>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="empty">
          <h3>
            {income
              ? "No income during this period."
              : "No expenses during this period."}
          </h3>
          <p>Choose another period or add a transaction.</p>
        </div>
      ) : (
        <div className="analytics-category-content">
          {mode === "donut" && (
            <div
              className="donut"
              role="img"
              aria-label={`${title}: ${items.map((c) => `${c.name}, ${money(c.amount, currency)}, ${c.percentage.toFixed(1)}%`).join("; ")}`}
              style={{ background: `conic-gradient(${gradient})` }}
            >
              <div>
                <span>{income ? "Total income" : "Total spent"}</span>
                <strong>{money(total, currency)}</strong>
                <small>{items.length} categories</small>
              </div>
            </div>
          )}
          <div className="analytics-category-list">
            {items.slice(0, all ? undefined : 5).map((c) => (
              <button
                key={c.id}
                className="category-analysis-row"
                aria-label={`View ${c.name} transactions`}
                onClick={() => onInspect(c.id)}
                title={`${c.name}: ${money(c.amount, currency)} (${c.percentage.toFixed(1)}%)`}
              >
                <span className="category-analysis-name">
                  <i style={{ background: c.color }} />
                  {c.name}
                </span>
                <span className="category-analysis-amount">
                  <strong>{money(c.amount, currency)}</strong>
                  <small>{c.percentage.toFixed(1)}%</small>
                </span>
                {mode === "bar" && (
                  <span className="category-analysis-track" aria-hidden="true">
                    <span
                      style={{ width: `${c.percentage}%`, background: c.color }}
                    />
                  </span>
                )}
              </button>
            ))}
            {items.length > 5 && (
              <button className="text-link" onClick={() => setAll((v) => !v)}>
                {all ? "Show top 5" : `Show all ${items.length} categories`}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
