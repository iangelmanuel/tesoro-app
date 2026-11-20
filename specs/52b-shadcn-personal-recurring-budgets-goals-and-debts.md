# SPEC 52b — Personal en shadcn: Ingresos fijos, Gastos fijos, Presupuestos, Metas y Deudas

> **Estado:** Aprobado
> **Depende de:** SPEC 27, SPEC 37, SPEC 38, SPEC 45, SPEC 51, SPEC 52a
> **Fecha:** 2026-11-20
> **Objetivo:** Migrar a shadcn (Base UI) Ingresos fijos, Gastos fijos, Presupuestos, Metas y Deudas de Personal, con sus Sheets, diálogos, skeletons y un tour nuevo de Ingresos fijos, sin cambiar las server actions.

## Por qué existe este spec

Es la segunda parte de SPEC 52 (ver SPEC 52a). 52a migró los campos de `src/components/forms/*`, categorías, Resumen, Movimientos y Cuentas, y dejó dos puentes temporales porque estas pantallas seguían en HeroUI:

- `FormDialog` con `hostsHeroUI` + `closesFromDialog` en el diálogo de movimiento, porque sus tabs Deuda, Me deben, Meta y Gasto fijo y el select de ingreso fijo vienen de estas features.
- `DetailSheet` con `modal={false}`, porque los Sheets de detalle alojan menús y diálogos de HeroUI.

Son ~13.200 líneas en cinco features (`recurring-incomes`, `recurring-expenses`, `budgets`, `goals`, `debts`), 46 archivos con `@heroui/react`. Deudas sola son ~6.300. Se decidió un solo spec: `PaymentDialog` y `ContributionDialog` los comparten Movimientos, acciones rápidas y Empresa, y cerrar los dos puentes pide tener todo migrado.

Como en 52a, lo que comparte Empresa (`PaymentDialog`, `ContributionDialog`, `GoalIcon`) se migra **en sitio**.

## Alcance

**Entra:**

### 1. Ingresos fijos (`app/dashboard/personal/recurring-income/page.tsx`)

- Todo `src/features/recurring-incomes/components/*`:
  - `RecurringIncomeView` (con `MonthNav` y el historial de meses de SPEC 38), `RecurringIncomesList`, `UpcomingIncomes`, `IncomeStatus`, `IncomeReceiptPreview`;
  - `RecurringIncomeDialog`, `IncomeSourceField`, `ReceiveIncomeButton` (diálogo de recibir ingreso, con varios cobros por mes);
  - `RecurringIncomeSheet` con su lista reordenable (SPEC 45) e `income-sheet-context.tsx`;
  - `use-recurring-income-actions.ts` (toasts).

### 2. Gastos fijos (`app/dashboard/personal/recurring/page.tsx`)

- Todo `src/features/recurring-expenses/components/*`:
  - `RecurringView` (historial de meses de SPEC 37), `RecurringExpensesList`, `UpcomingPayments`, `OverdueIndicator`, `OccurrenceSelect`;
  - `RecurringExpenseDialog`, `RecurringExpenseSheet`;
  - `use-recurring-expense-actions.ts` (toasts).
- `UpcomingPaymentsCard` ya quedó en 52a; no se toca salvo que comparta piezas.

### 3. Presupuestos (`app/dashboard/personal/budgets/page.tsx`)

- Todo `src/features/budgets/components/*`: `BudgetsAndRecurringTabs` (tabs de móvil compartidas con Gastos fijos), `BudgetMonthNav`, `BudgetTotals`, `BudgetProgressRow`, `UnbudgetedCategories`, `BudgetDialog`, `CopyPreviousMonthButton` (con su confirmación).
- `BudgetsAtRiskCard` ya quedó en 52a.

### 4. Metas (`app/dashboard/personal/goals/page.tsx`)

- Todo `src/features/goals/components/*`: `GoalCard`, `GoalSummary`, `GoalProgressBar`, `GoalIcon`, `InactiveGoals`, `GoalDialog`, `GoalSheet`, `ContributionsList` (reordenable), `ContributionDialog` (aportes y retiros), `use-goal-action.ts`.
- `GoalsCard` ya quedó en 52a.

### 5. Deudas y Me deben (`app/dashboard/personal/debts/page.tsx`)

- Todo `src/features/debts/components/*`:
  - `DebtsTabs` (Deudas / Me deben), `DebtTotals`, `UpcomingDebtPayments`, `DebtCard`, `DebtProgress`, `DebtIndicators`, `InactiveDebts`, `InactiveReceivables`;
  - `DebtDialog`, `AdjustBalanceDialog`, `ArchiveDebtDialog`, `DebtSheet`, `DebtEntriesList` (reordenable);
  - `PaymentDialog`, `DebtEntryDialog` (todos los tipos de SPEC 46), `DuplicateDebtEntryDialog`, `LinkableTransactionsField`;
  - `ReceivableCard`, `ReceivableDialog`, `ReceivableInstallments`, `ReceivableCollectForm` (cobros parciales y de varios meses, SPEC 29 y 39);
  - `use-debt-action.ts`.
- `DebtsCard` ya quedó en 52a.

### 6. `debts/components/field.tsx`

- `amountInput` y `rateInput` pasan a `src/components/forms/amount-format.ts`. Sus consumidores (`AccountDialog`, `PaymentAccountSection`, `TransferDialog` y los de deudas) importan de ahí.
- Los diálogos de deudas dejan `Field` y usan `TextInputField` / `Field` + `FieldError` de `src/components/ui/`.
- `Field` se queda en `debts/components/field.tsx` solo para `business-dialog.tsx` (HeroUI), con un comentario que dice que SPEC 53 lo borra.

### 7. Retiro de puentes

- **`FormDialog`:** se quitan las props `hostsHeroUI` y `closesFromDialog`. `TransactionDialog` vuelve a ser modal, con el foco atrapado.
- **`DetailSheet`:** vuelve a `modal` (sin `modal={false}` ni el filtro de cierre de `heroui-compat.ts`). Todos sus consumidores (`CategoriesSheet`, `DebtSheet`, `GoalSheet`, `RecurringExpenseSheet`, `RecurringIncomeSheet`) quedan en shadcn.
- Se quedan hasta SPEC 53: `HeroUIPortalBridge`, `HeroUIPortalHost`, `heroui-compat.ts` (lo sigue usando el aside móvil) y `heroui-bridge.css`.

### 8. Tour de Ingresos fijos (SPEC 27)

- Sección nueva `recurring_income` en `TUTORIAL_SECTIONS`, justo después de `recurring`, con `TUTORIAL_SECTION_INFO.recurring_income = { label: "Ingresos fijos", href: "/dashboard/personal/recurring-income" }`.
- Migración que amplía el `check` de `tutorial_progress.section` con `'recurring_income'`.
- Pasos (`TUTORIALS.recurring_income`), con estos `data-tour`:

| #   | `target`          | Qué muestra                                                    |
| --- | ----------------- | -------------------------------------------------------------- |
| 1   | (sin target)      | Intro centrada: qué es un ingreso fijo.                        |
| 2   | `income-create`   | Botón para agregar un ingreso fijo.                            |
| 3   | `income-month`    | Selector de mes: el historial de meses anteriores.             |
| 4   | `income-upcoming` | Próximos ingresos y los ya recibidos este mes.                 |
| 5   | `income-receive`  | Recibir un ingreso: monto real y cuenta; queda en movimientos. |
| 6   | `income-list`     | Lista de ingresos fijos con monto, frecuencia y estado.        |
| 7   | `income-detail`   | Abrir el detalle (Sheet) con los cobros del mes, reordenables. |
| 8   | `row-actions`     | Editar, pausar o eliminar.                                     |

- Los textos siguen el vocabulario de SPEC 47 y la claridad de SPEC 48.

### 9. Reglas comunes (iguales a SPEC 52a §6)

- `useActionState` + Zod y **las mismas server actions**. No cambian `actions.ts`, `schemas.ts`, `queries.ts` ni los servicios compartidos con el MCP (`transactions/service.ts`, `debts/entry-service.ts`, `goals/contribution-service.ts`, `recurring-expenses/payment.ts`, `recurring-incomes/receipt.ts`).
- Campos con las piezas de `src/components/forms/` y `src/components/ui/`; errores del servidor con `aria-invalid` + `aria-describedby`; el cliente no valida antes. Montos con su formato y parseo actuales.
- Diálogos con `FormDialog` (o `AlertDialog` para confirmaciones como copiar mes anterior, archivar y eliminar).
- Botones con `onClick` / `disabled`; ningún archivo migrado usa `onPress` / `isDisabled` de HeroUI.
- Toasts con `toast` de `@/components/ui/sonner`; errores con `toast.error` (`role="alert"`).
- Listas reordenables con `SortableList` (`src/components/dashboard/sortable-list.tsx`) y su asa; el orden se sigue guardando igual (SPEC 45).
- Tarjetas de deuda, cobro y meta, y filas de las listas de gastos fijos, ingresos fijos y presupuestos, con `RowContextMenu`, con las mismas acciones que su botón ⋯.
- Listas y tarjetas con las clases de `src/components/dashboard/surface.ts`; KPIs con `StatCard`; vacíos con `EmptyState` / `CardEmpty`; estados con `tone.ts`.
- **Skeletons (SPEC 51 §6):** cada componente que carga datos exporta su `…Skeleton` en el mismo archivo y con el mismo contenedor. `Suspense` por tarjeta. Las cinco páginas dejan `CardSkeleton` y el `Skeleton` de HeroUI.
- **`loading.tsx`** nuevo en `personal/recurring-income/`, `personal/recurring/`, `personal/budgets/`, `personal/goals/` y `personal/debts/`, cada uno dentro de `LoadingRegion` y compuesto con los skeletons de su pantalla.
- **Tours:** todos los `target` de `recurring`, `budgets`, `goals` y `debts` en `src/config/tutorials.ts` siguen existiendo como `data-tour` en el DOM migrado.
- **Accesibilidad:** AA en claro y oscuro, foco con `outline-ring`, 44 × 44 px de área táctil, `Amount` leído completo, ingresos y gastos con signo e ícono, reflujo sin scroll horizontal a 320 px y a 200 % de zoom, `prefers-reduced-motion`, foco atrapado en diálogos y Sheets.
- **Impeccable:** `/impeccable audit` y `polish` por pantalla (las cinco y sus diálogos y Sheets) en claro, oscuro, móvil, tablet y escritorio.
  - Los hallazgos dentro de la dirección "Señalética" de SPEC 51 se corrigen directo.
  - Un cambio grande de layout o de flujo se lista y se pregunta antes de hacerlo.

### 10. Documentación

- `CLAUDE.md` (UI y tema): se quita la nota de `hostsHeroUI` "hasta SPEC 52b" y la de `DetailSheet` no modal; `amount-format.ts` en formularios.
- `docs/ui.md`: puentes retirados, `FormDialog` sin `hostsHeroUI`, estado de la migración por pantalla (las cinco en shadcn).
- `CHANGELOG.md` en `[Unreleased]` (en inglés), incluido el tour nuevo.

**Fuera de alcance (para otros specs):**

- Reportes, Recomendaciones e Importar (**SPEC 52c**).
- Pantallas exclusivas de Empresa (incluido `business-dialog.tsx` y su `Field`), cuenta, auth y públicas; retiro de HeroUI, `@internationalized/date`, `CardSkeleton`, `heroui-bridge.css`, `heroui-compat.ts` y del puente de portales (**SPEC 53**).
- Paso de importar en el tour de Ingresos fijos: el importador no soporta ingresos fijos y la pantalla no tiene `ImportButton`.
- Importar ingresos fijos.
- Cambios en server actions, esquemas Zod, consultas, servicios del MCP o tablas (la única migración es el `check` del tour).
- Pruebas automatizadas en navegador (Playwright, Lighthouse en CI).

## Modelo de datos

No hay tablas ni columnas nuevas. Reusa el modelo de SPEC 04, 05, 06, 28, 30, 37, 38, 45 y 46.

Única migración, `supabase/migrations/<timestamp>_tutorial_recurring_income.sql`:

```sql
alter table public.tutorial_progress
  drop constraint tutorial_progress_section_check;

alter table public.tutorial_progress
  add constraint tutorial_progress_section_check check (section in (
    'summary', 'transactions', 'accounts', 'recurring', 'recurring_income',
    'budgets', 'goals', 'debts', 'reports', 'recommendations'
  ));
```

El nombre real de la restricción se confirma en la base antes de escribirla.

```ts
// src/config/tutorials.ts
export const TUTORIAL_SECTIONS = [
  "summary",
  "transactions",
  "accounts",
  "recurring",
  "recurring_income",
  "budgets",
  "goals",
  "debts",
  "reports",
  "recommendations"
] as const

// src/components/forms/amount-format.ts — movidos sin cambios desde debts/components/field.tsx
export function amountInput(value: number | null | undefined): string
export function rateInput(value: number | null | undefined): string
```

## Plan de implementación

1. Mover `amountInput` / `rateInput` a `src/components/forms/amount-format.ts` y actualizar sus importaciones; `Field` queda en `field.tsx` para `business-dialog`.
2. Migrar `ContributionDialog` (con `PaymentAccountSection` de 52a). Probar desde Metas, Movimientos y acciones rápidas.
3. Migrar `PaymentDialog`. Probar desde Deudas, Gastos fijos, Movimientos, acciones rápidas y Empresa.
4. Migrar las piezas de ingresos y gastos fijos que usa el diálogo de movimiento (`OccurrenceSelect`, `IncomeSourceField`, recibir ingreso). Quitar `hostsHeroUI` y `closesFromDialog` de `FormDialog` y `TransactionDialog`.
5. Migrar los diálogos de deudas: `DebtDialog`, `AdjustBalanceDialog`, `ArchiveDebtDialog`, `DebtEntryDialog`, `DuplicateDebtEntryDialog`, `LinkableTransactionsField`.
6. Migrar Me deben: `ReceivableDialog`, `ReceivableInstallments`, `ReceivableCollectForm`.
7. Migrar `DebtSheet` y `DebtEntriesList` (reordenable).
8. Migrar `DebtsTabs`, `DebtTotals`, `UpcomingDebtPayments`, `DebtCard`, `ReceivableCard`, `DebtProgress`, `DebtIndicators`, inactivas, con skeletons y `RowContextMenu`; página de Deudas y su `loading.tsx`.
9. Migrar Metas: `GoalDialog`, `GoalSheet`, `ContributionsList`, `GoalCard` y el resto, con skeletons y `RowContextMenu`; página y `loading.tsx`.
10. Migrar Gastos fijos: `RecurringExpenseDialog`, `RecurringExpenseSheet`, lista, próximos pagos, historial de meses; página y `loading.tsx`.
11. Migrar Presupuestos: `BudgetDialog`, `CopyPreviousMonthButton`, `BudgetMonthNav`, totales, filas, sin presupuesto y `BudgetsAndRecurringTabs`; página y `loading.tsx`.
12. Migrar Ingresos fijos: diálogo, Sheet con lista reordenable, lista, próximos, historial de meses; página y `loading.tsx`.
13. Volver `DetailSheet` a modal y comprobar los cinco Sheets.
14. Pasar a sonner los toasts de todo lo migrado (incluidos los hooks `use-*-action(s).ts`).
15. Tour de Ingresos fijos: migración del `check`, `TUTORIAL_SECTIONS`, `TUTORIAL_SECTION_INFO`, pasos y `data-tour` del §8.
16. Revisar los `data-tour` de `recurring`, `budgets`, `goals`, `debts` y `recurring_income` contra `src/config/tutorials.ts`.
17. `/impeccable audit` y `polish` de las cinco pantallas con sus diálogos y Sheets en claro, oscuro, móvil, tablet y escritorio; corregir.
18. Documentación (`CLAUDE.md`, `docs/ui.md`, `CHANGELOG.md`).

## Criterios de aceptación

Verificables en código o con `check`, `eslint`, `prettier:check` y `build`:

- [ ] Ningún archivo de `src/features/{recurring-incomes,recurring-expenses,budgets,goals,debts}/components/*` importa `@heroui/react` ni `@internationalized/date`, salvo `debts/components/field.tsx` si lo necesita para `business-dialog`.
- [ ] Tampoco lo importan `app/dashboard/personal/{recurring-income,recurring,budgets,goals,debts}/page.tsx` ni sus `loading.tsx`.
- [ ] Ningún archivo migrado usa `CardSkeleton`, `onPress` ni `isDisabled` de HeroUI.
- [ ] Cada componente migrado que carga datos exporta su `…Skeleton` en el mismo archivo.
- [ ] Existen `loading.tsx` en `personal/recurring-income/`, `personal/recurring/`, `personal/budgets/`, `personal/goals/` y `personal/debts/`, cada uno con `LoadingRegion`.
- [ ] `actions.ts`, `schemas.ts`, `queries.ts` y los servicios compartidos con el MCP de las cinco features no cambian.
- [ ] `FormDialog` ya no tiene las props `hostsHeroUI` ni `closesFromDialog`, y nadie las usa.
- [ ] `DetailSheet` no pasa `modal={false}` ni usa `heroui-compat.ts`.
- [ ] `amountInput` y `rateInput` viven en `src/components/forms/amount-format.ts`; `debts/components/field.tsx` solo exporta `Field` y solo lo importa `business-dialog.tsx`.
- [ ] La migración del tour existe y `tutorial_progress.section` acepta `'recurring_income'`.
- [ ] `TUTORIAL_SECTIONS` incluye `recurring_income` y `getTutorialSection("/dashboard/personal/recurring-income")` la devuelve.
- [ ] Cada `target` de los tours `recurring`, `recurring_income`, `budgets`, `goals` y `debts` aparece como `data-tour` en un componente migrado.
- [ ] Todo par texto/fondo nuevo queda en la tabla de contraste de `docs/ui.md` y pasa AA en claro y oscuro.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan, con el lockfile sincronizado.

Verificables en navegador (los prueba el usuario a mano):

- [ ] Crear, editar, pausar y eliminar un ingreso fijo y un gasto fijo funciona, y el toast sale de sonner.
- [ ] Recibir un ingreso fijo (también un segundo cobro del mismo mes) y pagar un gasto fijo crean su movimiento.
- [ ] Cambiar de mes en Ingresos fijos, Gastos fijos y Presupuestos muestra el historial de ese mes.
- [ ] Crear, editar y eliminar un presupuesto, y "Copiar mes anterior" con su confirmación, funcionan.
- [ ] Crear, editar, pausar, completar y archivar una meta; registrar un aporte y un retiro funciona.
- [ ] Crear, editar, ajustar saldo y archivar una deuda; registrar un pago y cada tipo de entrada de SPEC 46; duplicar y editar una entrada funciona.
- [ ] Crear un cobro de Me deben y registrar un cobro parcial y uno de varios meses funciona.
- [ ] Desde Movimientos, las tabs Deuda, Me deben, Meta y Gasto fijo y el select de ingreso fijo funcionan, y Tab no sale del diálogo.
- [ ] `PaymentDialog` y `ContributionDialog` abiertos desde acciones rápidas, desde Movimientos y desde Empresa funcionan.
- [ ] En los cinco Sheets de detalle, Tab no sale del Sheet y Escape lo cierra.
- [ ] Reordenar entradas de deuda, aportes de meta y cobros de un ingreso fijo guarda el orden tras recargar, y no abre el menú contextual.
- [ ] Clic derecho sobre una tarjeta de deuda, cobro o meta, o una fila de gastos fijos, ingresos fijos o presupuestos, muestra las mismas acciones que su botón ⋯; en táctil, una pulsación de 500 ms también.
- [ ] Un error de Zod del servidor se muestra bajo su campo y el lector lo anuncia.
- [ ] Al pasar de skeleton a contenido, el CLS medido con Lighthouse es ≤ 0.05 en las cinco pantallas.
- [ ] Los tours de Gastos fijos, Ingresos fijos, Presupuestos, Metas y Deudas recorren todos sus pasos sin saltarse ninguno, en escritorio y móvil.
- [ ] El tour de Ingresos fijos aparece en la lista de tutoriales de la cuenta y se marca como visto.
- [ ] Todo control interactivo de las cinco pantallas, sus diálogos y Sheets mide 44 × 44 px o más de área en móvil, tablet y escritorio.
- [ ] Las cinco pantallas y sus diálogos no tienen scroll horizontal a 320 px de ancho ni a 200 % de zoom en 1280 px (las tablas se deslizan dentro de `ScrollTable`).
- [ ] Un lector de pantalla lee un pago como "menos" seguido del monto completo, y "Monto oculto" con montos ocultos.
- [ ] `/impeccable audit` de cada pantalla no deja hallazgos críticos ni altos abiertos.

## Decisiones

- **Sí:** un solo SPEC 52b para las cinco pantallas. `PaymentDialog` y `ContributionDialog` los comparten varias pantallas, y los dos puentes solo se cierran con todo migrado.
- **No:** partir en 52b (fijos, presupuestos, metas) y 52b2 (deudas). Dejaría `hostsHeroUI` y `DetailSheet` no modal un spec más.
- **Sí:** migrar en sitio `PaymentDialog`, `ContributionDialog` y `GoalIcon`, que usa Empresa. Una sola versión, como en 52a.
- **Sí:** mover `amountInput` / `rateInput` a `src/components/forms/amount-format.ts`. Son formato de montos, no de deudas, y los usa Cuentas.
- **Sí:** dejar `Field` en `debts/components/field.tsx` solo para `business-dialog`. **No:** migrar `business-dialog` ahora; es de Empresa (SPEC 53).
- **Sí:** quitar `hostsHeroUI` / `closesFromDialog` y volver `DetailSheet` a modal en este spec. Tras 52b ningún consumidor aloja HeroUI, y el foco atrapado es requisito de accesibilidad.
- **No:** retirar `HeroUIPortalBridge` ni `heroui-compat.ts`. Los siguen usando 52c, Empresa y el aside móvil (SPEC 53).
- **Sí:** tour nuevo de Ingresos fijos, aunque sume una migración. Es la única pantalla de Personal sin tour.
- **Sí:** clave `recurring_income` (snake_case como el SQL, clave válida en TS sin comillas). **No:** `recurring-income` (comillas en TS) ni `incomes` (ambigua).
- **Sí:** pasos de mes y de detalle en el tour. El historial y los varios cobros por mes (SPEC 38) no son obvios.
- **No:** paso de importar. El importador no soporta ingresos fijos y la pantalla no tiene `ImportButton`; importar ingresos fijos sería otro spec.
- **Sí:** las server actions, esquemas, consultas y servicios del MCP no cambian. Este spec es solo UI, más el `check` del tour.
- **Sí:** `/impeccable` corrige directo dentro de la dirección de SPEC 51; los cambios grandes se preguntan.
- **Sí:** los criterios de navegador los verifica el usuario a mano, como en SPEC 51 y 52a.

## Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                                   |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Migrar `PaymentDialog` / `ContributionDialog` en sitio rompe Movimientos, acciones o Empresa   | Props públicas intactas; pasos 2 y 3 se prueban desde cada punto de entrada; criterio específico.                            |
| Quitar `hostsHeroUI` antes de migrar todo lo que aloja el diálogo de movimiento lo deja inerte | El paso 4 va después de migrar `PaymentDialog`, `ContributionDialog`, `OccurrenceSelect` e `IncomeSourceField`.              |
| `DetailSheet` modal deja inerte un menú de HeroUI que quedó dentro                             | Paso 13 al final, cuando los cinco Sheets ya están migrados; criterio de Tab y Escape en cada uno.                           |
| La pulsación larga de `RowContextMenu` choca con el arrastre de listas reordenables            | El arrastre usa su asa; la pulsación larga solo en el resto de la fila; criterio específico.                                 |
| `ReceivableCollectForm` y `DebtEntryDialog` (~680 líneas cada uno) cambian de comportamiento   | Mismos esquemas y actions; criterio por cada tipo de entrada (SPEC 46) y por cobro parcial y de varios meses (SPEC 29 y 39). |
| El nombre del `check` de `tutorial_progress` no es el esperado                                 | Se confirma en la base antes de escribir la migración.                                                                       |
| Los `data-tour` se pierden al reescribir el DOM                                                | Criterio que cruza cada `target` de `tutorials.ts` con el código migrado.                                                    |

## Siguientes specs: cuándo y qué pedir

| Orden | Spec     | Cuándo se crea        | Cuándo se implementa |
| ----- | -------- | --------------------- | -------------------- |
| 1     | SPEC 52b | Ya creado             | Tras aprobarlo       |
| 2     | SPEC 52c | Tras mergear SPEC 52b | Tras aprobarlo       |
| 3     | SPEC 53  | Tras mergear SPEC 52c | Tras aprobarlo       |

El prompt de SPEC 52c sigue en SPEC 52a.

## Qué no entra en este spec

- Reportes, Recomendaciones e Importar (SPEC 52c).
- Empresa (incluido `business-dialog` y su `Field`), cuenta, auth, públicas y retiro de HeroUI, `heroui-compat.ts` y del puente de portales (SPEC 53).
- Paso de importar en el tour de Ingresos fijos e importar ingresos fijos.
- Cambios en server actions, esquemas, consultas, servicios del MCP o tablas, salvo el `check` del tour.
- Pruebas automatizadas en navegador.

Cada uno de esos, si llega, va en su propio spec.
