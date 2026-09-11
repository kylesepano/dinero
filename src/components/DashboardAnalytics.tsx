import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  ChartNoAxesCombined,
  Leaf,
} from "lucide-react";
import type { AppData } from "../types";
import {
  monthEnd,
  calculateCategoryBreakdown,
  calculateIncomeBreakdown,
  calculatePeriodComparison,
  calculatePeriodSummary,
  calculatePreviousPeriod,
  dayCount,
  filterTransactionsByDateRange,
  generateFinancialInsights,
  groupTransactions,
  spendingExtremes,
  type AnalyticsRange,
  type DateRange,
  type Grouping,
} from "../utils/analytics";
import { dateLabel, money, monthLabel, today } from "../utils/finance";
import TimeSeriesChart from "./TimeSeriesChart";
import CategoryBreakdown from "./CategoryBreakdown";

export default function DashboardAnalytics({
  data,
  range,
  grouping,
  onGrouping,
  onInspect,
  onBudget,
  recent,
}: {
  data: AppData;
  range: AnalyticsRange;
  grouping: Grouping;
  onGrouping: (g: Grouping) => void;
  onInspect: (range: DateRange, category?: string, type?: string) => void;
  onBudget: (month: string) => void;
  recent: ReactNode;
}) {
  const analysis = useMemo(() => {
    const transactions = filterTransactionsByDateRange(
      data.transactions,
      range,
    );
    const summary = calculatePeriodSummary(transactions, range);
    const previousRange = calculatePreviousPeriod(range);
    const previous = calculatePeriodSummary(data.transactions, previousRange);
    const expenses = calculateCategoryBreakdown(transactions, data.categories);
    const income = calculateIncomeBreakdown(transactions, data.categories);
    const daily = groupTransactions(transactions, range, "day");
    const extremes = spendingExtremes(daily);
    const trend =
      grouping === "day"
        ? daily
        : groupTransactions(transactions, range, grouping);
    const spendingGrouping = dayCount(range) <= 31 ? "day" : grouping;
    const spending = spendingGrouping === "day" ? daily : trend;
    return {
      summary,
      previousRange,
      previous,
      expenses,
      income,
      extremes,
      trend,
      spending,
      spendingGrouping,
      insights: generateFinancialInsights(
        summary,
        previous,
        expenses,
        extremes,
        data.settings.currency,
      ),
    };
  }, [data, range, grouping]);
  const format = (amount: number) => money(amount, data.settings.currency);
  const budgetMonth =
    range.start.slice(0, 7) === range.end.slice(0, 7)
      ? range.start.slice(0, 7)
      : null;
  const budget = data.budgets.find((b) => b.month === budgetMonth)?.amount || 0;
  const budgetEnd = budgetMonth
    ? monthEnd(budgetMonth) < today()
      ? monthEnd(budgetMonth)
      : today()
    : today();
  const monthSpent = budgetMonth
    ? calculatePeriodSummary(data.transactions, { start: `${budgetMonth}-01`, end: budgetEnd }).expense
    : 0;
  const used = budget ? Math.round((monthSpent / budget) * 100) : 0;
  const [comparison, setComparison] = useState(true);
  return (
    <>
      <div className="analytics-toolbar">
        <label>
          Group by
          <select
            aria-label="Group chart data by"
            value={grouping}
            onChange={(e) => onGrouping(e.target.value as Grouping)}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <label className="comparison-toggle">
          <input
            type="checkbox"
            checked={comparison}
            onChange={(e) => setComparison(e.target.checked)}
          />
          Compare with previous period
        </label>
      </div>
      {comparison && (
        <p className="comparison-caption">
          Comparison: {dateLabel(analysis.previousRange.start)} –{" "}
          {dateLabel(analysis.previousRange.end)}. Current week, month, and year
          compare equivalent elapsed calendar periods; other custom/rolling
          ranges compare the immediately preceding same number of days.
          {analysis.previous.count === 0 &&
            " No transactions in the comparison period."}
        </p>
      )}
      <div className="stats-grid">
        {[
          {
            name: "Total income",
            value: analysis.summary.income,
            previous: analysis.previous.income,
            icon: ArrowDownLeft,
            style: "income",
            subtitle: "Income in the selected period",
          },
          {
            name: "Total expenses",
            value: analysis.summary.expense,
            previous: analysis.previous.expense,
            icon: ArrowUpRight,
            style: "expense",
            subtitle: "Expenses in the selected period",
          },
          {
            name: "Net balance",
            value: analysis.summary.balance,
            previous: analysis.previous.balance,
            icon: Wallet,
            style: "balance",
            subtitle: "Income minus expenses",
          },
          {
            name: "Average spending",
            value: analysis.summary.average,
            previous: null,
            icon: ChartNoAxesCombined,
            style: "budget",
            subtitle: `Per day across ${dayCount(range)} elapsed days`,
          },
        ].map((card) => {
          const diff =
            card.previous === null
              ? null
              : calculatePeriodComparison(card.value, card.previous);
          return (
            <section className={`stat-card ${card.style}`} key={card.name}>
              <div className="stat-top">
                <span>{card.name}</span>
                <span className="stat-icon">
                  <card.icon size={19} />
                </span>
              </div>
              <strong className="stat-value">{format(card.value)}</strong>
              <small>{card.subtitle}</small>
              {comparison && diff && (
                <p className="stat-comparison">
                  {diff.difference > 0 ? "+" : diff.difference < 0 ? "−" : ""}
                  {format(Math.abs(diff.difference))} ·{" "}
                  {diff.percentage === null
                    ? "No percentage baseline"
                    : `${diff.percentage > 0 ? "+" : ""}${diff.percentage.toFixed(1)}%`}
                  <small>vs comparison period</small>
                </p>
              )}
            </section>
          );
        })}
      </div>
      <div className="analytics-grid">
        <TimeSeriesChart
          key={`trend-${range.start}-${range.end}-${grouping}`}
          title="Income vs expenses"
          subtitle="Follow your money over the selected period."
          buckets={analysis.trend}
          grouping={grouping}
          currency={data.settings.currency}
          onInspect={(r) => onInspect(r)}
        />
        <CategoryBreakdown
          title="Spending by category"
          items={analysis.expenses}
          currency={data.settings.currency}
          onInspect={(id) => onInspect(range, id, "expense")}
        />
        <div>
          <TimeSeriesChart
            key={`spending-${range.start}-${range.end}-${analysis.spendingGrouping}`}
            title="Spending over time"
            subtitle={
              analysis.spendingGrouping === "day"
                ? "Daily expenses, including days with no spending."
                : `Expenses grouped by ${analysis.spendingGrouping}.`
            }
            buckets={analysis.spending}
            grouping={analysis.spendingGrouping as Grouping}
            currency={data.settings.currency}
            expensesOnly
            onInspect={(r) => onInspect(r, undefined, "expense")}
          />
          <div className="spending-facts">
            {analysis.extremes.highest && (
              <p>
                Highest day{" "}
                <strong>
                  {dateLabel(analysis.extremes.highest.start)} ·{" "}
                  {format(analysis.extremes.highest.expense)}
                </strong>
              </p>
            )}
            {analysis.extremes.lowest && (
              <p>
                Lowest active day{" "}
                <strong>
                  {dateLabel(analysis.extremes.lowest.start)} ·{" "}
                  {format(analysis.extremes.lowest.expense)}
                </strong>
              </p>
            )}
            <p>
              Daily average <strong>{format(analysis.summary.average)}</strong>
            </p>
          </div>
        </div>
        <CategoryBreakdown
          title="Income sources"
          items={analysis.income}
          currency={data.settings.currency}
          income
          onInspect={(id) => onInspect(range, id, "income")}
        />
        <section className="card analytics-chart">
          <div className="card-heading">
            <div>
              <h2>Top spending categories</h2>
              <p>Your top five categories in this period.</p>
            </div>
          </div>
          <ol className="ranked-categories">
            {analysis.expenses.slice(0, 5).map((c) => (
              <li key={c.id}>
                <button onClick={() => onInspect(range, c.id, "expense")}>
                  <span>{c.name}</span>
                  <strong>
                    {format(c.amount)} <small>{c.percentage.toFixed(1)}%</small>
                  </strong>
                </button>
              </li>
            ))}
          </ol>
          {!analysis.expenses.length && (
            <p className="empty">No expenses during this period.</p>
          )}
          <button
            className="text-link analytics-card-link"
            onClick={() => onInspect(range, undefined, "expense")}
          >
            Inspect all expense transactions
          </button>
        </section>
        <section className="card analytics-chart">
          <div className="card-heading">
            <div>
              <h2>Insights</h2>
              <p>Based on your recorded transactions.</p>
            </div>
            <Leaf size={20} />
          </div>
          {analysis.insights.length ? (
            <ul className="financial-insights">
              {analysis.insights
                .filter(
                  (text) => comparison || !text.includes("comparison period"),
                )
                .map((text) => (
                  <li key={text}>{text}</li>
                ))}
              {budget > 0 && (
                <li>
                  You have spent {used}% of your {monthLabel(budgetMonth!)}{" "}
                  monthly budget.
                </li>
              )}
            </ul>
          ) : (
            <div className="empty">
              <p>Add transactions to see spending insights for this period.</p>
            </div>
          )}
        </section>
      </div>
      {budgetMonth && (
        <section className="card analytics-month-budget">
          <div>
            <h2>{monthLabel(budgetMonth)} budget</h2>
            <p>
              Whole-month spending through {dateLabel(budgetEnd)}; separate from
              shorter analytics ranges.
            </p>
            <strong>
              {format(monthSpent)} spent
              {budget
                ? ` · ${format(budget - monthSpent)} remaining of ${format(budget)}`
                : " · No budget set"}
            </strong>
            {budget > 0 && (
              <>
                <div
                  className={`progress ${used >= 100 ? "over" : ""}`}
                  role="progressbar"
                  aria-label="Monthly budget spent"
                  aria-valuenow={Math.min(used, 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${Math.min(used, 100)}%` }} />
                </div>
                <p>
                  {used >= 100
                    ? "You have reached or exceeded this monthly budget."
                    : used >= 80
                      ? "You are approaching this monthly budget."
                      : "Spending is within this monthly budget."}
                </p>
              </>
            )}
          </div>
          <button
            className="button secondary"
            onClick={() => onBudget(budgetMonth)}
          >
            Manage budget
          </button>
        </section>
      )}
      {recent}
    </>
  );
}
