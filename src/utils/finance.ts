import type { Transaction } from "../types";
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function currentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function validTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T12:00:00`);
  return (
    !isNaN(d.getTime()) &&
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` ===
      value
  );
}
export function parseAmount(value: string) {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return amount > 0 && Number.isSafeInteger(amount) ? amount : null;
}
export function totals(transactions: Transaction[]) {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const borrowed = transactions
    .filter((t) => t.type === "debt_borrowed")
    .reduce((s, t) => s + t.amount, 0);
  const lent = transactions
    .filter((t) => t.type === "debt_lent")
    .reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense + borrowed - lent };
}
export function dailyTotals(transactions: Transaction[], month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const length = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    monthNumber - 1
  ];
  const days = Array.from({ length }, (_, index) => ({
    date: `${month}-${String(index + 1).padStart(2, "0")}`,
    income: 0,
    expense: 0,
  }));
  for (const transaction of transactions) {
    if (!transaction.date.startsWith(`${month}-`)) continue;
    const day = days[Number(transaction.date.slice(8, 10)) - 1];
    if (day && (transaction.type === "income" || transaction.type === "expense"))
      day[transaction.type] += transaction.amount;
  }
  return days;
}
export const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100);
export const monthLabel = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const timeLabel = (time: string) =>
  new Date(`1970-01-01T${time}:00`).toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
  });
export const dateTimeLabel = (date: string, time?: string) =>
  time && validTime(time) ? `${dateLabel(date)} · ${timeLabel(time)}` : dateLabel(date);
