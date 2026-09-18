import type { Category, Transaction } from "../types";
import { dateLabel, money, today, totals, validDate } from "./finance";

export type Preset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom";
export type Grouping = "day" | "week" | "month";
export interface DateRange {
  start: string;
  end: string;
}
export interface AnalyticsRange extends DateRange {
  preset: Preset;
}
export interface Bucket extends DateRange {
  key: string;
  income: number;
  expense: number;
  count: number;
}
export interface Breakdown {
  id: string;
  name: string;
  color: string;
  amount: number;
  percentage: number;
}
export const presets: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisWeek", label: "This week" },
  { value: "lastWeek", label: "Last week" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisYear", label: "This year" },
  { value: "custom", label: "Custom range" },
];
// UTC is used only as a calendar-arithmetic container; persisted dates remain strings.
const calendar = (date: string) => new Date(`${date}T00:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
export function addDays(date: string, amount: number) {
  const d = calendar(date);
  d.setUTCDate(d.getUTCDate() + amount);
  return iso(d);
}
export function dayCount(range: DateRange) {
  return Math.max(
    0,
    Math.round(
      (calendar(range.end).getTime() - calendar(range.start).getTime()) /
        86400000,
    ) + 1,
  );
}
export const weekStart = (date: string) =>
  addDays(date, -((calendar(date).getUTCDay() + 6) % 7));
export function monthEnd(month: string) {
  const d = calendar(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return iso(d);
}
function shiftMonth(date: string, offset: number) {
  const d = calendar(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  const last = new Date(d);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  d.setUTCDate(Math.min(day, last.getUTCDate()));
  return iso(d);
}
export function presetRange(
  preset: Preset,
  reference = today(),
): AnalyticsRange {
  let start = reference;
  let end = reference;
  if (preset === "yesterday") start = end = addDays(reference, -1);
  if (preset === "last7" || preset === "last30")
    start = addDays(reference, preset === "last7" ? -6 : -29);
  if (preset === "thisWeek") start = weekStart(reference);
  if (preset === "lastWeek") {
    start = addDays(weekStart(reference), -7);
    end = addDays(start, 6);
  }
  if (preset === "thisMonth") start = `${reference.slice(0, 7)}-01`;
  if (preset === "lastMonth") {
    end = addDays(`${reference.slice(0, 7)}-01`, -1);
    start = `${end.slice(0, 7)}-01`;
  }
  if (preset === "thisYear") start = `${reference.slice(0, 4)}-01-01`;
  return { start, end, preset };
}
export function validateRange(range: DateRange, reference = today()) {
  if (!validDate(range.start) || !validDate(range.end))
    return "Enter valid start and end dates.";
  if (range.start > range.end)
    return "Start date must be on or before end date.";
  if (range.end > reference) return "Choose an end date on or before today.";
  if (range.start < "0100-01-01")
    return "Choose a start date in year 0100 or later.";
  if (dayCount(range) > 3660) return "Choose a range of 10 years or less.";
  return "";
}
export function defaultGrouping(range: DateRange): Grouping {
  const days = dayCount(range);
  return days > 90 ? "month" : days > 31 ? "week" : "day";
}
export function calculatePreviousPeriod(range: AnalyticsRange): DateRange {
  if (range.preset === "thisMonth")
    return {
      start: shiftMonth(range.start, -1),
      end: shiftMonth(range.end, -1),
    };
  if (range.preset === "lastMonth") {
    const end = addDays(range.start, -1);
    return { start: `${end.slice(0, 7)}-01`, end };
  }
  if (range.preset === "thisYear")
    return {
      start: shiftMonth(range.start, -12),
      end: shiftMonth(range.end, -12),
    };
  if (range.preset === "thisWeek")
    return { start: addDays(range.start, -7), end: addDays(range.end, -7) };
  return {
    start: addDays(range.start, -dayCount(range)),
    end: addDays(range.start, -1),
  };
}
export function filterTransactionsByDateRange(
  transactions: Transaction[],
  range: DateRange,
) {
  return transactions.filter(
    (t) => t.date >= range.start && t.date <= range.end,
  );
}
export function calculateDailyAverage(
  transactions: Transaction[],
  range: DateRange,
  reference = today(),
) {
  const elapsed = {
    start: range.start,
    end: range.end < reference ? range.end : reference,
  };
  const days = dayCount(elapsed);
  return days
    ? Math.round(
        totals(filterTransactionsByDateRange(transactions, elapsed)).expense /
          days,
      )
    : 0;
}
export function calculatePeriodSummary(
  transactions: Transaction[],
  range: DateRange,
  reference = today(),
) {
  const filtered = filterTransactionsByDateRange(transactions, range);
  return {
    ...totals(filtered),
    average: calculateDailyAverage(filtered, range, reference),
    count: filtered.length,
  };
}
export function calculateCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: "income" | "expense" = "expense",
): Breakdown[] {
  const values = new Map<string, number>();
  let total = 0;
  for (const t of transactions)
    if (t.type === type) {
      total += t.amount;
      values.set(t.categoryId!, (values.get(t.categoryId!) || 0) + t.amount);
    }
  return categories
    .filter((c) => values.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      amount: values.get(c.id)!,
      percentage: total ? (values.get(c.id)! / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}
export const calculateIncomeBreakdown = (
  transactions: Transaction[],
  categories: Category[],
) => calculateCategoryBreakdown(transactions, categories, "income");
export function groupTransactions(
  transactions: Transaction[],
  range: DateRange,
  grouping: Grouping,
): Bucket[] {
  const buckets = new Map<string, Bucket>();
  const keyFor = (date: string) =>
    grouping === "day"
      ? date
      : grouping === "week"
        ? weekStart(date)
        : `${date.slice(0, 7)}-01`;
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    const key = keyFor(date);
    const bucket = buckets.get(key);
    if (bucket) bucket.end = date;
    else
      buckets.set(key, {
        key,
        start: date,
        end: date,
        income: 0,
        expense: 0,
        count: 0,
      });
  }
  for (const t of transactions)
    if (t.date >= range.start && t.date <= range.end) {
      const bucket = buckets.get(keyFor(t.date))!;
      if (t.type === "income" || t.type === "expense") {
        bucket[t.type] += t.amount;
        bucket.count++;
      }
    }
  return [...buckets.values()];
}
export const groupTransactionsByDay = (t: Transaction[], r: DateRange) =>
  groupTransactions(t, r, "day");
export const groupTransactionsByWeek = (t: Transaction[], r: DateRange) =>
  groupTransactions(t, r, "week");
export const groupTransactionsByMonth = (t: Transaction[], r: DateRange) =>
  groupTransactions(t, r, "month");
export function calculatePeriodComparison(current: number, previous: number) {
  return {
    difference: current - previous,
    percentage:
      previous === 0
        ? current === 0
          ? 0
          : null
        : ((current - previous) / Math.abs(previous)) * 100,
  };
}
export function spendingExtremes(days: Bucket[]) {
  const active = days.filter((d) => d.expense > 0);
  return {
    highest: active.reduce<Bucket | null>(
      (best, d) => (!best || d.expense > best.expense ? d : best),
      null,
    ),
    lowest: active.reduce<Bucket | null>(
      (best, d) => (!best || d.expense < best.expense ? d : best),
      null,
    ),
  };
}
export function generateFinancialInsights(
  summary: ReturnType<typeof calculatePeriodSummary>,
  previous: ReturnType<typeof calculatePeriodSummary>,
  categories: Breakdown[],
  extremes: ReturnType<typeof spendingExtremes>,
  currency: string,
) {
  const insights: string[] = [];
  if (categories.length)
    insights.push(
      `${categories[0].name} is your largest expense category (${categories[0].percentage.toFixed(1)}% of expenses).`,
    );
  if (extremes.highest)
    insights.push(
      `Your highest-spending day was ${dateLabel(extremes.highest.start)}: ${money(extremes.highest.expense, currency)}.`,
    );
  if (summary.expense)
    insights.push(
      `Average daily spending was ${money(summary.average, currency)}, including days with no expenses.`,
    );
  if (previous.count) {
    const comparison = calculatePeriodComparison(
      summary.expense,
      previous.expense,
    );
    insights.push(
      comparison.difference === 0
        ? "Expenses are unchanged from the comparison period."
        : `Expenses are ${money(Math.abs(comparison.difference), currency)} ${comparison.difference > 0 ? "higher" : "lower"} than the comparison period${comparison.percentage === null ? "" : ` (${Math.abs(comparison.percentage).toFixed(1)}%)`}.`,
    );
  }
  return insights;
}
export interface TransactionFilters extends DateRange {
  type: string;
  categoryId: string;
  min: number | null;
  max: number | null;
  search: string;
  sort: string;
}
export function filterTransactions(
  transactions: Transaction[],
  categories: Category[],
  filter: TransactionFilters,
) {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const query = filter.search.trim().toLowerCase();
  return filterTransactionsByDateRange(transactions, filter)
    .filter(
      (t) =>
        (filter.type === "all" || t.type === filter.type) &&
        (filter.categoryId === "all" || t.categoryId === filter.categoryId) &&
        (filter.min === null || t.amount >= filter.min) &&
        (filter.max === null || t.amount <= filter.max) &&
        `${t.note} ${names.get(t.categoryId || "") || (t.type === "debt_borrowed" ? "Borrowed debt" : t.type === "debt_lent" ? "Lent debt" : t.type === "wallet_add" ? "Wallet adjustment added" : t.type === "wallet_subtract" ? "Wallet adjustment subtracted" : "")}`
          .toLowerCase()
          .includes(query),
    )
    .sort((a, b) => {
      const order =
        filter.sort === "oldest"
          ? `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`)
          : filter.sort === "highest"
            ? b.amount - a.amount
            : filter.sort === "lowest"
              ? a.amount - b.amount
              : `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`);
      return order || a.id.localeCompare(b.id);
    });
}
export function parseFilterAmount(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value.trim())) return NaN;
  const [whole, fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
