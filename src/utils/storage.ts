import type { AppData } from "../types";
import { freshData } from "../data/defaults";
import { validDate } from "./finance";
export const STORAGE_KEY = "dinero:v1";
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const amount = (v: unknown) =>
  typeof v === "number" &&
  Number.isSafeInteger(v) &&
  v > 0 &&
  v <= 999999999999;
const month = (v: unknown) =>
  typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export function validateData(v: unknown): v is AppData {
  if (
    !record(v) ||
    v.version !== 1 ||
    typeof v.demo !== "boolean" ||
    !Array.isArray(v.categories) ||
    !Array.isArray(v.transactions) ||
    !Array.isArray(v.budgets) ||
    !record(v.settings) ||
    !["PHP", "USD", "EUR", "SGD"].includes(String(v.settings.currency))
  )
    return false;
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const c of v.categories) {
    if (
      !record(c) ||
      typeof c.id !== "string" ||
      !c.id ||
      ids.has(c.id) ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      c.name.length > 50 ||
      !["income", "expense"].includes(String(c.type)) ||
      typeof c.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(c.color)
    )
      return false;
    const name = `${c.type}:${c.name.trim().toLowerCase()}`;
    if (names.has(name)) return false;
    names.add(name);
    ids.add(c.id);
  }
  const tids = new Set();
  let total = 0;
  for (const t of v.transactions) {
    if (
      !record(t) ||
      typeof t.id !== "string" ||
      !t.id ||
      tids.has(t.id) ||
      !amount(t.amount) ||
      !validDate(t.date) ||
      typeof t.note !== "string" ||
      t.note.length > 250 ||
      !v.categories.some((c) => c.id === t.categoryId && c.type === t.type)
    )
      return false;
    total += Number(t.amount);
    if (!Number.isSafeInteger(total)) return false;
    tids.add(t.id);
  }
  const months = new Set();
  for (const b of v.budgets) {
    if (
      !record(b) ||
      !month(b.month) ||
      !amount(b.amount) ||
      months.has(b.month)
    )
      return false;
    months.add(b.month);
  }
  return true;
}
export function loadData(): { data: AppData; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { data: freshData(true), error: "" };
    const data: unknown = JSON.parse(raw);
    if (!validateData(data)) throw new Error();
    return { data, error: "" };
  } catch {
    return {
      data: freshData(),
      error:
        "Saved data could not be loaded. Your original storage has been left untouched. Import a backup or make a change to start fresh.",
    };
  }
}
