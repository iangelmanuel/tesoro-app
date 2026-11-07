# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Monthly Excel and CSV export (SPEC 32).
  - An **Exportar** button in the header of Personal and business **Reportes** opens a dialog to download an `.xlsx` workbook or a `.csv` of movements for a month, quarter, year, month range or the whole history (up to 36 months per file). It is prefilled with the Reportes period, shows how many month sheets will be created, warns that the file has real amounts when **Ocultar montos** is on, and keeps the dialog open with an error toast if the download fails. Icon-only (44 px) under 640 px.
  - The workbook has a **Resumen** sheet comparing the months, one sheet per month (`Octubre 2026`, oldest first; the current month says "(en curso)" and goes up to today) with stacked sections, and a flat **Movimientos** sheet with a frozen header and autofilter. Personal months include the month summary, balances per account, recurring incomes and expenses, budgets, goals, debts and cards, receivables and movements (with transfers); empty sections 3–8 are skipped. Business months include the summary, balances per account, costs by category, sales, costs and transfers.
  - Totals and month summaries are A1 formulas (`SUM`, `SUMIFS`, cross-sheet references) with stored results, so editing an amount recalculates and viewers without a calc engine still show numbers. Real Excel dates (`dd/mm/yyyy`), COP amounts (`"$" #,##0`), income in green, expenses in red, transfers in grey, the Tesoro logo and A4 portrait print setup with page numbers.
  - Report-style presentation: sheets hide gridlines, so only tables have borders. Each table is a framed block (thick border in the workspace color outside, thin grey inside) with a merged title band (large white text on the workspace color), light-tinted column headers, zebra rows and a tinted bold total row, all AA. Only title bands, the empty-month notice and the sheet header are merged; data and totals never are. Column widths fit their content, and the **Movimientos** title band and headers stay frozen and repeat on every printed page.
  - The CSV has the same rows and columns as **Movimientos**: UTF-8 with BOM, `;` separator, `\r\n` line breaks, `YYYY-MM-DD` dates and formula-injection escaping (`=`, `+`, `-`, `@`, tab and CR get a leading apostrophe), built with `papaparse`.
  - New Route Handler `GET /api/export/[workspaceId]` (session + RLS, JSON errors 401/404/400, `Cache-Control: no-store`, file name `tesoro-<workspace>-<period>.<ext>`). Workspaces marked for deletion can still be exported. Queries are paginated in pages of 1000 rows.
  - Migration `account_balances_by_month` (plus `account_balances_by_month_cut_at_to`): opening, inflow, outflow and closing balance per account and month, with the same rules as the Cuentas balance; the last month stops at `p_to`.
  - New dependency `exceljs` 4.4.0, used only on the server. `pnpm brand:assets` now also writes the workbook logo as base64 (`src/features/exports/workbook/logo-data.ts`).

- Grouped aside and resizable width (SPEC 31).
  - The aside groups its sections: Personal shows **Día a día** (Resumen, Movimientos), **Tu plan** (Cuentas, Ingresos fijos, Gastos fijos, Presupuestos, Metas, Deudas) and **Entiende tu dinero** (Reportes, Recomendaciones); a business shows **Día a día**, **Tu operación** (Cuentas, Ajustes) and **Entiende tu negocio** (Flujo de caja, Reportes, Recomendaciones). Each group has a title and its own list labelled by it, separated by space only. **Ingresos fijos** now comes before **Gastos fijos**. The sidebar skeleton shows three titled blocks.
  - `SITE.navigation.personal` and `.business` are now arrays of `{ label, items }` groups; the bottom nav, the header title and the landing use the new `flattenNav` helper (`src/components/dashboard/nav.ts`).
  - On desktop the aside width can be changed by dragging its right edge (240–360 px, 256 by default), double-clicking to reset, or with the keyboard (`←` / `→` by 16 px, `Home` / `End`) through the new `SidebarResizeHandle` (`role="separator"`). The width is stored in the `tesoro-sidebar-width` cookie and read on the server, so the first render already has it. The mobile drawer keeps its width.
  - The `aside-sections` tour step now explains the three groups.

- Recurring incomes and quick movement (SPEC 30).
  - New **Ingresos fijos** page (`/dashboard/personal/recurring-income`, right after **Gastos fijos** in the aside) to define salary, rent received, projects or investments with an expected amount, income category, optional default account and a frequency: monthly, biweekly (two configurable days, 15 and 30 by default), yearly or **Sin fecha fija**. Days missing from a month fall on its last day.
  - **Próximos ingresos** lists this month's occurrences plus unreceived ones from the 2 previous months with **Recibido**, **Pendiente**, **De hoy** or **Atrasado** status. **Marcar recibido** (on the oldest unreceived occurrence of each source) opens the movement dialog on Ingreso, prefilled and linked. **Sin fecha fija** sources show what was received this month and year. Amounts respect hidden figures.
  - The Personal Ingreso tab starts with an **Ingreso fijo** select (**Otro ingreso** by default). Picking a source prefills amount, category and account (only untouched fields) and the server links the income to its oldest unreceived occurrence, or to the source alone when there is none or it has no schedule. Editing from Movimientos keeps, changes or removes the link.
  - The movement dialog gets a **Meta** tab (goal contributions and withdrawals) and the tab order becomes Gasto, Ingreso, Traspaso, Deuda, Gasto fijo, Meta in Personal and Venta, Costo o gasto, Traspaso in Business. The active tab scrolls into view on narrow phones.
  - The phone **+** sheet now has just **Movimiento rápido** (the same dialog as the desktop **+**, all tabs, Gasto by default), **Categorías** and **Verificar movimientos** in both workspaces. The loose actions and `PayOccurrenceDialog` were removed, and the tour steps about the **+** button now mention **Movimiento rápido**.
  - Migration `create_recurring_incomes`: `income_frequency` enum, `recurring_incomes` table with RLS and grants, `transactions.recurring_income_id` / `recurring_income_due_on` with a unique index per occurrence, the `check_recurring_income` and `check_transaction_recurring_income` triggers, `is_recurring_income_due_date` and the `recurring_income_occurrences` RPC.

- Partial payments and installment history for monthly receivables (SPEC 29).
  - An installment accepts several collections. It is **Pagada** once they add up to its value; with less it shows **Abonada**, how much was collected, what is missing and an **Abonar** button prefilled with the remainder. Past-due partial installments count in the overdue badge.
  - Open-ended monthly receivables keep the installment value over time in `receivable_installment_history` ("until this month it was worth X"). Editing the monthly amount stores the previous value through last month, so past months are not left short.
  - The card shows **Por cobrar a la fecha** (what is missing up to the current month) and "Te deben" now adds it for open-ended receivables.
  - Migration `receivable_partial_payments`: replaces the unique `debt_entries_one_payment_per_period` index with the non-unique `debt_entries_period` and creates `receivable_installment_history` with RLS, grants and the `check_receivable_installment_history` trigger.
- Monthly receivables (SPEC 28): **Me deben** can now track someone who pays a fixed amount every month, besides the one-off receivable.
  - The receivable dialog has **Una vez | Mes a mes** tabs when creating (`schedule`, fixed after creation). Monthly asks for the monthly amount, payment day (1–31), start date and an optional number of installments (empty = open-ended). With installments, the opening balance is amount × installments; open-ended receivables have no total balance and stay out of "Te deben".
  - The receivable sheet lists one installment per month, from the start month to next month or the last installment (extended to any installment collected in advance), with **Pagada**, **Pendiente** or **Atrasada** status computed on the fly (`receivable-schedule.ts`), the due date (clamped to the month's last day) and the collection date and amount. Shows the last 12 with **Ver más**.
  - **Marcar pagada** opens the collection dialog with the monthly amount prefilled (editable), creating the debt entry and the income like any collection. Editing or deleting the collection (from the sheet or Movimientos) puts the installment back to its computed status. Monthly receivables drop the loose "Registrar abono" and "Actualizar saldo" actions.
  - The card shows the monthly amount, the next installment and an overdue-installments badge. With installments, the last collection brings the balance to 0 and it can be marked as collected; open-ended ones stay active until archived.
  - The monthly form keeps the start date and payment day on one row, picks the duration with **Sin fin | Con cuotas** and shows a live summary (first installment date, last installment month and total).
  - The debt dialog's interest rate label now sits above both the rate input and its E.A. / M.V. toggle, so it no longer wraps into three lines.
  - Migration `monthly_receivables`: `receivable_schedule` enum, `debts.schedule` and `debts.starts_on` (existing receivables become `once`), a named per-kind check `debts_kind_fields_check`, `debt_entries.period_on` with a unique index per debt and month, updated `check_debt_update`, `check_debt_entry` and `check_debt_balance` triggers, a `p_period_on` parameter on `record_debt_payment` and `schedule` / `starts_on` in `debt_overview`.
- Guided tours with Driver.js for the 9 Personal sections (SPEC 27): Resumen, Movimientos, Cuentas, Gastos fijos, Presupuestos, Metas, Deudas, Reportes and Recomendaciones.
  - A section's tour starts on its own after the first render until it is finished. It waits while a dialog or sheet is open (such as the phone quick-actions sheet) and while the page is still loading. Finishing the last step marks it completed; closing it halfway (X, Escape or clicking outside) does not, so it starts again on the next visit.
  - Steps live in `src/config/tutorials.ts` and point to `data-tour` attributes, never CSS classes. Steps can be desktop-only or phone-only, and a step whose element is not on screen is skipped.
  - A `?` button in the header (next to the eye, only in those 9 sections) replays the current section's tour. Account → Preferences gets a **Tutoriales** card with each section's status, **Ver de nuevo** and **Reiniciar todos**.
  - Spanish buttons (Anterior / Siguiente / Terminar), "Paso X de Y" counter, focus trapped in the popover, Escape to close and no animation with reduced motion. The popover is themed with the design tokens and the workspace accent (AA measured in light and dark, `tour-theme.css`).
  - `driver.js` 1.10.2 is loaded with a dynamic `import()` only when a tour starts, so it is not in the dashboard's initial bundle.
  - Migration `create_tutorial_progress`: `tutorial_progress` table with one row per completed section (no row means pending) and owner-only RLS, plus `grant_tutorial_progress`, which grants `select`, `insert`, `update` and `delete` to `authenticated` (new tables no longer get those privileges by default). Progress is read in the dashboard layout and shared through `TutorialProvider`, with `completeTutorialAction` and `resetTutorialsAction`.
- Extra payments ("Abono") on credit cards and loans (SPEC 26): new **Abono** tab in the payment dialog (Pago · Abono · Avance on cards, Pago · Abono on loans), in every entry point (debt sheet, **Más → Pago de deuda**, phone quick-actions sheet and the **Deuda** tab of the movement dialog). An extra payment lowers the balance like any payment but does not cover the cycle's minimum payment or installment, so the next payment stays "Pendiente". Editing a payment can switch it between Pago and Abono. Migration `debt_extra_payments` adds `debt_entries.is_extra_payment`, a `p_is_extra_payment` parameter to `record_debt_payment` and excludes extra payments from the cycle sums in `debt_overview`. History, Movimientos and toasts label them "Abono".
- Edit linked payments from Movimientos (SPEC 26):
  - Gray rows (card payments and advances, goal contributions and withdrawals) now have Edit and Delete, on desktop and phone. They open the debt's `PaymentDialog` or the goal's `ContributionDialog` in edit mode and delete with `deleteEntry` / `deleteContribution`, so the card balance and goal progress follow. They still stay out of the totals.
  - A loan payment or receivable collection movement opens its debt entry's `PaymentDialog` (the entry is the source of truth; the existing trigger syncs the movement) and deleting it removes entry and movement together. `getTransactions` now returns the linked `debt_entry` and the parent `debt_id` / `goal_id` of gray rows.
  - Migration `realign_debt_entries_with_transactions`: aligns debt entries whose amount, date or time drifted from their linked movement (edited from Movimientos before this change), taking the movement's values. Rows that would break a trigger are reported with `raise notice` and left untouched.

- UI fixes and faster entry (SPEC 25):
  - **Categorías** and **Verificar movimientos** in the header **Más** menu on every page of a workspace, and at the end of the phone quick-actions sheet. Business now has a **Más** menu with just those two. Both open over the current page and work with zero movements (`CategoriesSheet` and `VerifyMovementsDialog` are now controlled-only).
  - **Deuda** (payments and advances) and **Gasto fijo** tabs in the Personal "Registrar movimiento" dialog (`paymentTabs`), reusing the payment form (`DebtPaymentPanel`) and the linked recurring payment form (`OccurrenceSelect`). Hidden in Business, when editing and when paying a specific occurrence.
  - `CategorySelectField` and `AccountSelectField` (`src/components/forms/`) end with **+ Crear categoría** / **+ Crear cuenta**: the existing category or account dialog opens on top and the new one is selected without clearing the form. Used by every form with those selects (movement, transfer, recurring expense, budget, debt and receivable payments, goal contribution, Business) and added to the import mapping step. `createCategory` and `createAccount` now return the created row.
  - Debt, receivable and goal cards open their detail Sheet from anywhere on the card (stretched-link pattern: `SURFACE_ITEM_CLICKABLE`, `CARD_LINK`, `CARD_OVER_LINK`); the ⋮ menu stays separate. Only the hover and cursor change.

- Landing demo video (SPEC 24): a ~56 s product walkthrough of the real app (Resumen, Presupuestos, Metas, Deudas, Score and the Empresa cash flow) recorded with Playwright on a local demo account and composed with Hyperframes on an original macOS-style desktop (own wallpaper, menu bar, auto-hiding Dock with own icons, cursor-following camera; no Apple assets). New `#demo` section right after the hero (`demo-section.tsx`, `demo-player.tsx`): poster until play, no autoplay, `preload="none"`, always-light frame, accessible description, keyboard play/pause. "Demo" link in the header.
- Five short feature clips (Registros, Gráficas, Recomendaciones, Score, Personal y Empresa) shown in a tabbed feature tour (`feature-tour.tsx`, `feature-clip.tsx`): muted loops that only play while on screen and stay on their poster with reduced motion or Save-Data. Videos live in `public/videos/` as MP4 + WebM + WebP poster (1080p, two-pass, ≤ 25 MB in total); paths come from the new `SITE.landing` block.
- `buildVideoSchema()` in `src/libs/seo.ts`: `VideoObject` JSON-LD with absolute URLs, injected on `/`.
- Hero 3D scene "cada registro suma" (`hero-scene.tsx`, React Three Fiber without drei): scattered blocks assemble into the logo's chest, then breathe and part slightly around the pointer. Colors come from `--brand`/`--income` and follow the theme. Lazy-loaded (`hero-scene-loader.tsx`) only from 768 px, without reduced motion or Save-Data, after `requestIdleCallback` and while the hero is visible; rendering stops off screen; `hero-visual.tsx` remains the fallback.
- Landing motion: one-time CSS reveals driven by a single `IntersectionObserver` (`reveal.tsx` markup, `reveal-observer.tsx`; content visible on load is never hidden), staggered lists, pressable CTAs (`.press`), scroll-linked factor bar and clip settle (`animation-timeline: view()`), and a CSS hero entrance. `motion` (`LazyMotion` with async features, `MotionConfig reducedMotion="user"`) is used only for the demo player and feature tour. Nothing is hidden with reduced motion or without JS.
- Landing load trimmed for Lighthouse: `ToastProvider` moved to the dashboard layout, auth links with `prefetch={false}`, lazy mobile nav drawer and a native `SiteThemeToggle` in the public header, lazy video posters.
- Header GitHub link with the repository's star count, fetched on the server with `"use cache"` + `cacheLife("hours")` (`src/libs/github.ts`, `github-stars.tsx`); the browser never calls GitHub.
- `DESIGN.md` and `.impeccable/design.json`, generated from the shipped code after the Impeccable critique, polish and audit of the landing.
- Gastos fijos and Presupuestos as separate screens (SPEC 23): new `/dashboard/personal/recurring` route (upcoming payments and the recurring expenses list) and `/dashboard/personal/budgets` for budgets only. The Personal aside and drawer list **Gastos fijos** first, then **Presupuestos** (`SITE.navigation.personal`, `SITE.routes.personalRecurring`, `CalendarClock` icon). The old `/dashboard/personal/budgets?tab=recurring` URL redirects to the new route.
- Phone selector **Gastos fijos | Presupuestos** (`BudgetsAndRecurringTabs`, hidden from 768 px): the bottom bar keeps a single entry pointing to Gastos fijos, which is also marked active on Presupuestos. Each tab is its own route.
- Dark theme polish (SPEC 23): deeper, neutral backgrounds with the same hue as the light theme (background ≈ `#07080a`, card ≈ `#16171a`), more separated surface levels (secondary, tertiary, overlay, fields, separators) and elevation made of a 1 px top highlight plus a soft deep shadow, with no borders (`--surface-shadow` / `--overlay-shadow` in `.dark`). Dark audit findings are in `docs/ui.md`.
- Light theme elevation tokens `--surface-shadow` and `--overlay-shadow` (two layers, tinted with the foreground, never pure black); dark mode keeps no shadow. Light-mode audit findings are in `docs/ui.md`.

- Hide amounts (SPEC 22): an eye button in the dashboard header (and a switch in Account → Privacy sharing the same state) replaces balances and totals with `***`. The preference is stored in `profiles.hide_amounts` (migration `profiles_hide_amounts`, one value per user for Personal, Business and every device) and read on the server, so the first render is already hidden. `setHideAmountsAction` validates with Zod and the UI updates optimistically (`useOptimistic`).
- `Amount` component (single formatting point for balances and totals; the mask has `aria-label="Monto oculto"` and reserves the amount's width), `HideAmountsProvider` / `useHideAmounts`, `useFormatAmount` and `formatChartAmount` for SVG labels, chart axes, tooltips and screen-reader data tables. Applied to account, budget, goal, debt, cash flow and report balances and totals, KPIs (`StatCard`) and chart values. Movement rows, dialogs and forms keep showing real amounts.
- Account section split into an inner aside (SPEC 22): `/dashboard/account` redirects to `/dashboard/account/general`, with `security` (password and delete account), `privacy` and `preferences` (currency) routes, all `noindex`. Sections are configured in `SITE.account.sections`; on phones the aside is a horizontal list with 44 px controls.

- Account reconciliation (SPEC 21): a **Conciliar** button on every account card (Personal and Business) opens `ReconcileDialog` (a bottom sheet on phones). The user enters the real balance and a date (today by default, never in the future); the dialog shows the balance Tesoro calculates at that date and the difference, and **Crear ajuste** inserts an `account_adjustments` row for that difference (note "Conciliación con saldo real", no time, last position of the day). The difference is recalculated on the server (`reconcileAccountAction`, `requireWritableWorkspace`) and a difference of 0 is rejected. A non-blocking "Probablemente faltan movimientos por registrar" warning appears when the difference exceeds 5 % of the calculated balance or $50,000 (`SITE.reconciliation`).
- Opening balance date: `accounts.opening_balance_on` (nullable; null keeps the previous behaviour). The opening balance only counts from that date; earlier movements are summed anyway. The account dialog shows and edits it.
- Migration `account_reconciliation`: the `opening_balance_on` column, the `account_balance_at(p_account_id, p_on)` function (`security invoker`, `authenticated` only) and `account_balances` recreated to apply the date and return `opening_balance_on`.
- `getAccountBalanceAt` query and `getReconcileBalanceAction` (read-only) for the dialog; `formatCurrency` takes an optional `fractionDigits`; new `reconciliation` help hint.
- Negative-balance warning on `wallet` and `bank` account cards with a shortcut to **Conciliar**. The condition lives in the shared `isNegativeAccount` helper.
- `negative_account` recommendation in Personal (high severity, link to Cuentas), sharing the key, the condition and the `dismissed_recommendations` check with Business.

- Readable tables on phones, per-row action menus and a new bottom bar (SPEC 20). `ScrollTable` shows each table in full below 768 px and scrolls it horizontally, with an edge fade; nothing is pinned, so the actions column scrolls with the table. Descriptions wrap up to 3 lines instead of being cut off.
- `RowActions`: from 768 px a single three-dots `Dropdown` per row (destructive actions last, `danger` tone); on phones the same actions are inline 44 px buttons. Used in Movimientos, Gastos fijos, Presupuestos, debt entries and goal contributions. `DeleteDialog` is the shared controlled delete confirmation; `RecurringExpenseDialog` and `BudgetDialog` can now be controlled with `open` / `onOpenChange`.

- Optional time and manual order within a day (SPEC 19). Movements, transfers, account adjustments, debt entries and goal contributions get an optional `occurred_time` (local `America/Bogota` time, informational only) and a `day_position` integer. The list order is `occurred_on desc, day_position asc, created_at desc, id`; new rows enter with `day_position = 0` and stay on top of their day.
- Migrations `add_time_and_day_order` and `sync_debt_entry_time`: the new columns, the `reset_day_position` trigger (changing `occurred_on` resets the position to 0), `ledger_entries` exposing `occurred_time` and `day_position`, the `move_ledger_entry` RPC (`security invoker`, `authenticated` only; renumbers a whole day in one statement and rejects rows from another day), a trailing `p_occurred_time` parameter on `record_transaction`, `record_debt_payment`, `record_card_advance`, `record_goal_contribution` and `create_payment_transfer`, and `sync_debt_entry_transaction` copying the time to the linked movement. `check_debt_entry` and `check_goal_contribution` let through updates that only change time or day position, so rows of closed debts and inactive goals can be reordered.
- `@dnd-kit/react` 0.5.3 (exact version) as a direct dependency for the Movimientos table drag and drop.
- `TimePickerField` (next to the date in the movement, transfer, account adjustment, debt payment/advance, debt adjustment and goal contribution dialogs) and `formatTime` (`2:30 p. m.`); the time shows wherever the event date does, only when set.
- Drag and drop to reorder rows within the same day in the Movimientos table, from a subtle drag handle (⋮⋮) to the left of each row and with no arrow buttons (`useOptimistic`, rolled back with a toast on failure). It uses [dnd-kit](https://dndkit.com) (`@dnd-kit/react`: `useSortable`, `DragOverlay`), so it works with mouse, touch (press and hold the handle, 44 px tall on phones, so the table can still scroll) and keyboard (`Enter` or `Space` on the handle, arrows, `Enter` to drop, `Esc` to cancel), with screen reader announcements. A card with the row text follows the pointer while the rows reorder live with dnd-kit's animation; the rows of the same day are highlighted as the drop zone and the rest are dimmed. A row only interacts with the rows of its own day (`group`, `type` and `accept`). Includes transfers, adjustments, card payments, advances and goal contributions. Hidden while a text search is active, without write permission and for days with a single visible row.
- "Verificar" button and read-only dialog in Movimientos (Personal and Business): the full history without a month filter, 50 rows per page with "Cargar más", an optional account selector in Personal, and compact rows with a green/red/grey arrow plus accessible text.

- Automatic credit card maintenance fee (SPEC 17): a card can have an optional monthly **Cuota de manejo** and **Día de cobro** (1–31, both or neither, cards only). A daily `pg_cron` job (`charge-card-fees`, 00:10 America/Bogota) calls `charge_card_fees()` and adds a `fee` entry (`debt_entries.generated = true`) for every due date, falling back to the last day of short months. The fee raises the card balance and never touches an account or creates a movement, so reports, budgets and the score do not change. It can be edited or deleted like any entry.
- `debts.fee_charged_through` cursor: it moves to today when the fee is set or changed and when a paid or archived card is reactivated, so fees are never charged backwards and a deleted fee is not regenerated. `charge_card_fees()` is `security definer` with no grant to `anon` or `authenticated`; an error on one card does not stop the others.
- Migrations `add_debt_entry_fee` and `credit_card_maintenance_fee`: `fee` in `debt_entry_kind`, `fee_amount`, `fee_day` and `fee_charged_through` on `debts`, `generated` on `debt_entries`; `check_debt_entry`, `check_debt_balance`, `debt_overview` (now also returns the fee columns) and `score_balances` sum the fees.
- The card form has the fee fields with a help hint, the history shows "Cuota de manejo · automática", and the card Sheet shows "Próxima cuota".
- Payments from accounts (SPEC 16): paying a recurring expense, a loan or credit card, or contributing to a goal can now pick the account the money comes from, or none ("Fuera de cuentas"). New `PaymentAccountSection` (account select with today's balance, a "shortfall" notice and a "Traspasar fondos antes" switch with a source account and an editable amount).
- Credit card advances: `debt_entry_kind` gets `advance`, and the payment dialog has Pago / Avance tabs for credit cards. Card payments and advances, goal contributions and withdrawals move an account but are neither income nor expense, so reports, budgets and the score do not change; they appear read-only and grey in Movimientos (`ledger_entries` kinds `debt_payment`, `debt_advance`, `goal_contribution`) and under the "Traspasos" filter.
- Migrations `add_debt_entry_advance` and `payments_from_accounts`: `account_id` on `debt_entries` and `goal_contributions` (composite FK, partial indexes, `check_account_active`), and the RPCs `record_card_advance`, `record_goal_contribution` and `record_transaction`. `record_debt_payment` takes `p_account_id`, `p_transfer_from` and `p_transfer_amount`.
- A transfer made while paying is saved in the same transaction as the payment, so a failed payment leaves no transfer behind.
- Debt, goal and recurring-expense histories show "Desde <account>", "A <account>" or "Fuera de cuentas".

- Mobile experience (`< 768 px`, SPEC 15): a bottom quick-actions sheet (expense, income, goal contribution, debt or card payment and "mark recurring expense paid" in Personal; sale and cost in Business) that opens on every full load of a workspace route and after 5 or more minutes hidden, with an "Abrir al entrar" switch stored per device; a sticky Personal / Business tab under the header; and a bottom navigation bar with four destinations and a central [+] button. The aside drawer opens from the header menu button.
- `QuickActionsProvider` shares the quick-actions data (workspaces, goals, debts, unpaid recurring occurrences) between the header and the mobile sheet, and `useActiveWorkspace` resolves the workspace from the route.
- `PayOccurrenceDialog` to pick an unpaid recurring occurrence and pay it. `TransactionDialog` accepts an initial `type` in `initialValues` and can be controlled with `open` / `onOpenChange`.
- `SITE.navigation.mobile` with the bottom-bar destinations, and `src/hooks/use-is-mobile.ts` (`useIsMobile`, `MOBILE_QUERY`).
- Installable web app: a 512 px `maskable` icon generated by `pnpm brand:assets`, `id`, `orientation: "portrait"` and `start_url` `/dashboard/personal` in the manifest, plus `appleWebApp` and `viewportFit: "cover"`.

- "Traspaso" option in the new-movement dialog (next to expense/income, in Personal and Business) when the workspace has two or more active accounts: it saves a transfer between own accounts, not an income or expense. `TransferForm` is now exported from `transfer-dialog.tsx`.
- `src/components/dashboard/surface.ts` with the borderless surface classes for lists (`SURFACE_LIST`, `SURFACE_ROW`), lists inside a card (`CARD_LIST`, `CARD_ROW`), grid item cards (`SURFACE_ITEM`) and short notes (`SURFACE_NOTE`).
- HeroUI v3 (`@heroui/react`, `@heroui/styles` 3.2.7) as the UI library, imported directly with no Provider or wrappers. `react-aria` and `@internationalized/date` as direct dependencies.
- Theme on HeroUI tokens: black and blue-gray neutrals, a neutral primary outside the workspaces, emerald in Personal and orange in Business. `getWorkspaceTheme()` and `WorkspaceThemeRoot` set `data-workspace` from the route; overlays render inside it via `UNSAFE_PortalProvider` and dates use the `es-CO` locale via `I18nProvider`.
- `--brand` token (emerald-500) for the logo, so brand assets stay emerald on every theme.
- Own dashboard sidebar built with HeroUI primitives (`src/components/dashboard/sidebar/`), `DatePickerField` (`src/components/forms/`) and Recharts chart container, tooltip and legend with HeroUI surfaces (`src/components/charts/`).

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
- shadcn/ui `checkbox` and `radio-group` components, used by the import wizard.
- `.gitignore` excludes `*.xlsx` and `*.xls` so sample import files with real financial data are never committed.
- "Importar" section in `docs/producto.md`, and the SPEC 08 answers plus the SPEC 08b and "Cuentas y métodos de pago" entries in `ROADMAP.md`.
- Migration `import_recurring_debts_and_goals`: `import_target` enum and `imports.target`, `import_id` on `recurring_expenses`, `debt_entries` and `goal_contributions`, and the `import_recurring_expenses`, `import_debt_entries` and `import_goal_contributions` RPCs (`security definer`, owner check through an internal `create_import`, `search_path = ''`), executable only by `authenticated`.
- Import destinations in the wizard: transactions, recurring expenses, debt payments and adjustments, and goal contributions and withdrawals, one per import, chosen in step 1 or with `?target=`. Debts and goals without active items are disabled with a link to create one.
- Recurring expense imports: name, amount, category (expense only, with "Crear" and "No importar"), frequency values (monthly, yearly or skip), day of month or start date (one is enough), month as a number or Spanish name, and optional end date.
- Debt and goal imports with 3 type modes (value column, amount sign, all payments / all contributions), a fixed debt or goal for the whole file or a column mapped to active ones in a new "Deudas" / "Metas" step, future-date validation, resulting balances in the preview (import blocked if one would go negative) and an optional "Registrar también como gasto/ingreso" checkbox for loan payments and receivable collections.
- Per-destination duplicate detection: recurring expenses by normalized name, debt entries by debt, kind, signed amount and date, and goal contributions by goal, signed amount and date.
- "Importar" buttons on the recurring expenses tab, the debts page and the goals page, opening the wizard with their destination.
- Migration `create_accounts_and_transfers`: `account_kind` enum, `accounts` (unique name per workspace, archive only), `transfers` and `account_adjustments` tables with RLS, an optional `transactions.account_id`, composite `(account_id, workspace_id)` foreign keys, `check_account_active` and `seed_workspace_accounts` triggers, an "Efectivo" account backfilled in every workspace, the `ledger_entries` view (`security_invoker`, readable only by `authenticated`) and the `account_balances` RPC (`security invoker`, executable only by `authenticated`).
- Accounts page at `/dashboard/personal/accounts` with a "Cuentas" aside item: one card per active account with its type, balance as of today (red when negative) and "Con lo programado" when future rows change it, a "Saldo en cuentas" total, create/edit/archive/restore, "Actualizar saldo" (creates an adjustment for the difference with the real balance), "Ver movimientos" and a collapsed "Archivadas" section.
- Transfers between own accounts (create, edit, delete) from the accounts and transactions pages. Transfers and balance adjustments never count as income or expense.
- Optional "Cuenta" select in the transaction dialog and in the loan payment / receivable collection dialog when "Registrar como gasto/ingreso" is checked.
- The transactions page lists transactions, transfers ("Nequi → Efectivo") and adjustments ("Ajuste de saldo · Nequi") in one paginated list, with a "Cuenta" column, an account filter (`?account=<id>` or `none`), a "Traspasos" type and a "Traspaso" button.
- "Saldo en cuentas" card on the Personal summary.
- Import wizard: `account` field for the Método column in the transactions destination, with a "Cuentas" section in step 4 mapping each value to an active account, "Crear «valor»" or "Sin cuenta", and a "Cuenta" column in the preview. Accounts created by an import stay when it is undone.
- "Cuentas y traspasos" section in `docs/producto.md` and the SPEC 08c answers in `ROADMAP.md`.
- Account page at `/dashboard/account`, opened from a "Cuenta" item in the user menu: profile (avatar, name and email), currency preference, password and a danger zone.
- Avatars in a public Supabase Storage bucket (`avatars`, 1 MB, WebP only) where each user can only write to their own folder. The browser center-crops JPG, PNG or WebP files up to 5 MB to a 256×256 WebP; "Quitar foto" deletes the files and falls back to initials.
- Currency preference (COP, USD, EUR, MXN, PEN, CLP, ARS) from `SITE.currencies`, validated with Zod. It only changes formatting; stored amounts are not converted.
- Email change with double confirmation and a "Cambio pendiente a X" notice.
- Change password (requires the current one) or create one for OAuth-only users, using the new `has_password()` RPC.
- Forgot password flow: `/forgot-password` (same answer whether or not the email exists) and `/reset-password`.
- `/auth/confirm` route that verifies `token_hash` email links (sign-up confirmation, recovery and email change), so links work in a different browser.
- Email confirmation ready but off (`enable_confirmations = false`): when enabled, sign-up goes to `/check-email` with a "Reenviar correo" button, and signing in with an unconfirmed email links there.
- Spanish, Tesoro-branded email templates in `supabase/templates/` (`confirmation`, `recovery`, `email_change`).
- Account deletion with a 30-day grace period: typing the exact email schedules it (`request_account_deletion()` stores `deletion_requested_at` in `raw_app_meta_data`), deletes the avatar and signs out. Signing in during the grace period leads to `/account-deleted` to restore the account (`cancel_account_deletion()`) or sign out.
- Daily `pg_cron` job `purge-deleted-accounts` (08:00 UTC) running `purge_deleted_accounts()`, which deletes users marked more than 30 days ago and, by cascade, all their data. Only `pg_cron` can run it.
- `SITE.routes` entries for the new pages, `SITE.currencies` and `SITE.accountDeletionGraceDays`.
- "Cuenta y perfil" section in `docs/producto.md` and remote setup steps in the README.
- Migration `business_workspaces`: `business_profiles` table (NIT and sector, 1:1 with its workspace), `workspaces.deletion_requested_at`, `categories.scope`, optional `transactions.counterparty` and `transactions.invoice_ref`, 13 seeded business system categories, and the `business_workspace_limit()`, `is_workspace_writable()`, `create_business`, `request_workspace_deletion` and `cancel_workspace_deletion` functions.
- `check_business_limit`, `check_business_profile_workspace` and `set_category_scope` triggers. Each user can have one business, counting businesses scheduled for deletion.
- Daily `pg_cron` job `purge-deleted-workspaces` (08:15 UTC) running `purge_deleted_workspaces()`, which deletes businesses marked more than 30 days ago and, by cascade, all their data.
- "Crear empresa" dialog (name, optional NIT, sector) on the Empresa empty state. `/dashboard/business` redirects to the user's business.
- Business routes under `/dashboard/business/[id]`: summary (sales, costs and expenses, and profit for the current month, plus the 5 latest transactions), transactions, accounts, settings, and "coming soon" cash flow, reports and recommendations pages. Another user's id, or the Personal workspace's id, returns 404.
- Business navigation in the aside (`SITE.navigation.business`) and a business switcher shown only with more than one business.
- Customer/supplier and invoice number on business transactions, shown in the dialog and table and included in the search.
- Business settings: edit name, NIT and sector, and delete the business with a 30-day grace period. Deleting requires typing the exact name. While marked, every business route shows the deletion date and "Restaurar empresa".
- `getWorkspace`, `getBusinessWorkspaces` and `requireWritableWorkspace` in `src/features/workspaces/queries.ts`, plus `workspaceBasePath` / `workspaceTransactionsPath` and `revalidateWorkspacePages`.
- `SITE.businessLimit`, `SITE.workspaceDeletionGraceDays`, `SITE.businessSectors`, and the `store`, `package`, `users` and `megaphone` category icons.
- "Espacio Empresa" section in `docs/producto.md`.
- Migration `business_reports_and_score`: the 9 business rule keys in the `dismissed_recommendations` check, and the `account_monthly_balances` (accounts balance at each month end, active accounts only) and `counterparty_totals` (totals per customer or supplier, grouped by `lower(btrim())`) RPCs, `security invoker` and executable only by `authenticated`.
- Business cash flow page at `/dashboard/business/[id]/cash-flow`: period picker (current year by default), inflows and outflows bars with the accounts balance line at each month end, a month-by-month table (inflows, outflows, net, closing balance), today's balance per active account and a notice for transactions without an account.
- Business reports page at `/dashboard/business/[id]/reports`, the Personal reports page with "Ventas" and "Costos y gastos" labels and links to the business transactions.
- Business summary: change vs. the previous month on sales, costs and profit, margin and accounts balance cards, a 6-month sales vs. costs chart and a costs-by-category donut.
- Business score from 0 to 100 with 6 weighted factors (net margin, liquidity, sales growth, profitable months, cost concentration and regularity), computed on the fly like the Personal score, with a 12-month history and "Sin datos suficientes".
- 10 business recommendation rules (`loss_month`, `negative_account`, `low_liquidity`, `sales_drop`, `low_margin`, `cost_growth`, `client_concentration`, `cost_concentration`, `missing_accounts`, `irregular_records`) with "Ocultar este mes" / "Mostrar de nuevo".
- Business score and recommendations page at `/dashboard/business/[id]/recommendations` and a "Salud del negocio" card on the business summary.
- "Registra tu primera venta" empty state on the business summary, cash flow, reports and recommendations pages.
- "Empresa: flujo de caja, reportes y score" section in `docs/producto.md`.

- Brand identity: a treasure-chest mark and a "Tesoro" wordmark in Geist, with `--income` (emerald) as the accent. SVG sources in `assets/brand/` (`mark.svg`, `logo.svg`, `opengraph.svg`, text converted to paths) and `app/icon.svg`.
- `pnpm brand:assets` (`scripts/generate-brand-assets.mjs`, `sharp` as an exact devDependency) generates `public/opengraph-image.png`, `public/brand/logo.png`, `public/apple-touch-icon.png`, `public/icons/icon-192.png`, `public/icons/icon-512.png` and a multi-size `app/favicon.ico` (16, 32, 48) built from embedded PNGs.
- Reusable `Logo` component (mark + wordmark, or mark only) and a light/dark `ThemeToggle`.
- `app/(public)/` route group with a public header (navigation, theme toggle, a session island in `<Suspense>` that shows "Ir al dashboard" or "Iniciar sesión" / "Crear cuenta", and a mobile `Sheet` menu) and footer (legal links, repository, issues, socials, license, version and author).
- Full landing page at `/`: hero, features, how it works, score (7 factors with weights and 4 bands), Personal and Empresa, open source and a final CTA, with interim JSX mockups (`LandingHeroVisual`, `LandingScoreVisual`) using fixed sample data.
- Legal pages at `/legal/privacy` and `/legal/terms` (one `[slug]` route with `generateStaticParams`, 404 for unknown slugs), with a table of contents, last-updated date, `buildMetadata` and breadcrumb JSON-LD. Texts written in Spanish under Colombian Law 1581 of 2012.
- Terms and privacy acceptance notice on `/sign-up`.
- `SITE.routes.legal`, `legalHref()`, `SITE.repository.contributing`, an `icon` per `SITE.features` item and "Cómo funciona" in `SITE.navigation.main`.
- `text-brand` utility for accent-colored small text with AA contrast.
- "Landing", "Páginas legales" and "Marca" sections in `docs/producto.md`.

- Impeccable 4.8.0 as a versioned project skill in `.claude/skills/impeccable/` with its subagents in `.claude/agents/`. The platform engine binary is ignored by git and downloaded on first use.
- `PRODUCT.md` with the design context (users, purpose, voice, principles and visual constraints), linked from `CLAUDE.md`.
- `docs/ui.md`: tokens, verified contrast, own components, where each screen lives and how to use the Impeccable commands.
- Dashboard header title: a greeting by Bogotá time on the Personal summary ("Buenas tardes, …") and the page title elsewhere, as the only `<h1>` of each screen.
- Header quick actions: "Registrar movimiento" plus a "Más" menu (goal contribution and debt payment with a goal/debt `Select`, and import) in Personal, and "Registrar operación" in Business.
- `StatCard` KPIs with a variation badge against the equivalent previous period, colored by meaning (rising expenses are bad), computed on the server with the existing queries (`getPeriodComparison`).
- `HelpHint` (i) popovers for score, card utilization, savings rate and accumulated balance, with texts in `src/config/help.ts`.
- `CardHeading`, `CardSkeleton` and status tone classes (`tone.ts`) for dashboard cards.
- Chart system: `ChartCard` (title, legend, range and headline figure), shared Recharts props (`chart-style.ts`) and abbreviated es-CO axis amounts (`chart-format.ts`).
- "Saltar al contenido" link and a `<main>` landmark in the dashboard.
- Reports KPIs (income, expenses, balance and savings rate, or margin in Business).

### Changed

- Movimientos filter bar (SPEC 25): the **Categorías** and **Verificar** buttons left the bar and the phone filter sheet (Personal and Business); they live in the **Más** menu and the quick-actions sheet. `TransactionsFilters` lost its `categoriesAction` and `trailing` props. `PaymentDialog`, `ContributionDialog`, `BudgetDialog`, `RecurringExpenseDialog` and `PaymentAccountSection` take a `workspaceId` (needed to create accounts and categories from their selects).

- Landing redesign after an Impeccable critique (SPEC 24): no eyebrows, no icons in tinted squares, no identical card grid and no radial halos; the slogan is the hero headline, with a "Gratis · Sin conectar bancos · Código abierto (MIT)" line under the CTAs; rewritten section headlines; borderless cards; open-source links as text links; a closing that echoes the video's end (mark, slogan, CTA).
- Score section and `score-visual.tsx` redesigned: a single segmented bar for the 7 factor weights (sums to 100), a gauge with the four bands as arc segments and a marker that animates once, calm "data → action" recommendations, and state colors from `tone.ts` instead of the raw Tailwind palette.
- Public header: centered pill navigation, transparent at the top and solid on scroll, 44 px theme toggle with an animated sun/moon swap (also in the dashboard aside), and session buttons with an arrow ("Abrir Tesoro" when signed in).
- Colored buttons now use white text (SPEC 24): the Personal and Business primary fill moves to the 700 tone (emerald-700, orange-700) in light and dark, the first that reaches AA with white (5.22:1 and 5.08:1); hover darkens instead of lightening. In dark mode, focus rings and soft accent text use the new `--accent-bright`, and the `danger` button uses a red-600 fill with white text.
- Dark theme tokens (SPEC 23): less saturated primary in dark (emerald `oklch(70% .15 162.5)`, orange `oklch(72% .18 48)`), darker `*-foreground` text on accent and status colors, slightly brighter `--muted`, and updated dark contrast table (all pairs AA). `SITE.seo.themeColor` now matches the new backgrounds (`#F1F2F5` light, `#07080A` dark), which also updates the PWA manifest colors.
- Light theme polish (SPEC 23): softer page background (`#f1f2f5`) so white cards stand out without borders, subtler accent-soft fills (12 %) with a stronger soft foreground, a graduated neutral chart series (lightest 3.36:1 on the surface) and a darker chart grid. Empty states, archived accounts, `SURFACE_NOTE` and the drag overlay use the shared shadow tokens. Contrast table in `docs/ui.md` updated; dark mode is unchanged.
- Links to Gastos fijos (quick sheet, upcoming payments card, recommendations, import target) now point to `/dashboard/personal/recurring`.
- The Business `negative_account' recommendation now only fires for active `wallet`and`bank`accounts with a negative balance;`cash`and`other` no longer trigger it (SPEC 21).
- Movimientos bar (SPEC 20): search (fills the free width, min `18rem`), month, Filtros (phones) and Verificar share one 44 px row; on phones the search takes its own row. Verificar is icon-only below 640 px and reaches the bar through the new `trailing` prop of `TransactionsFilters`.
- "Sin presupuesto" and the budget progress rows use a fixed grid (category, amount, action) so amounts line up; "Presupuestar" is a compact fixed-width button.
- Toolbar controls (SPEC 20): the search field, month pill, Filtros, Verificar, Categorías, inactive filter pills, the reports period picker and the budget month navigation share the card and table gray (`bg-surface`) through `CONTROL_SURFACE` and `CONTROL_BUTTON` in `surface.ts`, with the same 44 px height in the Movimientos row. Buttons are `ghost` instead of `secondary` or bordered `outline` (budget month navigation and "Copiar del mes anterior").
- Delete icons are red in row action menus and inline buttons, and in "Quitar foto".
- Mobile bottom bar in Personal shows Cuentas instead of Metas (`SITE.navigation.mobile.personal`). Metas stays in the aside. Business is unchanged.
- Gastos fijos, Últimos movimientos, Resumen por categoría and Flujo de caja are single scrollable tables on phones instead of cards or hidden columns.

- Mobile UI polish (SPEC 18): "Últimos movimientos", cash flow by month and fixed expenses render as cards under 768 px (`DataRows` / `DataRow`, `src/components/dashboard/data-rows.tsx`); the upcoming payments list stacks name + amount, details and a full-width pay button. Tablet and desktop keep the tables.
- Movimientos filters on mobile: search field, month stepper and a **Filtros** button with an active-filter count that opens a bottom sheet (type, category, account, all months, categories, clear). Desktop keeps the filter bar. The transactions skeletons follow the new layout.
- Dates and percentages use a non-breaking space (`formatDate`, `formatShortDate`, `formatPercent`) so they never wrap. Goal card: percentage and the remaining / target date / suggested contribution rows stay on one line.
- Server elements passed as props to client components (`categoriesAction`, the budget dialog `trigger`) are wrapped in a single child to avoid React's missing `key` warning.

- `debt_overview`, `check_debt_balance`, `score_balances`, `check_debt_entry`, `account_balances` and `account_monthly_balances` account for card advances and payments or contributions with an account.
- Editing a goal contribution only changes amount, date and note; it no longer overwrites the account.

- Form fields (inputs, selects, date pickers) use a soft fill with no border through the `--field-*` tokens (`--field-background`, `--field-hover`, transparent `--field-border`, no shadow); the focus ring is unchanged. `muted` and `foreground` on the new fill keep AA in light and dark mode.
- The "Traspaso" buttons on the Personal and Business transactions and accounts pages are gone: transfers are created from the "Registrar movimiento" dialog. Editing a transfer from the table still opens the transfer dialog.
- Dashboard pages no longer repeat the title and description under the header (debts, budgets, accounts, goals, recommendations, import, account and every Business page); the header `<h1>` is the only title and each `<section>` has an `aria-label`.
- Debts, budgets, recurring expenses, goals, hidden recommendations and import history lists use borderless surfaces instead of `rounded-xl border` boxes and dashed notes. "Próximos pagos" (debts and recurring expenses) and "Sin presupuesto" are cards with `CardHeading`; debt, receivable and goal cards use the card surface.
- The paid amount in recurring "Próximos pagos" uses `--income` instead of the raw emerald palette.

- Inter replaces Geist, and the dark theme is the default.
- Dark theme retuned to near-black neutrals with borderless dark-gray cards; light background, money, danger, chart and focus tokens adjusted so every text pair keeps AA and the money series pass a color-blind palette check.
- Aside reordered: logo, Personal/Business pill tabs, compact navigation, and help, theme toggle and user menu at the bottom. The theme moved out of the user menu.
- Personal summary redesigned: 4 KPIs, income vs. expenses chart with a side column (score and accounts), recent transactions and 4 secondary cards.
- Transactions: one-line filter bar with labeled pill filters and "Limpiar filtros", small KPIs, a compact table that hides columns on narrow screens, and no duplicate "Nuevo movimiento" button.
- Reports: one control bar shared in style with Transactions, a trend of at least 6 months ending at the selected period, and the top 5 categories next to a compact category table.
- Charts: horizontal dashed grid only, rounded bars, 2 px smooth lines, overlay tooltip with full amounts, focusable surfaces with a visible focus ring and an accessible name.
- Empty states and skeletons use the card container (no dashed borders), and account cards follow the borderless card style.
- `getCategories` and `getAccountBalances` are cached per request.
- `SITE.seo.themeColor` updated to the new backgrounds.
- Every screen migrated from shadcn/ui to HeroUI: forms, dialogs, alert dialogs, menus, drawers, selects, tabs, tables, pagination, toggles, checkboxes, radios, tooltips, chips, avatars and skeletons. Toasts use HeroUI's `toast` and dates the HeroUI `DatePicker`; values sent by forms are unchanged.
- Money, category, status and chart colors retuned to the new theme with AA contrast in light and dark mode; `CATEGORY_COLORS` keys are unchanged.
- `SITE.seo.themeColor` updated to the new light and dark backgrounds.

- `SITE.legal` slugs are now `privacy` / `terms` (updated 2026-10-31).
- The home page moved from `app/page.tsx` to `app/(public)/page.tsx`.
- The auth layout shows the `Logo` instead of the plain name.
- `/legal/privacy` and `/legal/terms` added to the sitemap.
- `app/favicon.ico` replaced: it was the default Next.js icon.
- shadcn `pagination` uses `next/link` and Spanish labels.
- Transaction and recurring expense actions revalidate the whole Personal workspace (summary, transactions, budgets and reports) instead of only refreshing the current page.
- The transaction dialog accepts prefilled values and an occurrence link, and locks the type to expense for recurring payments.
- The icon and color picker from the categories sheet is now a reusable `IconColorPicker` component, shared with savings goals.
- The debts placeholder page is replaced by the debts page, and `revalidatePersonalPages()` documents that it also refreshes `/dashboard/personal/debts`.
- The recommendations placeholder page is replaced by the score and recommendations page.
- `serverActions.bodySizeLimit` is raised to `2mb` so a 2,000-row import fits in one Server Action request.
- `undo_import` deletes the rows of the import's destination. For debts and goals it fails without deleting anything, naming the debt or goal, when it is no longer active or its balance would go negative; undoing debt entries also deletes the transactions they created.
- The import page is titled "Importar", and the import history shows each import's destination and counts rows in its own unit ("3 gastos fijos").
- `getDuplicateCandidates` takes the import destination.
- `record_debt_payment` takes an optional `p_account_id`, `import_transactions` takes `p_new_accounts` and per-row `account_id` / `new_account_key`, and `transaction_totals` takes optional `p_account_id` / `p_without_account` filters. All new parameters have defaults.
- `getTransactions` reads the `ledger_entries` view, and the transaction dialog takes the account list.
- `banknote` and `wallet` icons added to `CATEGORY_ICONS`.
- Foreign keys `on delete restrict` on `category_id` (transactions, recurring expenses, budgets) and on the account references of transactions and transfers are now `on delete no action`, so deleting a user cascades without errors. Outside the cascade they still block deleting a category or account in use.
- `minimum_password_length` raised to 8 in `supabase/config.toml`, matching the forms.
- `CLP` is formatted without decimals.
- `/forgot-password` added to the sitemap. `/reset-password`, `/check-email` and `/account-deleted` are `noindex`.
- `proxy.ts` treats `/forgot-password` as an auth route, sends `/reset-password` without a session to `/forgot-password?error=expired`, and handles the deletion grace period.
- On `/dashboard/account` the aside keeps the Personal navigation with no active item.
- Transaction, category and account actions take the workspace id (hidden field or argument), validate it with `requireWritableWorkspace` and revalidate that workspace's pages. Personal passes its own id and behaves as before.
- `getCategories(workspaceId)` returns only the system categories with the workspace's scope plus the workspace's own categories.
- Write policies on `transactions`, `categories`, `accounts`, `transfers` and `account_adjustments` use `is_workspace_writable` instead of `is_workspace_owner`. `select` policies are unchanged.
- `check_transaction_category` and `check_expense_category` also require the category's scope to match the workspace type. `record_debt_payment` and `import_debt_entries` only look up Personal system categories.
- `transaction_totals` and the `ledger_entries` view include `counterparty` and `invoice_ref`.
- The quick-add button also shows on `/dashboard/business/[id]/*` and records the transaction in that business.
- `deletionDate()` takes the grace days, so account and business deletion share it.
- Transactions filters, pagination, empty states, recent transactions and account cards take the workspace's transactions path.
- The reports page content is now `ReportsView`, shared by Personal and Business. The period picker, type toggle and category table take the workspace's paths, and the trend chart takes the series labels.
- `parseReportParams` takes an optional default period (month by default).
- The score curves, bands, window, weeks and weighting moved to `src/features/score/curves.ts`. `FactorResult`, `ScoreResult` and `Recommendation` take the workspace's key type, and the score components take the factor labels.
- `dismissRecommendation` and `restoreRecommendation` take the workspace id, resolve it with `requireWritableWorkspace`, validate the rule against that workspace type's keys and revalidate its pages. Personal passes its own id and behaves as before.
- `dismissed_recommendations` write policies use `is_workspace_writable` instead of `is_workspace_owner`.
- The variation helpers of the summary cards moved to `src/features/reports/change.ts`.

### Removed

- `AccountSelect` (SPEC 25), replaced by `AccountSelectField`. `account-select.tsx` keeps `AccountOption`, `AccountLabel`, `accountName` and `selectableAccounts`.

- The landing's "Cómo funciona" section and the "Inicio"/"Cómo funciona" header links; the three steps now live in the features subtitle.
- `DataRows` / `DataRow` (SPEC 18 card pattern for tables): no longer used after SPEC 20.
- The sticky Personal / Business tab under the mobile header (`MobileWorkspaceTabs`, SPEC 18). The workspace selector lives only in the aside, which opens as a drawer on mobile.
- Email features, until a custom email service is added: sign-up email confirmation (`/check-email`, resend), password recovery (`/forgot-password`, `/reset-password`), email change in the account page (now read-only), the `/auth/confirm` route and the `supabase/templates/` email templates. Sign-up now always opens the session directly, so the Supabase project must have "Confirm email" off.
- `SummaryCards` and the secondary summary metrics (daily average, spending projection, top category, transaction count); the category donut from the Personal summary and from Reports.
- `quick-add-transaction` components, replaced by the header quick actions.
- shadcn/ui: `src/components/ui/`, `components.json`, `src/libs/utils.ts` and the `shadcn`, `radix-ui`, `class-variance-authority`, `tw-animate-css`, `cn`, `sonner` and `react-day-picker` packages.

### Fixed

- Movimientos rows alone on their day (common in past months), and every row while searching, could not be edited or deleted: `useSortable({ disabled })` set `aria-disabled="true"` on the `<tr>` and HeroUI's disabled row style removed pointer events, so the row menu never opened. Rows that cannot be dragged are no longer registered with dnd-kit (SPEC 26).
- Editing or deleting a loan payment or receivable collection from Movimientos no longer leaves its debt entry behind with the old amount or date: `updateTransaction` and `deleteTransaction` now reject a movement linked to a debt entry ("Este movimiento es un pago de deuda: edítalo desde su diálogo de pago") (SPEC 26).
- Opening a modal (especially one on top of another, like **+ Crear categoría**) no longer flashes a horizontal scrollbar and jumps: HeroUI's 1.05 scale-in made the scrolling backdrop overflow on the x axis; `.modal__backdrop` now has `overflow-x: hidden` (SPEC 25).
- The E.A. / M.V. rate toggle in the debt dialog no longer overlaps **Día de pago** (SPEC 25): the rate cell, field and input can shrink (`min-w-0`) and the toggle keeps its width, on desktop, phone and with a validation error.

- Dialogs and sheets (movements, transfers, accounts, budgets, debts, goals, recurring expenses, business) never opened from their trigger buttons: `isOpen`/`onOpenChange` were set on `*.Backdrop`, so React Aria ignored the trigger state. They now go on the `Modal`/`Drawer`/`AlertDialog` root.
- The recurring expenses table was wrapped in an extra bordered box, drawing a border around its header, and the "Pausado" chip had its own border.
- The Transactions month button showed one label and announced another (WCAG 2.5.3); the month is now text with a single "Todos los meses" toggle.
- Charts were keyboard-focusable without a visible focus indicator or a name.
- Line series were cut short after the chart container resized (stale `stroke-dasharray`).
- Progress bars had no accessible name, and Ctrl/⌘+B toggled the sidebar while typing in a field.
- Purging an account or a business failed when the workspace had transfers: `transfers` only referenced `accounts` (`no action`) and had no foreign key to `workspaces`. It now has `transfers_workspace_id_fkey ... on delete cascade`.
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
