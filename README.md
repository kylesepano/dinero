# dinero

Personal income and expense tracking with React, TypeScript, Tailwind, Vite, and Supabase Auth/PostgreSQL. Existing pages, mobile navigation, forms, calculations, and typography are preserved.

## Local setup

1. Run `npm install`.
2. Create a Supabase project and apply all migrations below.
3. Copy `.env.example` to `.env.local` and fill in:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
   ```

4. Configure Auth redirects, then run `npm run dev`.

Find the Project URL in Supabase's Connect dialog or Project Settings / API and the publishable key under API Keys. Only modern `sb_publishable_` keys are accepted. Never put secret/service-role keys, database passwords, or test-account passwords in frontend variables. Vite embeds `VITE_` values in public JavaScript. Real environment files are ignored; only `.env.example` is tracked. Missing configuration shows a setup screen, not an unauthenticated financial workspace.

## Database setup

Run these files once, in order, in Supabase SQL Editor:

1. `supabase/migrations/202609080001_workspace.sql`
2. `supabase/migrations/202609080002_atomic_workspace.sql`
3. `supabase/migrations/202609180003_debts_and_times.sql`

Alternatively link the Supabase CLI and run `supabase db push`. Do not mix manual/CLI migration application without reconciling migration history.

| Table | Purpose |
| --- | --- |
| `categories` | UUID ID, owner, name/type/color, preserved optional icon |
| `transactions` | UUID ID, owner, integer centavos, date/time, optional category, note |
| `budgets` | UUID ID, owner, unique month, integer spending limit |
| `settings` | UUID ID, unique owner, currency, demo flag, revision |
| `import_receipts` | UUID ID, owner, unique backup fingerprint, timestamp |

Every table enables/forces RLS, revokes anonymous/public privileges, and has explicit owner-only SELECT/INSERT/UPDATE/DELETE policies. INSERT/UPDATE checks prevent assigning another owner. The composite transaction foreign key `(category_id, user_id, type)` prevents cross-account and wrong-type references. Used categories cannot be deleted or change type while referenced.

`load_workspace` returns a consistent snapshot without REST row-pagination truncation. `save_workspace` changes data atomically, locks the settings row, and checks the expected revision to reject stale app saves. Both are **SECURITY INVOKER**, with empty search paths and fully qualified objects; the caller's RLS applies. No elevated function or separate backend is used.

## Debts and transaction times

Transactions can be recorded as **I borrowed** or **I lent**. Borrowing adds the amount to the wallet balance; lending subtracts it. Debt entries have no category and do not count as income, expenses, category totals, spending charts, or budgets. Each new transaction records the current local time by default, and transaction tables show the saved date and time. Older date-only records remain valid and continue to display their date until they are edited.

Apply `202609180003_debts_and_times.sql` before using this release with an existing Supabase project. It extends the existing owner-scoped transaction table and snapshot RPCs without changing prior income, expense, category, or budget records.

In-memory data changes only after a successful validated response. Failed saves keep forms open. Reload cloud data before retrying an uncertain save: a lost response may mean the server committed. Revision checks prevent duplicate submissions in that case. Requests verify and capture the initiating account's token, so account switching cannot retarget pending writes.

## Auth and redirects

In Supabase Authentication / Providers (or Sign In / Providers) / Email, enable email/password authentication and email confirmation. Set a password minimum of at least 8 characters. Configure production SMTP and test email delivery before inviting users.

Under Authentication / URL Configuration:

- **Site URL:** `https://YOUR_PRODUCTION_DOMAIN` (actual Vercel/custom domain).
- **Redirect URLs:** `http://localhost:5173/**`, `http://127.0.0.1:5173/**`, and `https://YOUR_PRODUCTION_DOMAIN/**`.
- Add `https://YOUR_INTENTIONALLY_SUPPORTED_PREVIEW_DOMAIN/**` only for each preview origin you intend to trust. Avoid a blanket allowlist for all Vercel deployments. Adjust local ports if needed.

Confirmation returns to `ORIGIN/?auth=confirm`; recovery returns to `ORIGIN/?auth=reset`. Keep standard email templates using `{{ .ConfirmationURL }}` so Supabase verifies the token before redirecting. Custom templates must preserve verification and the supplied redirect destination. Root query routes work on Vercel without SPA path rewrites.

Implemented: sign up/in/out, confirmation instructions and resend, forgot/reset password, callback errors, session restoration/refresh, and a protected workspace. Supabase manages passwords and session tokens. Financial data is not cached locally. Account changes immediately unmount the prior workspace; late responses cannot populate another account. Sign-out affects this device; failed sign-out locks the workspace and offers retry.

## Local migration and backups

The original `dinero:v1` record is never automatically imported, deleted, or overwritten.

1. Sign in to the account that owns the old records.
2. Open Settings / Existing local backup / Review local import.
3. Review the destination email, demo/personal status, counts, and currency.
4. Export current cloud records if needed, then explicitly confirm Replace cloud data.

Imports replace the account's financial workspace rather than guessing a merge. IDs are regenerated and category links remapped while preserving amounts, dates, budgets, currency, and default icons. Import and receipt commit atomically. The returned snapshot is compared with the prepared import before success is shown. The original local backup stays intact. Demo imports require explicit confirmation; new cloud accounts start empty with default categories.

JSON export/import remains available. Exports include financial data and preferences, not owner IDs, credentials, session tokens, or receipts. JSON import uses the same confirmed atomic replacement and verification. Stable SHA-256 fingerprints prevent repeating an exact backup import into the same account, including after refresh or financial reset. Intentionally restoring an already-imported exact backup requires an explicit administrative decision outside this MVP; automatic repeat imports are rejected.

Clear cloud account data removes financial records and restores default categories/PHP after confirmation. It does not delete the login account, import receipts, or original browser backup. Browser-storage removal is a separate browser action; save the local backup first if needed.

## Vercel

Keep the Vite preset, build command `npm run build`, output `dist`. In Project / Settings / Environment Variables add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Set Production and only the Preview/Development environments you intend to connect. Prefer staging Supabase for previews. Redeploy after changing variables because Vite reads them at build time. Add the corresponding origins to the Auth allowlist. No Laravel server, Vercel function, or separate API deployment is needed.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

`npm test` runs existing finance tests and local/mock tests for account transitions, data/UUID mapping, backup preservation, fingerprints, response verification, session-bound requests, and persistence failures.

Additional checks:

- **SQL isolation:** run `supabase/tests/isolation.sql` in a disposable/staging SQL Editor or with `psql -v ON_ERROR_STOP=1 -f supabase/tests/isolation.sql`. Two transactional fixtures test owner isolation, dependencies, atomic rollback, duplicate imports, and stale revisions, then roll back.
- **Local PostgreSQL:** install `@electric-sql/pglite` in a temporary tooling directory. Set `PGLITE_MODULE_PATH` to its `node_modules/@electric-sql/pglite`, then run `node tests/postgres-local.cjs`. This uses simulated `auth.users`/`auth.uid()`, not live Supabase.
- **Mock browser:** install Playwright in a temporary tooling directory. Set `PLAYWRIGHT_MODULE_PATH` to its `node_modules/playwright` and optionally `CHROME_PATH` to Chrome. Start Vite on port 5174 with dummy process variables `VITE_SUPABASE_URL=https://dinero-test.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_browser_test`. Run `node tests/browser-cloud.cjs`. All Supabase requests are intercepted. Never deploy dummy values. Checks cover auth, save failure/retry, migration/deduplication, account switching, five pages, and both forms on desktop/mobile. Screenshots go to the OS temporary directory.
- **Live Supabase:** create two empty confirmed disposable accounts in a staging Auth dashboard. Set shell variables `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD` (never `VITE_` passwords). With `.env.local` configured, run `node --env-file=.env.local tests/live-supabase.mjs --confirm-disposable`. This signs in through real Auth and tests all-table isolation, ownership mutation, foreign keys, and anonymous denial. It refuses nonempty accounts and cleans up its fixtures. Never commit/log test passwords. Remove the test accounts afterward.

### Implementation-environment results

TypeScript, lint, finance/cloud tests, production build, mocked browser checks, and local PGlite SQL isolation passed. **No live Supabase credentials were available:** remote migrations, production connectivity, real email delivery, and live two-account isolation were not tested. Run these against staging before production rollout.

## Limits and changed files

Cloud access requires a connection; this is not offline-first or realtime collaborative. Reload to fetch another device's changes. App writes have revision protection; direct SQL/REST edits outside the app should be followed by reload. Snapshots/imports are capped at 5 MB server-side. Money remains integer minor units with PHP default; currency preference does not convert amounts.

Changed areas: `src/auth/`, `src/lib/supabase.ts`, `src/services/`, `src/hooks/useData.ts`, `src/components/LocalMigration.tsx`, `src/components/SaveStatus.ts`, `src/components/Modal.tsx`, `src/App.tsx`, `src/main.tsx`, `src/types/index.ts`, `src/utils/storage.ts`, and auth styles in `src/index.css`. SQL is in `supabase/migrations/`; tests are in `tests/` and `supabase/tests/`. Environment/package files and this README complete setup.

Official references: [password authentication](https://supabase.com/docs/guides/auth/passwords), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions).

## Phase 5: Analytics and filtering

The dashboard and Transactions share ten date presets, including an applied custom range. Transactions combine date, type, category, search, inclusive minimum/maximum amounts, and date/amount sorting. Clear filters restores this month and the default sort. Filters and chart selections are transient UI state and never save financial data.

Dashboard additions:

- Income versus expenses with bar/line views and daily, weekly, or monthly grouping.
- Expense categories with donut/bar views, amounts, percentages, and category drilldowns.
- Spending over time, highest spending day, lowest active spending day, and daily average.
- Income sources, top five expense categories, and deterministic financial insights.
- Optional previous-period comparisons for income, expenses, and net balance, showing absolute and percentage changes.
- Keyboard-accessible chart interval selection and links to matching transactions.

Date boundaries are inclusive and weeks start Monday. Current week/month/year stop today; daily averages include elapsed zero-spending days. This month compares with the same elapsed dates last month, this year with the same elapsed dates last year, and this week with the same weekdays last week. Shorter prior months clamp to their last day. Last month compares full calendar months; rolling/custom periods compare the immediately preceding equal number of days. Percentage change uses the absolute prior amount; a zero prior baseline shows no percentage instead of infinity. Monthly budget usage is explicitly separate and covers the whole selected month through today.

Implementation: `src/utils/analytics.ts` owns pure calculations; `DateRangeFilter.tsx`, `DashboardAnalytics.tsx`, `TimeSeriesChart.tsx`, and `CategoryBreakdown.tsx` in `src/components/` render the shared controls and responsive charts. `src/App.tsx` connects dashboard drilldowns and transaction filters; `src/index.css` reuses the existing visual system. No chart dependency, database migration, authentication change, or persistence change was added.

Validation: `npm test` includes `tests/analytics.cjs` for exact totals, date/leap/year boundaries, comparisons, zero baselines, grouping, categories, combined filters, sorting, PHP formatting, empty/income-only data, and nonmutation. The mocked browser suite also checks chart switches/drilldowns, filters without cloud writes, existing auth/CRUD flows, all five pages and both forms at 320, 390, 768, 1024, and 1440px. TypeScript, lint, tests, production build, and these browser checks passed. Live Supabase was not exercised for this phase.

Limits: custom analytics ranges end no later than today and cover at most 3,660 days. Analytics calculate from the currently loaded account snapshot; reload to include changes from another device. Monetary totals remain integer minor units; displayed averages round to the nearest minor unit. Charts use native SVG/CSS with exact values available through interval controls and category rows.
