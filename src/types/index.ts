export type TransactionType = "income" | "expense";
export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon?: number;
}
export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  date: string;
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
