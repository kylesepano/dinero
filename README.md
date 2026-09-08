# dinero

A personal income and expense tracker built on the existing React + TypeScript + Vite template, with Tailwind CSS and Lucide icons. No backend, authentication, or external API.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Checks and deployment

```sh
npm test
npm run lint
npm run build
npm run preview
```

For Vercel, use the Vite preset, build command `npm run build`, and output directory `dist`.

## Features

- Dashboard with month selection, calculated summaries, category chart, and recent transactions.
- Add, edit, delete, search, filter, and sort transactions.
- Manage income and expense categories; categories in use cannot be deleted or change type.
- Independent monthly budgets with live progress and spending warnings.
- PHP by default, plus USD, EUR, and SGD display preferences. Changing currency does not convert amounts.
- Validated JSON backup export/import, local reset, and malformed-storage recovery.
- Responsive navigation, keyboard-accessible native dialogs, and labeled forms.

The initial workspace contains explicitly labeled demo records. Use **Start fresh** before recording personal transactions. An empty saved workspace stays empty after refresh. Changes persist under `dinero:v1` in browser localStorage; no data syncs between browsers or devices. Export backups regularly. Storage failures are shown in the app, and malformed stored content is preserved until the next explicit change.

Money is stored in integer minor units. Dates use local calendar strings to avoid timezone shifts. Types, defaults, persistence, calculations, and modal behavior are separated under `src/types`, `src/data`, `src/utils`, `src/hooks`, and `src/components`; page composition and forms live in `src/App.tsx`.
