import type { AppData } from "../types";
import { validateData, STORAGE_KEY } from "../utils/storage";
export interface CloudSnapshot {
  data: AppData;
  revision: number;
  imports: string[];
}
export function mapSnapshot(value: unknown): CloudSnapshot {
  const v = value as Partial<CloudSnapshot> | null;
  if (
    !v ||
    !validateData(v.data) ||
    !Number.isSafeInteger(v.revision) ||
    Number(v.revision) < 0 ||
    !Array.isArray(v.imports) ||
    !v.imports.every((i) => typeof i === "string")
  )
    throw new Error(
      "The cloud response is invalid. No local backup was changed.",
    );
  return v as CloudSnapshot;
}
/** Remap legacy/string IDs and exported account IDs without changing relationships. */
export function prepareImport(source: AppData): AppData {
  if (!validateData(source))
    throw new Error("Invalid backup. Nothing was imported.");
  const ids = new Map(
    source.categories.map((c) => [c.id, crypto.randomUUID()]),
  );
  return {
    ...source,
    settings: { ...source.settings },
    budgets: source.budgets.map((b) => ({ ...b })),
    categories: source.categories.map((c) => ({
      ...c,
      id: ids.get(c.id)!,
      icon:
        c.icon ??
        (/^expense-[0-5]$/.test(c.id) ? Number(c.id.slice(-1)) : undefined),
    })),
    transactions: source.transactions.map((t) => ({
      ...t,
      id: crypto.randomUUID(),
      ...(t.categoryId ? { categoryId: ids.get(t.categoryId)! } : {}),
    })),
  };
}
export function readLegacy(): { data: AppData | null; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { data: null, error: "" };
    const parsed: unknown = JSON.parse(raw);
    if (!validateData(parsed)) throw new Error();
    return { data: parsed, error: "" };
  } catch {
    return {
      data: null,
      error:
        "The existing local backup is unavailable or malformed. It has not been changed.",
    };
  }
}
export async function fingerprint(data: AppData) {
  // Stable across JSON formatting and array order; preserves legacy IDs for duplicate detection.
  const canonical = {
    version: 1,
    demo: data.demo,
    categories: [...data.categories]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => [c.id, c.name, c.type, c.color, c.icon ?? null]),
    transactions: [...data.transactions]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => [t.id, t.type, t.amount, t.categoryId ?? null, t.date, t.time ?? null, t.note]),
    budgets: [...data.budgets]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((b) => [b.month, b.amount]),
    currency: data.settings.currency,
  };
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical)),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function cloudError(error: unknown): string {
  const e = error as { message?: string; code?: string };
  if (e?.message?.includes("revision_conflict"))
    return "This workspace changed in another tab or device. Reload cloud data before trying again.";
  if (e?.message?.includes("already_imported"))
    return "This exact backup was already imported into this account. It was not imported again.";
  return (
    e?.message ||
    "Could not reach Supabase. Check your connection and retry. No save has been confirmed."
  );
}
