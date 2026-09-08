import type { AppData, Category } from "../types";
import { today } from "../utils/finance";
export const colors = [
  "#26876b",
  "#76a897",
  "#e4b66b",
  "#819aca",
  "#ba8ca5",
  "#b0b88a",
  "#d18b75",
  "#77828a",
];
export const categories: Category[] = [
  { id: "salary", name: "Salary", type: "income", color: colors[0] },
  { id: "freelance", name: "Freelance", type: "income", color: colors[1] },
  ...[
    "Food & dining",
    "Shopping",
    "Transportation",
    "Bills & utilities",
    "Entertainment",
    "Health",
  ].map((name, i) => ({
    id: `expense-${i}`,
    name,
    type: "expense" as const,
    color: colors[i],
  })),
];
export function freshData(demo = false): AppData {
  const month = today().slice(0, 7);
  return {
    version: 1,
    demo,
    categories: categories.map((c) => ({ ...c })),
    settings: { currency: "PHP" },
    budgets: demo ? [{ month, amount: 2500000 }] : [],
    transactions: demo
      ? [
          {
            id: "demo-1",
            type: "income",
            amount: 5500000,
            categoryId: "salary",
            date: `${month}-01`,
            note: "Monthly salary",
          },
          {
            id: "demo-2",
            type: "income",
            amount: 850000,
            categoryId: "freelance",
            date: `${month}-03`,
            note: "Website design project",
          },
          ...[
            { amount: 245000, c: 0, n: "Weekly groceries", d: "07" },
            { amount: 189900, c: 1, n: "A little wardrobe refresh", d: "06" },
            { amount: 85000, c: 2, n: "Fuel & daily commutes", d: "05" },
            { amount: 420000, c: 3, n: "Electricity & internet", d: "04" },
            { amount: 79900, c: 4, n: "Movie night & subscriptions", d: "03" },
            { amount: 125000, c: 0, n: "Coffee & lunches", d: "02" },
            { amount: 65000, c: 5, n: "Vitamins & essentials", d: "02" },
          ].map((t, i) => ({
            id: `demo-${i + 3}`,
            type: "expense" as const,
            amount: t.amount,
            categoryId: `expense-${t.c}`,
            date: `${month}-${t.d}`,
            note: t.n,
          })),
        ]
      : [],
  };
}
