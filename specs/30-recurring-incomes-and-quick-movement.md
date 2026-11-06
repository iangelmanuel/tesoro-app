# SPEC 30 — Ingresos fijos y movimiento rápido

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 05, SPEC 08c, SPEC 15, SPEC 16, SPEC 23
> **Fecha:** 2026-11-06
> **Objetivo:** Que en Personal se definan ingresos fijos (salario, arriendo recibido, proyectos, inversiones) que entran a las cuentas, se elijan al registrar un ingreso y que la hoja **+** del teléfono abra un solo diálogo de movimiento con todos los tipos en tabs.

## Por qué existe este spec

SPEC 04 dejó fuera los ingresos recurrentes. Hoy un salario quincenal se registra como un ingreso suelto y el usuario no sabe qué quincenas ya le pagaron. Tampoco hay forma de agrupar lo que entra de un proyecto o una inversión.

La hoja **+** del teléfono (SPEC 15) lista cinco acciones de registro sueltas. El diálogo de movimiento del escritorio ya tiene tabs para casi todas. Se unifican: una sola acción **Movimiento rápido** con todos los tipos.

## Alcance

**Entra:**

- **Tabla `recurring_incomes`** (solo Personal) con nombre, monto esperado, categoría de ingreso, cuenta destino por defecto (opcional), frecuencia, días de pago, mes de pago (solo anual), fecha de inicio, fecha de fin opcional y estado activo/pausado.
- **Frecuencias:**
  - **Mensual:** un día de pago (1–31).
  - **Quincenal:** dos días de pago configurables, por defecto 15 y 30.
  - **Anual:** día y mes de pago.
  - **Sin fecha fija:** para proyectos o inversiones. Sin días de pago ni ocurrencias.
  - Un día que no existe en el mes pasa al último día (30 → 28 o 29 de febrero; 31 → 30 de abril).
- **Página `/dashboard/personal/recurring-income`**, ítem **Ingresos fijos** en el aside justo después de **Gastos fijos** (`SITE.navigation.personal`, ícono `CalendarPlus`):
  - lista **Próximos ingresos** con las ocurrencias del mes actual y las no recibidas de los 2 meses anteriores;
  - estados **Recibido**, **Pendiente** (aún no llega el día), **De hoy** y **Atrasado** (pasó el día sin ingreso), con colores de `tone.ts`;
  - **Marcar recibido** abre `TransactionDialog` en el tab Ingreso con el ingreso fijo elegido, el monto esperado, la categoría y la cuenta por defecto prellenados (todo editable) y enlazado a esa ocurrencia;
  - lista de ingresos fijos con crear, editar, pausar/reanudar y eliminar con confirmación, con la misma estructura y lenguaje visual que **Gastos fijos**;
  - las fuentes **Sin fecha fija** muestran lo recibido en el mes y en el año, sin estados;
  - estados vacíos (`EmptyState`, `CardEmpty`), ayuda con `HelpHint` (textos en `src/config/help.ts`) y título por `DashboardTitle`.
- **Select "Ingreso fijo" en el tab Ingreso** de `TransactionDialog` (solo Personal):
  - es el primer campo del formulario cuando el tipo es Ingreso;
  - opciones: **Otro ingreso** (por defecto, para transferencias y cosas sueltas) y los ingresos fijos activos;
  - al elegir uno se prellenan monto esperado, categoría y cuenta por defecto, solo si el usuario no los cambió antes;
  - si tiene calendario, el movimiento se enlaza a su ocurrencia no recibida más antigua (atrasadas primero) y bajo el select se muestra el texto "Quincena del 15 nov" / "Mes de noviembre" / "Año 2026";
  - si no tiene ocurrencias no recibidas, o es **Sin fecha fija**, el movimiento queda enlazado a la fuente sin ocurrencia;
  - **Otro ingreso** guarda el movimiento sin enlace, como hoy.
- **Edición** de un ingreso enlazado desde Movimientos:
  - el select sigue disponible con el valor actual;
  - cambiar a otro ingreso fijo re-enlaza a la ocurrencia no recibida más antigua del nuevo;
  - cambiar a **Otro ingreso** quita el enlace y la ocurrencia vuelve a **Pendiente** o **Atrasado**;
  - sin cambiar el select, el enlace se conserva aunque cambien monto, fecha o cuenta.
  - Eliminar el movimiento devuelve la ocurrencia a su estado calculado.
- **Tabs del diálogo de movimiento** (escritorio y móvil, el mismo componente), en este orden en Personal: **Gasto**, **Ingreso**, **Traspaso**, **Deuda**, **Gasto fijo**, **Meta**.
  - **Meta** es nuevo: panel con `Select` de metas activas y el formulario de `ContributionDialog`; sin metas, `PanelEmpty` con enlace a Metas.
  - **Traspaso** sigue la regla actual (solo con dos cuentas o más).
  - En un teléfono angosto los tabs se desplazan en horizontal, como hoy.
  - En Empresa: **Venta**, **Costo o gasto**, **Traspaso**.
- **Hoja + del teléfono** (`quick-sheet.tsx`), en Personal y Empresa:
  1. **Movimiento rápido**: abre `TransactionDialog` con todos los tabs del espacio, en Gasto por defecto;
  2. **Categorías**: abre `CategoriesSheet`, como hoy;
  3. **Verificar movimientos**: abre `VerifyMovementsDialog`, como hoy.
  - Se quitan las acciones sueltas Gasto, Ingreso, Aporte a meta, Pago de deuda o tarjeta, Marcar gasto fijo pagado, Venta y Costo o gasto.
  - Se conservan el switch **Abrir al entrar**, el botón **Cerrar** y la apertura automática.
- **Datos:** el loader de `quick-actions.tsx` agrega los ingresos fijos activos con su ocurrencia no recibida más antigua, y el contexto `QuickActionsProvider` los expone. El diálogo de escritorio y la hoja los toman de ahí.
- **Documentación:** `docs/producto.md` (ingresos fijos y movimiento rápido), `docs/ui.md#móvil` (nueva hoja), `CLAUDE.md` si cambia alguna regla de UI y `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Ingresos fijos en Empresa.
- Tarjeta **Próximos ingresos** en el Resumen.
- Efecto en el score, recomendaciones, presupuestos y reportes (los movimientos cuentan como ingreso igual que hoy).
- Proyectos con monto total, % recibido o fecha de fin (estilo **Me deben**).
- Frecuencias semanal o cada 14 días.
- Varios movimientos (abonos parciales) por una misma ocurrencia.
- Importar ingresos fijos desde Excel/CSV.
- Recordatorios o notificaciones.
- Personalizar las acciones de la hoja **+**.
- Cambiar la barra inferior del teléfono.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_create_recurring_incomes.sql`:

```sql
create type public.income_frequency as enum ('monthly', 'biweekly', 'yearly', 'none');

create table public.recurring_incomes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount numeric(14, 2) not null check (amount > 0),         -- monto esperado
  category_id uuid not null references public.categories (id) on delete no action,
  account_id uuid references public.accounts (id) on delete set null, -- cuenta por defecto
  frequency public.income_frequency not null,
  day_of_month smallint check (day_of_month between 1 and 31),
  second_day_of_month smallint check (second_day_of_month between 1 and 31),
  month_of_year smallint check (month_of_year between 1 and 12),
  starts_on date not null,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((frequency = 'none') = (day_of_month is null)),
  check ((frequency = 'biweekly') = (second_day_of_month is not null)),
  check ((frequency = 'yearly') = (month_of_year is not null)),
  check (second_day_of_month is null or second_day_of_month > day_of_month),
  check (ends_on is null or ends_on >= starts_on)
);

create index recurring_incomes_workspace on public.recurring_incomes (workspace_id);

alter table public.transactions
  add column recurring_income_id uuid
    references public.recurring_incomes (id) on delete set null,
  add column recurring_income_due_on date;

-- Una ocurrencia se recibe una sola vez; sin ocurrencia, ilimitados
create unique index transactions_recurring_income_occurrence
  on public.transactions (recurring_income_id, recurring_income_due_on)
  where recurring_income_due_on is not null;
```

- **Triggers:**
  - `set_updated_at` en `recurring_incomes`.
  - `check_recurring_income` (`before insert or update` en `recurring_incomes`): el espacio es Personal; la categoría es de tipo `income` y del sistema o del mismo espacio; la cuenta, si llega, es del mismo espacio.
  - `check_transaction_recurring_income` (`before insert or update` en `transactions`):
    - si `recurring_income_id` es `null`, pone `recurring_income_due_on` en `null`;
    - si no, exige `type = 'income'` y que el ingreso fijo sea del mismo espacio;
    - `recurring_income_due_on` debe ser `null` en fuentes `none` y, en las demás, una fecha de vencimiento real de ese ingreso fijo.
  - Un movimiento no puede tener a la vez `recurring_expense_id` y `recurring_income_id`.
- **RLS** en `recurring_incomes`: `select` con `is_workspace_owner(workspace_id)`; `insert`, `update` y `delete` con `is_workspace_writable(workspace_id)`.
- **RPC** `recurring_income_occurrences(p_workspace_id uuid, p_from date, p_to date)` (`security invoker`, `stable`, `search_path = ''`, solo `authenticated`): devuelve `recurring_income_id, name, amount, category_id, account_id, due_on, transaction_id, received_amount`. Una fila por fecha de vencimiento en el rango, solo activos y con frecuencia distinta de `none`. Misma forma que `recurring_occurrences`.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Código nuevo en `src/features/recurring-incomes/` (`actions.ts`, `queries.ts`, `schemas.ts`, `types.ts`, `occurrences.ts`, `components/`), con la misma forma que `src/features/recurring-expenses/`.

```ts
// src/features/recurring-incomes/schemas.ts
export const INCOME_FREQUENCIES = [
  "monthly",
  "biweekly",
  "yearly",
  "none"
] as const

// src/features/recurring-incomes/queries.ts
export interface IncomeSourceOption {
  id: string
  name: string
  amount: number
  category_id: string
  account_id: string | null
  frequency: IncomeFrequency
  /** Ocurrencia no recibida más antigua; null si no hay o es "none" */
  nextDueOn: string | null
}

// Valor del select "Ingreso fijo" para "Otro ingreso"
export const OTHER_INCOME = "other"
```

`transactionSchema` agrega `recurring_income_id` (uuid o `"other"` → `null`). El servidor resuelve `recurring_income_due_on`; el cliente no lo envía.

```ts
// src/components/dashboard/mobile/quick-sheet.tsx
type QuickSheetAction = "movement" | "categories" | "verify"
```

`FormPanel` de `transaction-dialog.tsx` agrega `"goal"`. `PaymentTabsData` agrega `goals` (metas activas) e `incomeSources`.

## Plan de implementación

1. **Migración.** Enum, tabla, columnas en `transactions`, índice, triggers, RLS y RPC. Probar con `supabase db reset`; regenerar `src/types/database.ts`.
2. **Dominio.** `src/features/recurring-incomes/` con schemas Zod (días según frecuencia, segundo día > primero), cálculo de ocurrencias y ajuste a fin de mes en `occurrences.ts`, queries (`getRecurringIncomes`, `getUpcomingIncomes`, `getIncomeSources`) y actions (crear, editar, pausar/reanudar, eliminar) con `requireWritableWorkspace`.
3. **Página.** Ruta `app/dashboard/personal/recurring-income/page.tsx` con `buildMetadata`, ítem en `SITE.navigation.personal`, diálogo de ingreso fijo (`useActionState` + Zod, `validationBehavior="aria"`), lista de fuentes y **Próximos ingresos** sin **Marcar recibido** todavía. Textos de ayuda en `help.ts`.
4. **Enlace en movimientos.** `createTransaction` / `updateTransaction` aceptan `recurring_income_id` y resuelven la ocurrencia no recibida más antigua al crear o al cambiar de fuente; conservan el enlace si no cambia.
5. **Select en el tab Ingreso.** Campo **Ingreso fijo** primero, con **Otro ingreso** por defecto, prellenado y texto de la ocurrencia. Se activa **Marcar recibido** en la página.
6. **Datos compartidos.** Loader de `quick-actions.tsx` y `QuickActionsProvider` con `incomeSources` y metas activas; el `+` de escritorio los pasa en `paymentTabs`.
7. **Tab Meta.** Panel `goal` en `TransactionDialog` con `Select` de metas y el formulario de aporte; `PanelEmpty` sin metas. Orden de tabs Gasto, Ingreso, Traspaso, Deuda, Gasto fijo, Meta.
8. **Hoja +.** `quick-sheet.tsx` con **Movimiento rápido**, **Categorías** y **Verificar movimientos** en Personal y Empresa; quitar las acciones sueltas y su lógica de destinos de respaldo. Revisar los tours de SPEC 27 que apunten a la hoja.
9. **Docs y CHANGELOG.**
10. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [x] El aside de Personal muestra **Ingresos fijos** después de **Gastos fijos** y lleva a `/dashboard/personal/recurring-income`.
- [x] Se puede crear un ingreso fijo mensual, quincenal, anual y **Sin fecha fija**; el formulario pide solo los días que aplican a cada frecuencia.
- [ ] Un quincenal con días 15 y 30 genera en febrero las ocurrencias del 15 y del último día de febrero.
- [x] Un quincenal con segundo día menor o igual al primero es rechazado con error en el campo.
- [ ] **Próximos ingresos** muestra las ocurrencias del mes y las no recibidas de los 2 meses anteriores con estado **Recibido**, **Pendiente**, **De hoy** o **Atrasado**.
- [ ] **Marcar recibido** abre el diálogo en el tab Ingreso con el ingreso fijo, monto, categoría y cuenta por defecto prellenados; al guardar, el saldo de la cuenta sube y la ocurrencia pasa a **Recibido**.
- [x] Un ingreso fijo pausado no aparece en **Próximos ingresos** ni en el select.
- [x] En el tab Ingreso (Personal) el primer campo es **Ingreso fijo** y vale **Otro ingreso** por defecto.
- [x] Guardar con **Otro ingreso** crea un movimiento sin `recurring_income_id`.
- [ ] Elegir un quincenal con las quincenas del 15 y del 30 de octubre sin recibir enlaza el movimiento a la del 15 de octubre.
- [ ] Elegir una fuente **Sin fecha fija** guarda el movimiento enlazado a la fuente con `recurring_income_due_on` nulo, y se pueden registrar varios en el mismo mes.
- [ ] Un segundo movimiento para una ocurrencia ya recibida es rechazado por la base de datos.
- [ ] Editar un ingreso enlazado y pasarlo a **Otro ingreso** devuelve su ocurrencia a **Pendiente** o **Atrasado**.
- [ ] Eliminar el movimiento de una ocurrencia la devuelve a **Pendiente** o **Atrasado**.
- [x] El tab Ingreso de Empresa no muestra el select **Ingreso fijo**.
- [x] El diálogo de movimiento en Personal muestra los tabs Gasto, Ingreso, Traspaso, Deuda, Gasto fijo y Meta, en ese orden, en escritorio y a 390 px.
- [x] El tab **Meta** registra un aporte a la meta elegida; sin metas activas muestra el enlace a Metas.
- [x] A 390 px la hoja **+** de Personal y de Empresa muestra solo **Movimiento rápido**, **Categorías** y **Verificar movimientos**, más el switch **Abrir al entrar**.
- [x] **Movimiento rápido** en Empresa abre el diálogo con Venta, Costo o gasto y Traspaso.
- [ ] Un usuario no puede leer ni escribir `recurring_incomes` de otro usuario (RLS) ni crear uno en una empresa.
- [x] Con cifras ocultas, los montos de la página de ingresos fijos muestran `***`.
- [x] Todo par texto/fondo nuevo da AA en claro y oscuro.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

> Los criterios sin marcar dependen de la base de datos (RPC, triggers, índice único y RLS). La migración `20261106120000_create_recurring_incomes.sql` está revisada pero aún no se ha corrido: falta `supabase db reset` en local y regenerar `src/types/database.ts`.

## Decisiones

- **Sí:** tabla nueva `recurring_incomes` (decisión del usuario). No toca `recurring_expenses`, sus RPC, presupuestos ni la importación de SPEC 08b.
- **No:** generalizar `recurring_expenses` con una columna `kind`. Cambia checks, RPC y presupuestos ya implementados.
- **Sí:** frecuencias mensual, quincenal, anual y **Sin fecha fija** (decisión del usuario). Proyectos e inversiones son fuentes sin calendario.
- **Sí:** quincenal con dos días configurables, por defecto 15 y 30 (decisión del usuario).
- **No:** quincenal cada 14 días desde el inicio. No coincide con cómo se paga la nómina en Colombia.
- **Sí:** monto esperado obligatorio y editable al registrar (decisión del usuario).
- **Sí:** cuenta destino por defecto opcional que prellena (decisión del usuario). Si la cuenta se borra, queda en `null`.
- **Sí:** página propia `/dashboard/personal/recurring-income` (decisión del usuario), no un tab dentro de Gastos fijos.
- **Sí:** el select enlaza a la ocurrencia no recibida más antigua (decisión del usuario). Un solo campo; no hay segundo select.
- **No:** segundo select de ocurrencia. Más pasos en el teléfono.
- **Sí:** el enlace se puede cambiar al editar (decisión del usuario), a diferencia del pago de gasto fijo.
- **Sí:** el servidor resuelve `recurring_income_due_on`. Evita que el cliente enlace una ocurrencia ya recibida.
- **Sí:** **Marcar recibido** solo aparece en la ocurrencia no recibida más antigua de cada ingreso fijo (decisión del usuario al implementar). Es la que el servidor enlaza, así el botón nunca registra otra ocurrencia distinta a la de su fila.
- **Sí:** un movimiento por ocurrencia, como gastos fijos. Abonos parciales quedan fuera.
- **Sí:** estado de la ocurrencia calculado, no guardado. Depende de la fecha de hoy, igual que SPEC 04 y 28.
- **Sí:** un solo `TransactionDialog` con los mismos tabs en escritorio y móvil, más el tab **Meta** (decisión del usuario).
- **Sí:** hoja **+** con **Movimiento rápido**, **Categorías** y **Verificar movimientos** en los dos espacios (decisión del usuario). Reemplaza la lista de acciones de SPEC 15.
- **No:** **Próximos ingresos** en el Resumen. Queda para otro spec.
- **Sí:** ingresos fijos solo en Personal. Empresa ya tiene Ventas.

## Riesgos

| Riesgo                                                             | Mitigación                                                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Seis tabs no caben en un teléfono de 360 px                        | Desplazamiento horizontal sin barra, como hoy; el tab activo se lleva a la vista con `scrollIntoView`.                      |
| Dos movimientos crean a la vez el mismo enlace a una ocurrencia    | El índice único rechaza el segundo; la action reintenta una vez con la siguiente no recibida o deja error.                  |
| Zona horaria al decidir **Atrasado**                               | Comparar fechas `YYYY-MM-DD` en Bogotá, igual que gastos fijos.                                                             |
| Los tours de SPEC 27 apuntan a acciones de la hoja que desaparecen | Revisar y actualizar los pasos en el paso 8 del plan.                                                                       |
| El prellenado pisa lo que el usuario ya escribió                   | Solo se prellenan campos vacíos o aún con el valor prellenado anterior.                                                     |
| Cambiar la frecuencia o los días de un ingreso fijo con historial  | Las ocurrencias recibidas quedan con su fecha guardada; las ya recibidas que no calcen se muestran igual como **Recibido**. |

## Qué **no** entra en este spec

- Ingresos fijos en Empresa.
- Tarjeta **Próximos ingresos** en el Resumen.
- Score, recomendaciones, presupuestos y reportes de ingresos fijos.
- Proyectos con monto total o % recibido.
- Frecuencias semanal o cada 14 días.
- Abonos parciales por ocurrencia.
- Importación, recordatorios y acciones personalizables de la hoja.
