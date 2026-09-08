import { useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Search,
  Wallet,
  LayoutDashboard,
  ArrowLeftRight,
  Shapes,
  ChartNoAxesCombined,
  Settings,
  ChevronRight,
  ShieldCheck,
  Download,
  Upload,
  Leaf,
  CalendarDays,
  CircleHelp,
  TrendingUp,
  Coffee,
  ShoppingBag,
  Car,
  House,
  Heart,
  Sparkles,
} from "lucide-react";
import type { Category, Transaction, TransactionType } from "./types";
import { useData } from "./hooks/useData";
import { freshData, colors } from "./data/defaults";
import {
  dateLabel,
  money,
  monthLabel,
  parseAmount,
  today,
  totals,
} from "./utils/finance";
import { validateData } from "./utils/storage";
import Modal from "./components/Modal";

type Page = "Dashboard" | "Transactions" | "Categories" | "Budget" | "Settings";
const nav = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Transactions", icon: ArrowLeftRight },
  { name: "Categories", icon: Shapes },
  { name: "Budget", icon: ChartNoAxesCombined },
  { name: "Settings", icon: Settings },
] as const;
const categoryIcons = [Coffee, ShoppingBag, Car, House, Sparkles, Heart];
function CategoryIcon({ category }: { category?: Category }) {
  const Icon = category?.id.startsWith("expense-")
    ? categoryIcons[Number(category.id.split("-")[1])] || Shapes
    : category?.type === "income"
      ? Wallet
      : Shapes;
  return (
    <span
      className="category-icon"
      style={{
        color: category?.color,
        background: `${category?.color || "#26876b"}15`,
      }}
    >
      <Icon size={18} />
    </span>
  );
}

export default function App() {
  const { data, update, error } = useData();
  const [page, setPage] = useState<Page>("Dashboard");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [transaction, setTransaction] = useState<
    Transaction | null | undefined
  >(undefined);
  const [editingCategory, setEditingCategory] = useState<
    Category | null | undefined
  >(undefined);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    action: () => void;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [budgetEditing, setBudgetEditing] = useState(false);
  const fmt = (n: number) => money(n, data.settings.currency);
  const monthly = data.transactions.filter((t) => t.date.startsWith(month));
  const summary = totals(monthly);
  const budget = data.budgets.find((b) => b.month === month)?.amount || 0;
  const percent = budget ? Math.round((summary.expense / budget) * 100) : 0;
  const spending = data.categories
    .filter((c) => c.type === "expense")
    .map((c) => ({
      ...c,
      total: monthly
        .filter((t) => t.categoryId === c.id)
        .reduce((a, t) => a + t.amount, 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const sorted = [...monthly].sort((a, b) =>
    sort === "newest"
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date),
  );
  const filtered = sorted.filter(
    (t) =>
      (type === "all" || t.type === type) &&
      (category === "all" || t.categoryId === category) &&
      `${t.note} ${data.categories.find((c) => c.id === t.categoryId)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const startFresh = () =>
    setConfirmation({
      title: "Start with a clean slate?",
      message:
        "This removes the sample transactions and budget. Your own tracking starts with an empty dashboard.",
      action: () => update(freshData()),
    });
  const removeTransaction = (t: Transaction) =>
    setConfirmation({
      title: "Delete transaction?",
      message: `${t.note || "This transaction"} (${fmt(t.amount)}) will be permanently removed.`,
      action: () =>
        update({
          ...data,
          transactions: data.transactions.filter((x) => x.id !== t.id),
        }),
    });
  const removeCategory = (c: Category) => {
    if (data.transactions.some((t) => t.categoryId === c.id)) {
      setNotice(
        "This category is used by transactions. Reassign or delete those transactions first.",
      );
      return;
    }
    setConfirmation({
      title: "Delete category?",
      message: `Remove “${c.name}” from your categories?`,
      action: () =>
        update({
          ...data,
          categories: data.categories.filter((x) => x.id !== c.id),
        }),
    });
  };
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `dinero-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Your backup has been exported.");
  }
  async function importData(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5000000)
        throw new Error("Please choose a JSON backup smaller than 5 MB.");
      const parsed: unknown = JSON.parse(await file.text());
      if (!validateData(parsed))
        throw new Error(
          "This file is not a valid dinero backup. No data was changed.",
        );
      setConfirmation({
        title: "Restore this backup?",
        message: `Replace current data with ${parsed.transactions.length} transactions, categories, budgets, and preferences from this ${parsed.demo ? "demo" : "personal"} backup?`,
        action: () => {
          update(parsed);
          setNotice("Backup restored successfully.");
        },
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to import this file.");
    }
  }
  function transactionTable(items: Transaction[], limit?: number) {
    return items.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Category</th>
              <th>Date</th>
              <th className="right">Amount</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.slice(0, limit).map((t) => {
              const c = data.categories.find((c) => c.id === t.categoryId);
              return (
                <tr key={t.id}>
                  <td>
                    <div className="transaction-name">
                      <CategoryIcon category={c} />
                      <div>
                        <strong>{t.note || c?.name}</strong>
                        <small>
                          {t.type === "income" ? "Money in" : "Money out"}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge">{c?.name}</span>
                  </td>
                  <td className="muted date-cell">{dateLabel(t.date)}</td>
                  <td
                    className={`right amount ${t.type === "income" ? "positive" : ""}`}
                  >
                    {t.type === "income" ? "+" : "−"}
                    {fmt(t.amount)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Edit ${t.note || c?.name}`}
                        onClick={() => setTransaction(t)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${t.note || c?.name}`}
                        onClick={() => removeTransaction(t)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="empty">
        <Wallet size={30} />
        <h3>No transactions here yet</h3>
        <p>Add a transaction or adjust your filters to get started.</p>
        <button
          className="button secondary"
          onClick={() => setTransaction(null)}
        >
          <Plus size={16} />
          Add transaction
        </button>
      </div>
    );
  }
  function budgetContent() {
    return (
      <>
        <div className="budget-amount">
          <strong>{fmt(summary.expense)}</strong>
          <span> of {fmt(budget)} spent</span>
        </div>
        <div
          className={`progress ${percent >= 100 ? "over" : ""}`}
          role="progressbar"
          aria-label="Monthly budget spent"
          aria-valuenow={Math.min(percent, 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
        <div className="flex justify-between text-sm">
          <span className="muted">{percent}% used</span>
          <strong>
            {fmt(Math.abs(budget - summary.expense))}{" "}
            {summary.expense > budget ? "over budget" : "left"}
          </strong>
        </div>
        <div className={`budget-tip ${percent >= 80 ? "warning" : ""}`}>
          <Leaf size={18} />
          <span>
            {!budget
              ? "Set a budget to give your spending a plan."
              : percent >= 100
                ? "You’ve reached your budget. Review your spending."
                : percent >= 80
                  ? "You’re approaching your budget. Keep an eye on spending."
                  : "Looking good! Your spending is within budget."}
          </span>
        </div>
      </>
    );
  }
  const gradient = spending
    .map((c, i) => {
      const start =
        (spending.slice(0, i).reduce((sum, item) => sum + item.total, 0) /
          summary.expense) *
        100;
      return `${c.color} ${start}% ${start + (c.total / summary.expense) * 100}%`;
    })
    .join(",");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Dashboard");
          }}
        >
          <span className="brand-mark">
            <ChartNoAxesCombined size={24} />
          </span>
          dinero<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() => {
                setPage(name);
                setNotice("");
              }}
              aria-current={page === name ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{name}</span>
              {page === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={24} />
            <strong>Your money. Your space.</strong>
            <p>Private by design. Your data stays right in this browser.</p>
          </div>
          <div className="profile">
            <span className="avatar">P</span>
            <div>
              <strong>Personal account</strong>
              <small>Local workspace</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <span className="local-status">
            <span className="online-dot" /> Stored on this device
          </span>
          <button
            className="icon-button"
            aria-label="About local storage"
            onClick={() => setPage("Settings")}
          >
            <CircleHelp size={19} />
          </button>
          <span className="avatar small">P</span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">A LITTLE CLARITY, EVERY DAY</div>
              <h1>
                {page === "Dashboard"
                  ? "Your money, at a glance."
                  : page === "Budget"
                    ? "Make room for what matters."
                    : page === "Transactions"
                      ? "Every little detail."
                      : page === "Categories"
                        ? "A place for every peso."
                        : "Your space, your preferences."}
              </h1>
              <p>
                {page === "Dashboard"
                  ? "A clear picture of where you stand and where your money goes."
                  : page === "Transactions"
                    ? "Keep your income and expenses organized, all in one place."
                    : page === "Categories"
                      ? "Organize your transactions in a way that makes sense to you."
                      : page === "Budget"
                        ? "Build a spending plan that works for your everyday life."
                        : "Manage your preferences and keep your data in your hands."}
              </p>
            </div>
            {(page === "Dashboard" || page === "Transactions") && (
              <button
                className="button primary"
                onClick={() => setTransaction(null)}
              >
                <Plus size={18} /> Add transaction
              </button>
            )}
            {page === "Categories" && (
              <button
                className="button primary"
                onClick={() => setEditingCategory(null)}
              >
                <Plus size={18} />
                Add category
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="notice warning">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}
          {data.demo && (
            <div className="demo-banner">
              <span>
                <Sparkles size={16} />
                <strong>You’re exploring demo data.</strong> Take a look around,
                then make it yours.
              </span>
              <button onClick={startFresh}>
                Start fresh <ArrowRight size={15} />
              </button>
            </div>
          )}
          {(page === "Dashboard" ||
            page === "Transactions" ||
            page === "Budget") && (
            <div className="period-row">
              <h2>
                {page === "Dashboard"
                  ? "Monthly overview"
                  : page === "Budget"
                    ? "Your monthly plan"
                    : "All transactions"}{" "}
                <span className="subtle-pill">{monthLabel(month)}</span>
              </h2>
              <label className="month-picker">
                <CalendarDays size={16} />
                <input
                  aria-label="Select month"
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (e.target.value) setMonth(e.target.value);
                  }}
                />
              </label>
            </div>
          )}
          {page === "Dashboard" && (
            <>
              <div className="stats-grid">
                {[
                  {
                    name: "Total income",
                    value: summary.income,
                    icon: ArrowDownLeft,
                    subtitle: "All money coming in",
                    className: "income",
                  },
                  {
                    name: "Total expenses",
                    value: summary.expense,
                    icon: ArrowUpRight,
                    subtitle: "All money going out",
                    className: "expense",
                  },
                  {
                    name: "Current balance",
                    value: summary.balance,
                    icon: Wallet,
                    subtitle: "Income minus expenses this month",
                    className: "balance",
                  },
                  {
                    name: "Budget remaining",
                    value: budget - summary.expense,
                    icon: ChartNoAxesCombined,
                    subtitle: budget
                      ? `Of ${fmt(budget)} monthly budget`
                      : "No monthly budget set",
                    className: "budget",
                  },
                ].map(({ name, value, icon: Icon, subtitle, className }) => (
                  <section key={name} className={`stat-card ${className}`}>
                    <div className="stat-top">
                      <span>{name}</span>
                      <span className="stat-icon">
                        <Icon size={19} />
                      </span>
                    </div>
                    <strong className="stat-value">{fmt(value)}</strong>
                    <small>{subtitle}</small>
                  </section>
                ))}
              </div>
              <div className="dashboard-middle">
                <section className="card spending-card">
                  <div className="card-heading">
                    <div>
                      <h2>Where your money goes</h2>
                      <p>Spending by category</p>
                    </div>
                    <span className="badge">This month</span>
                  </div>
                  {spending.length ? (
                    <div className="spending-content">
                      <div
                        className="donut"
                        style={{ background: `conic-gradient(${gradient})` }}
                        role="img"
                        aria-label={`Spending by category: ${spending.map((c) => `${c.name} ${fmt(c.total)}`).join(", ")}`}
                      >
                        <div>
                          <span>Total spent</span>
                          <strong>{fmt(summary.expense)}</strong>
                          <small>{spending.length} categories</small>
                        </div>
                      </div>
                      <div className="legend">
                        {spending.map((c) => (
                          <div key={c.id}>
                            <span className="legend-label">
                              <i style={{ background: c.color }} />
                              {c.name}
                            </span>
                            <strong>{fmt(c.total)}</strong>
                            <span className="muted">
                              {Math.round((c.total / summary.expense) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="empty">
                      <ChartNoAxesCombined size={30} />
                      <h3>A fresh start</h3>
                      <p>
                        Your spending breakdown will appear after your first
                        expense.
                      </p>
                    </div>
                  )}
                </section>
                <section className="card budget-card">
                  <div className="card-heading">
                    <div>
                      <h2>Monthly budget</h2>
                      <p>A little planning goes a long way.</p>
                    </div>
                    <span className="soft-icon">
                      <ChartNoAxesCombined size={20} />
                    </span>
                  </div>
                  {budgetContent()}
                  <button
                    className="text-link"
                    onClick={() => setPage("Budget")}
                  >
                    Manage budget <ArrowRight size={16} />
                  </button>
                </section>
              </div>
              <section className="card recent">
                <div className="card-heading">
                  <div>
                    <h2>Recent transactions</h2>
                    <p>Your latest money moves.</p>
                  </div>
                  <button
                    className="text-link"
                    onClick={() => setPage("Transactions")}
                  >
                    View all transactions <ArrowRight size={16} />
                  </button>
                </div>
                {transactionTable(
                  [...monthly].sort((a, b) => b.date.localeCompare(a.date)),
                  5,
                )}
              </section>
              <div className="footer-note">
                <ShieldCheck size={14} /> A little awareness today. A healthier
                financial tomorrow.
              </div>
            </>
          )}
          {page === "Transactions" && (
            <section className="card">
              <div className="filters">
                <label className="search">
                  <Search size={18} />
                  <input
                    placeholder="Search transactions…"
                    aria-label="Search transactions"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter by type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
                <select
                  aria-label="Filter by category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Sort by date"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
              {transactionTable(filtered)}
              <div className="table-footer">
                {filtered.length} transaction{filtered.length === 1 ? "" : "s"}{" "}
                · {monthLabel(month)}
              </div>
            </section>
          )}
          {page === "Categories" && (
            <>
              {(["expense", "income"] as const).map((kind) => (
                <section className="category-section" key={kind}>
                  <h2>
                    {kind === "expense" ? "Expense" : "Income"} categories{" "}
                    <span className="subtle-pill">
                      {data.categories.filter((c) => c.type === kind).length}
                    </span>
                  </h2>
                  <div className="categories-grid">
                    {data.categories
                      .filter((c) => c.type === kind)
                      .map((c) => (
                        <div className="card category-card" key={c.id}>
                          <CategoryIcon category={c} />
                          <div>
                            <h3>{c.name}</h3>
                            <p>
                              {
                                data.transactions.filter(
                                  (t) => t.categoryId === c.id,
                                ).length
                              }{" "}
                              transactions
                            </p>
                          </div>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={`Edit ${c.name}`}
                              onClick={() => setEditingCategory(c)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Delete ${c.name}`}
                              onClick={() => removeCategory(c)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              ))}
            </>
          )}
          {page === "Budget" && (
            <div className="budget-layout">
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>{monthLabel(month)} budget</h2>
                    <p>Give every peso a purpose.</p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setBudgetEditing(true)}
                  >
                    <Pencil size={16} />
                    {budget ? "Edit budget" : "Set budget"}
                  </button>
                </div>
                <div className="budget-detail">{budgetContent()}</div>
              </section>
              <section className="card budget-advice">
                <span className="soft-icon">
                  <TrendingUp size={24} />
                </span>
                <h2>Small steps. Lasting habits.</h2>
                <p>
                  Choose a realistic spending limit for the month. Every expense
                  you record automatically updates your remaining budget.
                </p>
                <p>
                  Budgets are saved separately for each month, so you can adjust
                  your plan as life changes.
                </p>
              </section>
            </div>
          )}
          {page === "Settings" && (
            <div className="settings-stack">
              <section className="card settings-card">
                <div>
                  <h2>Currency</h2>
                  <p>
                    Choose how amounts are displayed. This does not convert
                    existing amounts.
                  </p>
                </div>
                <select
                  aria-label="Currency preference"
                  value={data.settings.currency}
                  onChange={(e) =>
                    update({
                      ...data,
                      settings: {
                        currency: e.target
                          .value as typeof data.settings.currency,
                      },
                    })
                  }
                >
                  {[
                    ["PHP", "PHP — Philippine peso"],
                    ["USD", "USD — US dollar"],
                    ["EUR", "EUR — Euro"],
                    ["SGD", "SGD — Singapore dollar"],
                  ].map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </section>
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Your data, in your hands</h2>
                    <p>
                      Download a full backup or restore a previous dinero
                      export.
                    </p>
                  </div>
                  <ShieldCheck size={24} />
                </div>
                <div className="settings-actions">
                  <button className="button secondary" onClick={exportData}>
                    <Download size={17} />
                    Export JSON backup
                  </button>
                  <label className="button secondary import-button">
                    <Upload size={17} />
                    Import JSON backup
                    <input
                      type="file"
                      accept=".json,application/json"
                      aria-label="Import JSON backup"
                      onChange={(e) => {
                        void importData(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="settings-description">
                  Backups include transactions, categories, monthly budgets, and
                  your currency preference. Importing replaces the current
                  workspace.
                </p>
              </section>
              <section className="card settings-card">
                <div>
                  <h2>Local by design</h2>
                  <p>
                    Your data is stored in this browser’s localStorage. It is
                    not synced between devices. Clearing browser data removes
                    it, so export backups regularly.
                  </p>
                </div>
                <ShieldCheck size={30} />
              </section>
              <section className="card settings-card danger-zone">
                <div>
                  <h2>Clear all local data</h2>
                  <p>
                    Remove all transactions, custom categories, budgets, and
                    preferences.
                  </p>
                </div>
                <button
                  className="button danger"
                  onClick={() =>
                    setConfirmation({
                      title: "Clear all local data?",
                      message:
                        "This cannot be undone. Export a backup first if you want to keep your records. The app will reset to an empty workspace with default categories and PHP currency.",
                      action: () => {
                        update(freshData());
                        setNotice("Your local workspace has been reset.");
                      },
                    })
                  }
                >
                  <Trash2 size={16} />
                  Clear data
                </button>
              </section>
            </div>
          )}
        </main>
      </div>
      {transaction !== undefined && (
        <TransactionForm
          transaction={transaction}
          categories={data.categories}
          currency={data.settings.currency}
          onClose={() => setTransaction(undefined)}
          onSave={(t) => {
            update({
              ...data,
              transactions: transaction
                ? data.transactions.map((x) => (x.id === t.id ? t : x))
                : [...data.transactions, t],
            });
            setTransaction(undefined);
          }}
        />
      )}
      {editingCategory !== undefined && (
        <CategoryForm
          category={editingCategory}
          categories={data.categories}
          used={
            !!editingCategory &&
            data.transactions.some((t) => t.categoryId === editingCategory.id)
          }
          onClose={() => setEditingCategory(undefined)}
          onSave={(c) => {
            update({
              ...data,
              categories: editingCategory
                ? data.categories.map((x) => (x.id === c.id ? c : x))
                : [...data.categories, c],
            });
            setEditingCategory(undefined);
          }}
        />
      )}
      {budgetEditing && (
        <BudgetForm
          amount={budget}
          currency={data.settings.currency}
          onClose={() => setBudgetEditing(false)}
          onSave={(amount) => {
            update({
              ...data,
              budgets: [
                ...data.budgets.filter((b) => b.month !== month),
                { month, amount },
              ],
            });
            setBudgetEditing(false);
          }}
        />
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <p className="modal-description">{confirmation.message}</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button
              className="button danger"
              onClick={() => {
                confirmation.action();
                setConfirmation(null);
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function TransactionForm({
  transaction,
  categories,
  currency,
  onClose,
  onSave,
}: {
  transaction: Transaction | null;
  categories: Category[];
  currency: string;
  onClose: () => void;
  onSave: (t: Transaction) => void;
}) {
  const [type, setType] = useState<TransactionType>(
    transaction?.type || "expense",
  );
  const [amount, setAmount] = useState(
    transaction ? (transaction.amount / 100).toFixed(2) : "",
  );
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ||
      categories.find((c) => c.type === "expense")?.id ||
      "",
  );
  const [date, setDate] = useState(transaction?.date || today());
  const [note, setNote] = useState(transaction?.note || "");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!value) {
      setError(
        "Enter a positive amount with up to two decimal places (maximum 9,999,999,999.99).",
      );
      return;
    }
    if (!categories.some((c) => c.id === categoryId && c.type === type)) {
      setError("Choose a category. You can create one on the Categories page.");
      return;
    }
    onSave({
      id: transaction?.id || crypto.randomUUID(),
      type,
      amount: value,
      categoryId,
      date,
      note: note.trim(),
    });
  }
  return (
    <Modal
      title={transaction ? "Edit transaction" : "Add transaction"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="segmented">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={type === t ? "selected" : ""}
              onClick={() => {
                setType(t);
                setCategoryId(categories.find((c) => c.type === t)?.id || "");
              }}
            >
              {t === "expense" ? (
                <ArrowUpRight size={16} />
              ) : (
                <ArrowDownLeft size={16} />
              )}{" "}
              {t === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>
        <label>
          Amount ({currency})
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Category
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="" disabled>
                Select category
              </option>
              {categories
                .filter((c) => c.type === type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min="0001-01-01"
              max="9999-12-31"
            />
          </label>
        </div>
        <label>
          Note <span className="muted">(optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={250}
            placeholder="What was it for?"
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            {transaction ? "Save changes" : "Add transaction"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function CategoryForm({
  category,
  categories,
  used,
  onClose,
  onSave,
}: {
  category: Category | null;
  categories: Category[];
  used: boolean;
  onClose: () => void;
  onSave: (c: Category) => void;
}) {
  const [name, setName] = useState(category?.name || "");
  const [type, setType] = useState<TransactionType>(
    category?.type || "expense",
  );
  const [color, setColor] = useState(category?.color || colors[0]);
  const [error, setError] = useState("");
  return (
    <Modal
      title={category ? "Edit category" : "Add category"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setError("Enter a category name.");
            return;
          }
          if (
            categories.some(
              (c) =>
                c.id !== category?.id &&
                c.type === type &&
                c.name.toLowerCase() === name.trim().toLowerCase(),
            )
          ) {
            setError("A category with this name already exists.");
            return;
          }
          onSave({
            id: category?.id || crypto.randomUUID(),
            name: name.trim(),
            type,
            color,
          });
        }}
      >
        <label>
          Name
          <input
            autoFocus
            required
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Travel"
          />
        </label>
        <label>
          Type
          <select
            disabled={used}
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        {used && (
          <p className="muted text-sm">
            Type is locked because this category has transactions.
          </p>
        )}
        <label>Color</label>
        <div className="color-options">
          {colors.map((c) => (
            <button
              type="button"
              key={c}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className={color === c ? "chosen" : ""}
              style={{ background: c }}
              onClick={() => setColor(c)}
            >
              {color === c ? "✓" : ""}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Save category</button>
        </div>
      </form>
    </Modal>
  );
}
function BudgetForm({
  amount,
  currency,
  onClose,
  onSave,
}: {
  amount: number;
  currency: string;
  onClose: () => void;
  onSave: (amount: number) => void;
}) {
  const [value, setValue] = useState(amount ? (amount / 100).toFixed(2) : "");
  const [error, setError] = useState("");
  return (
    <Modal title="Set monthly budget" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = parseAmount(value);
          if (!parsed) {
            setError("Enter a positive budget with up to two decimal places.");
            return;
          }
          onSave(parsed);
        }}
      >
        <label>
          Monthly spending limit ({currency})
          <input
            autoFocus
            required
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary">Save budget</button>
        </div>
      </form>
    </Modal>
  );
}
