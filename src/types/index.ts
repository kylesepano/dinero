export type TransactionType =
  | "income"
  | "expense"
  | "debt_borrowed"
  | "debt_lent"
  | "wallet_add"
  | "wallet_subtract";
export type CategoryType = "income" | "expense";
export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon?: number;
}
export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId?: string;
  date: string;
  /** Local time selected when the transaction was recorded (HH:mm). */
  time?: string;
  note: string;
}
export interface Budget {
  month: string;
  amount: number;
}
export interface Settings {
  currency: "PHP" | "USD" | "EUR" | "SGD";
}
export interface AppData {
  version: 1;
  demo: boolean;
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  settings: Settings;
}
