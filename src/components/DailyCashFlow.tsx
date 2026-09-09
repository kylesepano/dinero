import { useId, useState } from "react";
import {
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Transaction } from "../types";
import {
  dailyTotals,
  dateLabel,
  money,
  monthLabel,
  today,
} from "../utils/finance";

export default function DailyCashFlow({
  transactions,
  month,
  currency,
}: {
  transactions: Transaction[];
  month: string;
  currency: string;
}) {
  const days = dailyTotals(transactions, month);
  const [selected, setSelected] = useState(
    month === today().slice(0, 7) ? Number(today().slice(8)) - 1 : 0,
  );
  const id = useId();
  const maximum = Math.max(...days.flatMap((day) => [day.income, day.expense]));
  const scale = maximum || 100;
  const current = days[selected];
  const format = (amount: number) => money(amount, currency);
  const axis = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount / 100);
  function selectDay(index: number, focus = false) {
    const next = Math.max(0, Math.min(days.length - 1, index));
    setSelected(next);
    if (focus)
      document.getElementById(`${id}-${next}`)?.focus({ preventScroll: false });
  }

  return (
    <section className="card daily-cash-flow" aria-labelledby={`${id}-heading`}>
      <div className="card-heading">
        <div>
          <h2 id={`${id}-heading`}>Daily income &amp; expenses</h2>
          <p>Compare money in and money out each day of {monthLabel(month)}.</p>
        </div>
        <div className="daily-legend">
          <span>
            <i className="daily-income" />
            Income
          </span>
          <span>
            <i className="daily-expense" />
            Expenses
          </span>
        </div>
      </div>
      {maximum === 0 ? (
        <div className="empty">
          <ChartNoAxesColumnIncreasing size={30} />
          <h3>No activity this month</h3>
          <p>
            Your daily comparison will appear when you record income or
            expenses.
          </p>
        </div>
      ) : (
        <>
          <p className="daily-chart-hint" id={`${id}-hint`}>
            Select a day for exact amounts. Use arrow keys to move between days.
            Scroll the chart on smaller screens.
          </p>
          <div
            className="daily-chart-scroll"
            role="region"
            aria-label="Daily income and expense bar chart"
            aria-describedby={`${id}-hint`}
          >
            <div className="daily-chart-layout">
              <div className="daily-axis" aria-hidden="true">
                <span>{axis(scale)}</span>
                <span>{axis(scale / 2)}</span>
                <span>{axis(0)}</span>
              </div>
              <div
                className="daily-bars"
                style={{
                  gridTemplateColumns: `repeat(${days.length}, minmax(22px, 1fr))`,
                }}
              >
                {days.map((day, index) => (
                  <button
                    key={day.date}
                    id={`${id}-${index}`}
                    type="button"
                    className={`daily-day ${index === selected ? "selected" : ""}`}
                    aria-label={`${dateLabel(day.date)}: income ${format(day.income)}, expenses ${format(day.expense)}`}
                    aria-pressed={index === selected}
                    tabIndex={index === selected ? 0 : -1}
                    title={`${dateLabel(day.date)} · Income ${format(day.income)} · Expenses ${format(day.expense)}`}
                    onClick={() => selectDay(index)}
                    onFocus={() => selectDay(index)}
                    onKeyDown={(event) => {
                      if (
                        !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          event.key,
                        )
                      )
                        return;
                      event.preventDefault();
                      selectDay(
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? days.length - 1
                            : index + (event.key === "ArrowRight" ? 1 : -1),
                        true,
                      );
                    }}
                  >
                    <span className="daily-bar-pair" aria-hidden="true">
                      <span
                        className="daily-income"
                        style={{
                          height: `${(day.income / scale) * 100}%`,
                          minHeight: day.income ? 2 : 0,
                        }}
                      />
                      <span
                        className="daily-expense"
                        style={{
                          height: `${(day.expense / scale) * 100}%`,
                          minHeight: day.expense ? 2 : 0,
                        }}
                      />
                    </span>
                    <span className="daily-day-label" aria-hidden="true">
                      {index + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="daily-detail">
            <div className="daily-day-controls">
              <button
                className="icon-button"
                aria-label="Previous day"
                disabled={selected === 0}
                onClick={() => selectDay(selected - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <strong>{dateLabel(current.date)}</strong>
              <button
                className="icon-button"
                aria-label="Next day"
                disabled={selected === days.length - 1}
                onClick={() => selectDay(selected + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div
              className="daily-detail-values"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span>
                Income <strong>{format(current.income)}</strong>
              </span>
              <span>
                Expenses <strong>{format(current.expense)}</strong>
              </span>
              <span>
                Net <strong>{format(current.income - current.expense)}</strong>
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
