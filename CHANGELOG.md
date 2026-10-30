# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Supabase Auth with email + password (no email confirmation), Google and GitHub OAuth, and an OAuth callback at `/auth/callback`.
- `/sign-in` and `/sign-up` pages with Zod-validated Server Actions (`useActionState`) and Spanish error messages.
- Root `proxy.ts` that refreshes the Supabase session, protects `/dashboard/*` (redirecting to `/sign-in?next=<path>`) and sends signed-in users away from the auth pages. `next` only accepts internal paths to prevent open redirects.
- Supabase CLI project (`supabase/`) and the first migration: `profiles` and `workspaces` tables with RLS, a single Personal workspace per user, and an `on_auth_user_created` trigger that creates the profile and Personal workspace on sign-up.
- Generated database types in `src/types/database.ts` and typed Supabase clients for the browser, the server and the proxy (`src/libs/supabase/`).
- shadcn/ui (Radix, `radix-nova` style) on Tailwind 4, with `cn` in `src/libs/utils.ts`.
- Light / Dark / System theme with `next-themes` (System by default).
- Dashboard layout with an aside: Personal / Empresa workspace tabs, Personal navigation and a user menu (name, email, theme toggle, sign out).
- "Coming soon" placeholder pages for the 7 Personal sections and an empty state for the Empresa workspace.
- `SITE.routes` entries for the dashboard workspaces and the OAuth callback, and `SITE.navigation.personal`.
- Migration `create_categories_and_transactions`: `categories` and `transactions` tables with RLS, the reusable `is_workspace_owner()` and `set_updated_at()` functions, a `check_transaction_category` trigger (same type and same or system workspace), 12 seeded system categories and the `transaction_totals` RPC (`security invoker`).
- Personal transactions page at `/dashboard/personal/transactions`: URL-driven pagination (20 per page), month / type / category / text filters, income, expense and balance totals for the whole filtered period, create/edit dialog, delete confirmation and empty states.
- Custom categories per workspace (create, rename, change icon and color, archive, restore) managed from a "Categorías" sheet, with a curated lucide icon set and a fixed color palette.
- "Nuevo movimiento" quick-add button in the dashboard header, shown only on `/dashboard/personal/*`.
- `formatCurrency()` / `formatDate()` (`es-CO`), `America/Bogota` date helpers and `getPersonalWorkspace()`.
- shadcn/ui components: `dialog`, `alert-dialog`, `select`, `table`, `popover`, `calendar`, `textarea`, `badge`, `pagination`, `toggle` and `toggle-group`, plus `react-day-picker` and `date-fns`.
- Global `<Toaster />` (sonner) in the root layout.
- Migration `create_report_functions`: `monthly_totals` (fills empty months with zeros), `category_totals` and `workspace_balance` RPCs (`security invoker`, executable only by `authenticated`).
- Personal summary page at `/dashboard/personal`: income, expense and balance cards with change vs. the previous month, savings rate, daily average spend, month-end spend projection, top expense category, all-time balance and transaction count, a 6-month income vs. expense chart, an expense-by-category donut (top 6 + "Otras") and the 5 latest transactions.
- Personal reports page at `/dashboard/personal/reports`: URL-driven period picker (month, quarter, year or a range of up to 24 months), Gastos/Ingresos toggle, monthly trend with a balance line, category donut, top 5 categories bar chart and a per-category summary table linking to filtered transactions.
- shadcn/ui `chart` component with `recharts` (exact version), charts with `aria-label`, a screen-reader data table and keyboard-navigable tooltips.
- `CATEGORY_CHART_COLORS` and per-theme `--category-*`, `--income`, `--expense` and `--balance` CSS variables, so chart colors match category badges in light and dark mode.
- Empty states and skeletons for the summary and reports pages.
- Migration `create_recurring_expenses_and_budgets`: `recurring_expenses` (monthly or yearly, pausable) and `budgets` (one per expense category and month) tables with RLS, optional `recurring_expense_id` / `recurring_due_on` columns on `transactions` with a unique index per occurrence, `check_expense_category` and `check_transaction_recurring` triggers, and the `recurring_occurrences` and `budget_progress` RPCs (`security invoker`, executable only by `authenticated`).
- Budgets page at `/dashboard/personal/budgets` with URL-driven tabs (`?tab=budgets|recurring`) and month navigation (`?month=YYYY-MM`).
- Budgets tab: budgeted, spent and remaining cards, per-category progress bars with pending recurring payments as a striped segment, "Cerca del límite" (≥ 80 %) and "Excedido" (≥ 100 %) alerts, create/edit/delete, "Copiar del mes anterior" (only creates missing budgets) and a "Sin presupuesto" section.
- Recurring expenses tab: "Próximos pagos" (current month plus unpaid occurrences from the previous 2 months) with Pagado / Vencido / Hoy / Próximo status, and a list to create, edit, pause/resume and delete recurring expenses.
- "Marcar como pagado" opens the transaction dialog prefilled and linked to the occurrence; paying the same occurrence twice is rejected ("Este pago ya está registrado").
- "Próximos pagos" and "Presupuestos en riesgo" cards on the Personal summary.
- Empty states for both budgets tabs and both summary cards, and a shared `EmptyState` component.
- Migration `create_savings_goals`: `goal_status` enum, `savings_goals` and `goal_contributions` tables with RLS (no `delete` policy on goals, which can only be archived), a composite `(goal_id, workspace_id)` foreign key so a contribution always belongs to its goal's workspace, `check_goal_contribution` (goal must be active, goal cannot change, date ≤ today in `America/Bogota`) and `check_goal_balance` (a goal's balance never goes negative) triggers, and the `goal_progress` RPC (`security invoker`, executable only by `authenticated`).
- Savings goals page at `/dashboard/personal/goals`: create and edit goals (name, target amount, optional target date, icon and color), active goal cards sorted by target date with progress, remaining amount, suggested monthly contribution and "En camino" / "En riesgo" status, "La fecha objetivo ya pasó" and "¡Lo lograste!" notices, and a collapsible "Cumplidas y archivadas" section with "Reactivar".
- Goal sheet with a summary, "Aportar" / "Retirar" and a contribution history with edit and delete. Completed and archived goals are read-only. Contributions are independent from transactions and do not change the balance, expenses or budgets.
- "Metas de ahorro" card on the Personal summary with up to 3 active goals, nearest target date first.
- Empty states for the goals page, the inactive section, the contribution history and the summary card.
- shadcn/ui `collapsible` component.
- Migration `create_debts`: `debt_kind`, `debt_status`, `rate_type` and `debt_entry_kind` enums, `debts` (credit cards, loans and receivables) and `debt_entries` (payments and balance adjustments) tables with RLS (no `delete` policy on debts, which can only be archived), a composite `(debt_id, workspace_id)` foreign key, the "Deudas" (expense) and "Cobros" (income) system categories, and the `check_debt_update`, `check_debt_entry`, `check_debt_balance` and `sync_debt_entry_transaction` triggers.
- `debt_overview` RPC (balance and payment cycle per debt) and `record_debt_payment` RPC (payment and its optional transaction in one transaction), both `security invoker` and executable only by `authenticated`.
- Debts page at `/dashboard/personal/debts` with URL-driven tabs (`?tab=debts|receivables`).
- "Debo" tab: total debt, global card utilization and estimated monthly interest, "Próximos pagos" with Vencido / Pagado / Hoy / Pendiente status, debt cards sorted by next due date with balance, rate (E.A. or M.V.), utilization or paid percentage, next payment and a payoff projection, create/edit dialog, "Marcar como pagada", archive with confirmation and a collapsible "Pagadas y archivadas" section with "Reactivar".
- "Me deben" tab: "Te deben" total, receivable cards with collected percentage, expected date and "Vencida" label, create/edit dialog and a collapsible "Cobradas y archivadas" section.
- Debt sheet with details, full payoff projection (months, payoff month and total interest), a "Si pagaras X al mes" simulator, "Registrar pago" / "Registrar abono", "Actualizar saldo" and an editable history. Paid, collected and archived debts are read-only.
- Loan payments and receivable collections can create their transaction ("Registrar como gasto" / "Registrar como ingreso", checked by default); credit card payments never do. Editing or deleting a linked payment updates or deletes its transaction.
- "Deudas" card on the Personal summary with total debt, card utilization and up to 3 upcoming payments, overdue first.
- Empty states for both debts tabs, the inactive sections, the payment history and the summary card.
- Migration `create_score`: `dismissed_recommendations` table with RLS (`select`, `insert` and `delete`, no `update`) and a `check` on the 10 rule keys, plus the `score_monthly_inputs`, `score_weekly_activity` and `score_balances` RPCs (`security invoker`, executable only by `authenticated`).
- Financial health score from 0 to 100, computed on the fly from 7 weighted factors (savings rate, debt-to-income, emergency cushion, budgets, card utilization, goals and regularity). Factors without data are excluded and the remaining weights are rescaled; months without enough data show "Sin datos suficientes" with the missing reasons.
- Rule-based recommendation engine with 10 rules (deficit, category growth, exceeded budget, goal at risk, high card utilization, highest rate first, overdue payment, low cushion, unbudgeted spending and irregular records), sorted by severity and amount, each with its evidence and a link to where it is resolved.
- Recommendations page at `/dashboard/personal/recommendations`: score with band (Débil / Regular / Bueno / Excelente), change vs. the previous month and calculation date, per-factor breakdown, 12-month history chart with gaps, recommendation list with "Ocultar este mes" and a collapsible "Ocultas este mes" section with "Mostrar de nuevo".
- "Salud financiera" card at the top of the Personal summary with the score, band, change and the top 3 recommendations.
- Empty states for the recommendations page and card ("Todo en orden por ahora", "Aún no hay histórico").
- "Score y recomendaciones" section in `docs/producto.md` with the period, factors, weights, curves, bands, rules and history approximation.
- Migration `create_imports`: `import_status` enum, `imports` table with RLS (`select` only, no write policies), `transactions.import_id`, the `import_transactions` and `undo_import` RPCs (`security definer`, owner check, `search_path = ''`) and the `transactions_for_duplicates` RPC (`security invoker`), all executable only by `authenticated`.
- Transaction import at `/dashboard/personal/import`: a 6-step wizard (file → table → columns → categories → preview → summary) for `.xlsx` (one or several sheets) and `.csv` files up to 5 MB and 2,000 rows. The file is read in the browser with `read-excel-file` and `papaparse` (exact versions, loaded with dynamic `import()`); only the mapped rows reach the server.
- Automatic table detection per sheet (header row, column range, several tables per row, end after 3 empty rows) with manual adjustment, and multi-sheet imports that reuse the first sheet's mapping and exclude sheets whose headers don't match.
- Column mapping with header-based suggestions, 3 type modes (value column, amount sign, income/expense columns), value mapping for the type column, Excel dates, Excel serial numbers, DD/MM/YYYY, MM/DD/YYYY and YYYY-MM-DD text dates, and es-CO / en-US amounts.
- Category mapping per (type, source value) pair to an existing category, a new one or "No importar".
- Preview with per-row validation, duplicate detection against existing transactions and earlier rows of the same file (unchecked by default), status filter, 100-row pages and per-row checkboxes; saved all-or-nothing, with a summary of imported, skipped, duplicate and error counts.
- Import history with "Deshacer" (always available, confirms with the number of transactions, also deletes edited ones and keeps the created categories).
- "Importar" buttons on the transactions page and its empty state.
- "Importar" section in `docs/producto.md`, and the SPEC 08 answers plus the SPEC 08b and "Cuentas y métodos de pago" entries in `ROADMAP.md`.

### Changed

- shadcn `pagination` uses `next/link` and Spanish labels.
- Transaction and recurring expense actions revalidate the whole Personal workspace (summary, transactions, budgets and reports) instead of only refreshing the current page.
- The transaction dialog accepts prefilled values and an occurrence link, and locks the type to expense for recurring payments.
- The icon and color picker from the categories sheet is now a reusable `IconColorPicker` component, shared with savings goals.
- The debts placeholder page is replaced by the debts page, and `revalidatePersonalPages()` documents that it also refreshes `/dashboard/personal/debts`.
- The recommendations placeholder page is replaced by the score and recommendations page.
- `serverActions.bodySizeLimit` is raised to `2mb` so a 2,000-row import fits in one Server Action request.

### Fixed

- `Metadata` / `Viewport` were imported as default exports from `next`, which broke type checking.
- The transactions page read the current date before the session, which made Next.js reject `new Date()` while prerendering when the URL had no `month`.

## [0.1.0] - 2026-10-29

### Added

- Project bootstrapped with Next.js 16 (App Router, Cache Components, `typedRoutes`), React 19, TypeScript 6 and Tailwind CSS 4 via `@tailwindcss/turbopack`.
- `SITE` config object (`src/config/site.ts`) as the single source of brand, author, repository, routes, workspaces (Personal / Empresa), features and SEO defaults.
- SEO layer in `src/libs/seo.ts`: `buildMetadata()` (canonical, robots, Open Graph, Twitter Card) and JSON-LD builders for `WebApplication`, `WebSite`, `Person` (author) and `BreadcrumbList`, rendered through `<JsonLd />`.
- Metadata routes: `robots.txt` (blocks `/dashboard/`, `/api/`, `/auth/`), `sitemap.xml` and `manifest.webmanifest`, all sourced from `SITE`.
- Tooling: ESLint (`eslint-config-next` + `eslint-config-prettier`), Prettier with import sorting and Tailwind class sorting, and a CI workflow running `check`, `eslint`, `prettier:check` and `build` on every push/PR to `main`.
- GitHub templates: bug report and feature request issue forms, pull request template and Dependabot config.
- Documentation: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/producto.md` and MIT `LICENSE` crediting Angel De La Torre (Angel DM).
- `.env.example` documenting `NEXT_PUBLIC_SITE_URL` and the Supabase variables.

### Removed

- `create-next-app` starter assets (`public/*.svg`) and the default README.

---

## Version Support

- **Current version**: 0.1.0
- **Node.js**: >= 24.19.0
- **pnpm**: >= 12.16.1
- **Next.js**: 16.4.3
- **Tailwind CSS**: v4
