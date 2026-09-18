import { useMemo, useState, type FormEvent } from "react";
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
import type { Category, CategoryType, Transaction, TransactionType } from "./types";
import { useData } from "./hooks/useData";
import { freshData, colors } from "./data/defaults";
import {
  dateLabel,
  dateTimeLabel,
  money,
  monthLabel,
  parseAmount,
  currentTime,
  today,
  totals,
} from "./utils/finance";
import { validateData } from "./utils/storage";
import Modal from "./components/Modal";
import AccountMenu from "./components/AccountMenu";
import DashboardAnalytics from "./components/DashboardAnalytics";
import DateRangeFilter from "./components/DateRangeFilter";
import {
  defaultGrouping,
  filterTransactions,
  filterTransactionsByDateRange,
  parseFilterAmount,
  presetRange,
  type AnalyticsRange,
  type DateRange,
  type Grouping,
} from "./utils/analytics";
import { SaveStatus } from "./components/SaveStatus";
import LocalMigration from "./components/LocalMigration";
import { fingerprint, prepareImport } from "./services/mapping";

type Page =
  | "Dashboard"
  | "Transactions"
  | "Debts"
  | "Wallet"
  | "Categories"
  | "Budget"
  | "Settings";
const nav = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Transactions", icon: ArrowLeftRight },
  { name: "Debts", icon: ArrowLeftRight },
  { name: "Wallet", icon: Wallet },
  { name: "Categories", icon: Shapes },
  { name: "Budget", icon: ChartNoAxesCombined },
  { name: "Settings", icon: Settings },
] as const;
const categoryIcons = [Coffee, ShoppingBag, Car, House, Sparkles, Heart];
function CategoryIcon({ category }: { category?: Category }) {
  const Icon =
    category?.icon !== undefined
      ? categoryIcons[category.icon] || Shapes
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

export default function App({
  email,
  ownerId,
  onSignOut,
}: {
  email: string;
  ownerId: string;
  onSignOut: () => void;
}) {
  const { data, update, error, loading, saving, ready, retry, imports } =
    useData(ownerId);
  const [page, setPage] = useState<Page>("Dashboard");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [range, setRange] = useState<AnalyticsRange>(() =>
    presetRange("thisMonth"),
  );
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  function changeRange(next: AnalyticsRange) {
    setRange(next);
    setGrouping(defaultGrouping(next));
  }
  function clearFilters() {
    changeRange(presetRange("thisMonth"));
    setSearch("");
    setType("all");
    setCategory("all");
    setMinimum("");
    setMaximum("");
    setSort("newest");
  }
  function inspectRange(
    next: DateRange,
    categoryId = "all",
    transactionType = "all",
  ) {
    changeRange({ ...next, preset: "custom" });
    setCategory(categoryId);
    setType(transactionType);
    setSearch("");
    setMinimum("");
    setMaximum("");
    setSort("newest");
    setPage("Transactions");
    requestAnimationFrame(() => document.getElementById("page-title")?.focus());
  }
  const [transaction, setTransaction] = useState<
    Transaction | null | undefined
  >(undefined);
  const [debt, setDebt] = useState<Transaction | null | undefined>(undefined);
  const [adjustment, setAdjustment] = useState<Transaction | null | undefined>(undefined);
  const [editingCategory, setEditingCategory] = useState<
    Category | null | undefined
  >(undefined);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    action: () => Promise<boolean>;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [budgetEditing, setBudgetEditing] = useState(false);
  const fmt = (n: number) => money(n, data.settings.currency);
  const financialTransactions = useMemo(
    () => data.transactions.filter((t) => t.type === "income" || t.type === "expense"),
    [data.transactions],
  );
  const debts = data.transactions.filter(
    (t) => t.type === "debt_borrowed" || t.type === "debt_lent",
  );
  const adjustments = data.transactions.filter(
    (t) => t.type === "wallet_add" || t.type === "wallet_subtract",
  );
  const monthly = financialTransactions.filter((t) => t.date.startsWith(month));
  const summary = totals(monthly);
  const budget = data.budgets.find((b) => b.month === month)?.amount || 0;
  const percent = budget ? Math.round((summary.expense / budget) * 100) : 0;
  const min = parseFilterAmount(minimum);
  const max = parseFilterAmount(maximum);
  const filterError =
    Number.isNaN(min) || Number.isNaN(max)
      ? "Enter valid amounts with at most two decimal places."
      : min !== null && max !== null && min > max
        ? "Minimum amount cannot exceed maximum amount."
        : "";
  const filtered = useMemo(
    () =>
      filterError
        ? []
        : filterTransactions(financialTransactions, data.categories, {
            ...range,
            type,
            categoryId: category,
            min,
            max,
            search,
            sort,
          }),
    [
      financialTransactions,
      data.categories,
      range,
      type,
      category,
      min,
      max,
      search,
      sort,
      filterError,
    ],
  );
  const recent = useMemo(
    () =>
      filterTransactionsByDateRange(financialTransactions, range).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [financialTransactions, range],
  );
  const startFresh = () =>
    setConfirmation({
      title: "Start with a clean slate?",
      message:
        "This removes the sample transactions and budget. Your own tracking starts with an empty dashboard.",
      action: () => update(prepareImport(freshData())),
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
  const removeDebt = (t: Transaction) =>
    setConfirmation({
      title: "Delete debt entry?",
      message: `${t.note || "This debt entry"} (${fmt(t.amount)}) will be permanently removed.`,
      action: () =>
        update({ ...data, transactions: data.transactions.filter((x) => x.id !== t.id) }),
    });
  const removeAdjustment = (t: Transaction) =>
    setConfirmation({
      title: "Delete wallet adjustment?",
      message: `${t.note || "This adjustment"} (${fmt(t.amount)}) will be permanently removed.`,
      action: () =>
        update({ ...data, transactions: data.transactions.filter((x) => x.id !== t.id) }),
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
        message: `Replace cloud data for ${email} with ${parsed.transactions.length} transactions, ${parsed.categories.length} categories, ${parsed.budgets.length} budgets, and ${parsed.settings.currency} currency preferences from this ${parsed.demo ? "demo" : "personal"} backup?`,
        action: async () => {
          const hash = await fingerprint(parsed);
          if (imports.includes(hash)) {
            setNotice(
              "This backup has already been imported into this account.",
            );
            return true;
          }
          const saved = await update(prepareImport(parsed), hash);
          if (saved)
            setNotice("Backup restored and verified in your cloud account.");
          return saved;
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
              const label = t.type === "income"
                  ? "Money in"
                  : "Money out";
              return (
                <tr key={t.id}>
                  <td>
                    <div className="transaction-name">
                      <CategoryIcon category={c} />
                      <div>
                        <strong>{t.note || c?.name || label}</strong>
                        <small>
                          {label}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge">{c?.name}</span>
                  </td>
                  <td className="muted date-cell">
                    {dateTimeLabel(t.date, t.time)}
                  </td>
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
                        aria-label={`Edit ${t.note || c?.name || label}`}
                        onClick={() => setTransaction(t)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${t.note || c?.name || label}`}
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
  if (loading || !ready)
    return (
      <div className="auth-shell">
        <section className="card auth-card">
          <h1>dinero</h1>
          <p role="status">
            {loading
              ? "Loading your cloud workspace..."
              : "Your workspace could not be loaded."}
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="auth-links">
            {!loading && (
              <button className="button primary" onClick={retry}>
                Retry
              </button>
            )}
            <button className="button secondary" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </section>
      </div>
    );
  return (
    <SaveStatus.Provider value={{ saving, error }}>
      <div className="app-shell">
        <aside className="sidebar" inert={saving}>
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
                aria-label={name}
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
              <p>
                Private by design. Your records belong to your signed-in
                account.
              </p>
            </div>
            <div className="profile">
              <span className="avatar" aria-hidden="true">
                {email.trim().charAt(0).toUpperCase() || "P"}
              </span>
              <div className="profile-text min-w-0">
                <strong className="account-email" title={email}>
                  {email}
                </strong>
                <small>Cloud workspace</small>
              </div>
              <span className="online-dot" />
            </div>
          </div>
        </aside>
        <div className="main-shell" inert={saving}>
          <header className="topbar">
            <div className="breadcrumb">
              Workspace <ChevronRight size={14} />
              <strong>{page}</strong>
            </div>
            <span className="local-status">
              <span className="online-dot" /> Cloud workspace
            </span>
            <button
              className="icon-button"
              aria-label="About cloud storage"
              onClick={() => setPage("Settings")}
            >
              <CircleHelp size={19} />
            </button>
            <AccountMenu
              email={email}
              onSignOut={onSignOut}
              onAccount={() => {
                setPage("Settings");
                setNotice("");
                requestAnimationFrame(() => {
                  const heading = document.getElementById("account-heading");
                  heading?.focus();
                  heading?.scrollIntoView({ block: "center" });
                });
              }}
              onSettings={() => {
                setPage("Settings");
                setNotice("");
                requestAnimationFrame(() =>
                  document.getElementById("page-title")?.focus(),
                );
              }}
            />
          </header>
          <main>
            <div className="page-heading">
              <div>
                <div className="eyebrow">A LITTLE CLARITY, EVERY DAY</div>
                <h1 id="page-title" tabIndex={-1}>
                  {page === "Dashboard"
                    ? "Your money, at a glance."
                    : page === "Budget"
                      ? "Make room for what matters."
                    : page === "Transactions"
                      ? "Every little detail."
                      : page === "Debts"
                        ? "Keep debts clear and separate."
                        : page === "Wallet"
                          ? "Adjust your wallet with confidence."
                        : page === "Categories"
                          ? "A place for every peso."
                          : "Your space, your preferences."}
                </h1>
                <p>
                  {page === "Dashboard"
                    ? "A clear picture of where you stand and where your money goes."
                    : page === "Transactions"
                      ? "Keep your income and expenses organized, all in one place."
                      : page === "Debts"
                        ? "Track money you borrowed or lent without changing income or expenses."
                        : page === "Wallet"
                          ? "Record manual wallet additions or deductions without changing income or expenses."
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
                  <Plus size={18} />
                  Add transaction
                </button>
              )}
              {page === "Debts" && (
                <button className="button primary" onClick={() => setDebt(null)}>
                  <Plus size={18} /> Add debt
                </button>
              )}
              {page === "Wallet" && (
                <button className="button primary" onClick={() => setAdjustment(null)}>
                  <Plus size={18} /> Add adjustment
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
              <div className="notice warning" role="alert">
                {error}
              </div>
            )}
            {error && (
              <div className="notice cloud-status">
                <span>
                  Reload cloud data before retrying an uncertain save. This
                  discards unsaved form edits.
                </span>
                <button
                  className="button secondary"
                  onClick={() => {
                    setTransaction(undefined);
                    setDebt(undefined);
                    setAdjustment(undefined);
                    setEditingCategory(undefined);
                    setBudgetEditing(false);
                    setConfirmation(null);
                    retry();
                  }}
                >
                  Reload cloud data
                </button>
              </div>
            )}
            {notice && (
              <div className="notice" role="status">
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
                  <strong>You’re exploring demo data.</strong> Take a look
                  around, then make it yours.
                </span>
                <button onClick={startFresh}>
                  Start fresh <ArrowRight size={15} />
                </button>
              </div>
            )}
            {(page === "Dashboard" || page === "Transactions") && (
              <DateRangeFilter
                key={range.start + range.end + range.preset}
                range={range}
                onChange={changeRange}
              />
            )}
            {page === "Budget" && (
              <div className="period-row">
                <h2>
                  Your monthly plan{" "}
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
              <DashboardAnalytics
                data={data}
                range={range}
                grouping={grouping}
                onGrouping={setGrouping}
                onInspect={inspectRange}
                onBudget={(m) => {
                  setMonth(m);
                  setPage("Budget");
                }}
                recent={
                  <section className="card recent">
                    <div className="card-heading">
                      <div>
                        <h2>Recent transactions</h2>
                        <p>Your latest money moves in this period.</p>
                      </div>
                      <button
                        className="text-link"
                        onClick={() => inspectRange(range)}
                      >
                        View all transactions <ArrowRight size={16} />
                      </button>
                    </div>
                    {transactionTable(recent, 5)}
                  </section>
                }
              />
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
                    aria-label="Sort transactions"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="highest">Highest amount</option>
                    <option value="lowest">Lowest amount</option>
                  </select>
                </div>
                <div className="amount-filters">
                  <label>
                    Minimum amount ({data.settings.currency})
                    <input
                      aria-label="Minimum amount"
                      inputMode="decimal"
                      value={minimum}
                      onChange={(e) => setMinimum(e.target.value)}
                      placeholder="No minimum"
                    />
                  </label>
                  <label>
                    Maximum amount ({data.settings.currency})
                    <input
                      aria-label="Maximum amount"
                      inputMode="decimal"
                      value={maximum}
                      onChange={(e) => setMaximum(e.target.value)}
                      placeholder="No maximum"
                    />
                  </label>
                  <button className="button secondary" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
                {filterError && (
                  <p role="alert" className="form-error filter-error">
                    {filterError}
                  </p>
                )}
                {transactionTable(filtered)}
                <div className="table-footer">
                  {filtered.length} transaction
                  {filtered.length === 1 ? "" : "s"} · {dateLabel(range.start)}{" "}
                  – {dateLabel(range.end)}
                </div>
              </section>
            )}
            {page === "Debts" && (
              <section className="card">
                <div className="card-heading">
                  <div><h2>Debt entries</h2><p>Borrowing adds to your wallet; lending subtracts from it.</p></div>
                </div>
                {debts.length ? <div className="movement-list">{[...debts].sort((a,b) => `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`)).map((t) => {
                  const borrowed = t.type === "debt_borrowed";
                  return <div className="movement-row" key={t.id}><div><strong>{t.note || (borrowed ? "Money borrowed" : "Money lent")}</strong><small>{borrowed ? "Money borrowed" : "Money lent"} · {dateTimeLabel(t.date, t.time)}</small></div><strong className={borrowed ? "positive" : ""}>{borrowed ? "+" : "−"}{fmt(t.amount)}</strong><div className="row-actions"><button className="icon-button" aria-label={`Edit ${t.note || "debt entry"}`} onClick={() => setDebt(t)}><Pencil size={15}/></button><button className="icon-button" aria-label={`Delete ${t.note || "debt entry"}`} onClick={() => removeDebt(t)}><Trash2 size={15}/></button></div></div>;
                })}</div> : <div className="empty"><Wallet size={30}/><h3>No debts here yet</h3><p>Add a borrowed or lent amount to keep it separate from transactions.</p></div>}
              </section>
            )}
            {page === "Wallet" && (
              <section className="card">
                <div className="card-heading"><div><h2>Wallet adjustments</h2><p>Manual changes do not count as income or expenses.</p></div><strong className="wallet-total">{fmt(totals(data.transactions).balance)}</strong></div>
                {adjustments.length ? <div className="movement-list">{[...adjustments].sort((a,b) => `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`)).map((t) => {
                  const added = t.type === "wallet_add";
                  return <div className="movement-row" key={t.id}><div><strong>{t.note || (added ? "Wallet addition" : "Wallet deduction")}</strong><small>{added ? "Manual wallet addition" : "Manual wallet deduction"} · {dateTimeLabel(t.date, t.time)}</small></div><strong className={added ? "positive" : ""}>{added ? "+" : "−"}{fmt(t.amount)}</strong><div className="row-actions"><button className="icon-button" aria-label={`Edit ${t.note || "wallet adjustment"}`} onClick={() => setAdjustment(t)}><Pencil size={15}/></button><button className="icon-button" aria-label={`Delete ${t.note || "wallet adjustment"}`} onClick={() => removeAdjustment(t)}><Trash2 size={15}/></button></div></div>;
                })}</div> : <div className="empty"><Wallet size={30}/><h3>No wallet adjustments yet</h3><p>Add a manual increase or decrease when your wallet needs correction.</p></div>}
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
                    Choose a realistic spending limit for the month. Every
                    expense you record automatically updates your remaining
                    budget.
                  </p>
                  <p>
                    Budgets are saved separately for each month, so you can
                    adjust your plan as life changes.
                  </p>
                </section>
              </div>
            )}
            {page === "Settings" && (
              <div className="settings-stack">
                <section className="card settings-card">
                  <div>
                    <h2 id="account-heading" tabIndex={-1}>
                      Your account
                    </h2>
                    <p className="account-email">{email}</p>
                  </div>
                  <button className="button secondary" onClick={onSignOut}>
                    Sign out
                  </button>
                </section>
                <LocalMigration
                  email={email}
                  cloud={data}
                  imports={imports}
                  onImport={update}
                />
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
                    Backups include transactions, categories, monthly budgets,
                    and your currency preference. Importing replaces the current
                    workspace.
                  </p>
                </section>
                <section className="card settings-card">
                  <div>
                    <h2>Your private cloud workspace</h2>
                    <p>
                      Your records are stored in your Supabase account. Sign in
                      on another device to access them. Export backups
                      regularly.
                    </p>
                  </div>
                  <ShieldCheck size={30} />
                </section>
                <section className="card settings-card danger-zone">
                  <div>
                    <h2>Clear cloud account data</h2>
                    <p>
                      Remove all transactions, custom categories, budgets, and
                      preferences.
                    </p>
                  </div>
                  <button
                    className="button danger"
                    onClick={() =>
                      setConfirmation({
                        title: "Clear cloud account data?",
                        message:
                          "This deletes the financial records in this signed-in cloud account and restores default categories and PHP currency. Export a backup first. Your login account and original local backup are not deleted.",
                        action: async () => {
                          const saved = await update(
                            prepareImport(freshData()),
                          );
                          if (saved)
                            setNotice(
                              "Your cloud financial workspace has been reset. The original local backup is preserved.",
                            );
                          return saved;
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
            onSave={async (t) => {
              const saved = await update({
                ...data,
                transactions: transaction
                  ? data.transactions.map((x) => (x.id === t.id ? t : x))
                  : [...data.transactions, t],
              });
              if (saved) setTransaction(undefined);
            }}
          />
        )}
        {debt !== undefined && (
          <TransactionForm
            transaction={debt}
            categories={data.categories}
            currency={data.settings.currency}
            mode="debt"
            onClose={() => setDebt(undefined)}
            onSave={async (t) => {
              const saved = await update({ ...data, transactions: debt ? data.transactions.map((x) => x.id === t.id ? t : x) : [...data.transactions, t] });
              if (saved) setDebt(undefined);
            }}
          />
        )}
        {adjustment !== undefined && (
          <TransactionForm
            transaction={adjustment}
            categories={data.categories}
            currency={data.settings.currency}
            mode="wallet"
            onClose={() => setAdjustment(undefined)}
            onSave={async (t) => {
              const saved = await update({ ...data, transactions: adjustment ? data.transactions.map((x) => x.id === t.id ? t : x) : [...data.transactions, t] });
              if (saved) setAdjustment(undefined);
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
            onSave={async (c) => {
              const saved = await update({
                ...data,
                categories: editingCategory
                  ? data.categories.map((x) => (x.id === c.id ? c : x))
                  : [...data.categories, c],
              });
              if (saved) setEditingCategory(undefined);
            }}
          />
        )}
        {budgetEditing && (
          <BudgetForm
            amount={budget}
            currency={data.settings.currency}
            onClose={() => setBudgetEditing(false)}
            onSave={async (amount) => {
              const saved = await update({
                ...data,
                budgets: [
                  ...data.budgets.filter((b) => b.month !== month),
                  { month, amount },
                ],
              });
              if (saved) setBudgetEditing(false);
            }}
          />
        )}
        {confirmation && (
          <Modal
            title={confirmation.title}
            onClose={() => setConfirmation(null)}
          >
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
                onClick={async () => {
                  try {
                    if (await confirmation.action()) setConfirmation(null);
                  } catch (e) {
                    setNotice(
                      e instanceof Error
                        ? e.message
                        : "Operation failed. Please retry.",
                    );
                  }
                }}
              >
                Confirm
              </button>
            </div>
          </Modal>
        )}
      </div>
    </SaveStatus.Provider>
  );
}
function TransactionForm({
  transaction,
  categories,
  currency,
  mode = "transaction",
  onClose,
  onSave,
}: {
  transaction: Transaction | null;
  categories: Category[];
  currency: string;
  mode?: "transaction" | "debt" | "wallet";
  onClose: () => void;
  onSave: (t: Transaction) => void;
}) {
  const allowedTypes: Record<typeof mode, readonly TransactionType[]> = {
    transaction: ["expense", "income"],
    debt: ["debt_borrowed", "debt_lent"],
    wallet: ["wallet_add", "wallet_subtract"],
  };
  const [type, setType] = useState<TransactionType>(transaction?.type || allowedTypes[mode][0]);
  const [amount, setAmount] = useState(
    transaction ? (transaction.amount / 100).toFixed(2) : "",
  );
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ||
      categories.find((c) => c.type === "expense")?.id ||
      "",
  );
  const [date, setDate] = useState(transaction?.date || today());
  const [time, setTime] = useState(transaction?.time || currentTime());
  const [note, setNote] = useState(transaction?.note || "");
  const [error, setError] = useState("");
  const financial = type === "income" || type === "expense";
  function submit(e: FormEvent) {
    e.preventDefault();
    const value = parseAmount(amount);
    if (!value) {
      setError(
        "Enter a positive amount with up to two decimal places (maximum 9,999,999,999.99).",
      );
      return;
    }
    if (financial && !categories.some((c) => c.id === categoryId && c.type === type)) {
      setError("Choose a category. You can create one on the Categories page.");
      return;
    }
    onSave({
      id: transaction?.id || crypto.randomUUID(),
      type,
      amount: value,
      ...(financial ? { categoryId } : {}),
      date,
      time,
      note: note.trim(),
    });
  }
  return (
    <Modal
      title={transaction ? `Edit ${mode === "debt" ? "debt" : mode === "wallet" ? "wallet adjustment" : "transaction"}` : mode === "debt" ? "Add debt" : mode === "wallet" ? "Add wallet adjustment" : "Add transaction"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="segmented">
          {allowedTypes[mode].map((t) => (
            <button
              key={t}
              type="button"
              className={type === t ? "selected" : ""}
              onClick={() => {
                setType(t);
                setCategoryId(
                  t === "income" || t === "expense"
                    ? categories.find((c) => c.type === t)?.id || ""
                    : "",
                );
              }}
            >
              {t === "expense" || t === "debt_lent" || t === "wallet_subtract" ? (
                <ArrowUpRight size={16} />
              ) : (
                <ArrowDownLeft size={16} />
              )}{" "}
              {t === "expense"
                ? "Expense"
                : t === "income"
                  ? "Income"
                  : t === "debt_borrowed"
                    ? "I borrowed"
                    : t === "debt_lent"
                      ? "I lent"
                      : t === "wallet_add"
                        ? "Add to wallet"
                        : "Subtract from wallet"}
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
          {financial ? (
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
                  .filter((c) => c.type === (type as CategoryType))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <div className="debt-form-note">
              {type === "debt_borrowed"
                ? "Adds this borrowed amount to your wallet without counting it as income."
                : type === "debt_lent"
                  ? "Subtracts this amount from your wallet without counting it as an expense."
                  : type === "wallet_add"
                    ? "Adds this amount to your wallet without counting it as income."
                    : "Subtracts this amount from your wallet without counting it as an expense."}
            </div>
          )}
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
          <label>
            Time
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>
        <label>
          {mode === "debt" ? "Person / note" : "Note"} <span className="muted">(optional)</span>
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
            {transaction
              ? "Save changes"
              : mode === "debt"
                ? "Add debt"
                : mode === "wallet"
                  ? "Add adjustment"
                  : "Add transaction"}
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
  const [type, setType] = useState<CategoryType>(
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
            icon: category?.icon,
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
            onChange={(e) => setType(e.target.value as CategoryType)}
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
