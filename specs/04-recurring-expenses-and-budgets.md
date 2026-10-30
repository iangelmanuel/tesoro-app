# SPEC 04 — Gastos fijos y presupuestos

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 03
> **Fecha:** 2026-10-30
> **Objetivo:** Que el usuario defina en su espacio Personal gastos fijos recurrentes y presupuestos mensuales por categoría, registre a mano el pago de cada gasto fijo y vea cuánto lleva gastado contra cada presupuesto.

## Por qué existe este spec

Los SPEC 02 y 03 muestran lo que ya pasó. Este spec agrega la planificación del mes: lo que se debe pagar (gastos fijos) y lo que se quiere gastar como máximo (presupuestos).
Las dos piezas comparten pantalla porque se cruzan: un gasto fijo pendiente ya compromete parte del presupuesto de su categoría.
También deja `budget_progress` y `recurring_occurrences`, que reutilizan el score (07) y las recomendaciones.

## Alcance

**Entra:**

- Tabla `recurring_expenses` con nombre, monto, categoría de gasto, frecuencia (mensual o anual), día de pago, mes de pago (solo anual), fecha de inicio, fecha de fin opcional y estado activo/pausado.
- Tabla `budgets` con monto por categoría de gasto y mes, única por categoría y mes.
- Columnas `recurring_expense_id` y `recurring_due_on` opcionales en `transactions`.
- RPC `recurring_occurrences` (ocurrencias de un rango con su estado de pago) y `budget_progress` (presupuestado, gastado y comprometido por categoría en un mes).
- Página `/dashboard/personal/budgets` con dos tabs en la URL (`?tab=budgets` por defecto y `?tab=recurring`):
  - **Presupuestos:**
    - navegación por mes con `?month=YYYY-MM` y flechas anterior/siguiente, por defecto el mes actual en Bogotá; todos los meses se pueden ver y editar;
    - tarjetas de total presupuestado, gastado y restante del mes;
    - una fila por presupuesto con barra de progreso: gastado sólido + comprometido rayado;
    - alertas visuales: ámbar "Cerca del límite" con gastado ≥ 80 % y rojo "Excedido" con gastado ≥ 100 %;
    - crear y editar en un diálogo, y eliminar con confirmación;
    - botón "Copiar del mes anterior", que solo crea los presupuestos que faltan;
    - sección "Sin presupuesto" con las categorías de gasto que tienen movimientos en el mes y no tienen presupuesto, con botón "Presupuestar".
  - **Gastos fijos:**
    - lista "Próximos pagos" con las ocurrencias del mes actual (pagadas, vencidas, de hoy y próximas) y las impagas de los 2 meses anteriores;
    - "Marcar como pagado" abre `TransactionDialog` prellenado y enlazado a la ocurrencia;
    - lista de gastos fijos con crear, editar, pausar/reanudar y eliminar con confirmación.
- En Resumen (`/dashboard/personal`), dos tarjetas:
  - "Próximos pagos": hasta 5 ocurrencias pendientes, vencidas primero, con "Marcar como pagado";
  - "Presupuestos en riesgo": hasta 5 presupuestos del mes con gastado ≥ 80 %, ordenados por %.
  - Ambas con enlace "Ver todos" a la tab correspondiente.
- Estados vacíos en las dos tabs y en las dos tarjetas.

**Fuera de alcance (para specs futuros):**

- Notificaciones por email o push.
- Generación automática de movimientos sin confirmar.
- Frecuencias quincenal, semanal o personalizadas.
- Presupuesto total del mes independiente de las categorías.
- Presupuestos de ingresos.
- Ingresos recurrentes (salario fijo).
- Arrastrar a otro mes el sobrante o el exceso de un presupuesto.
- Presupuestos o gastos fijos en el espacio Empresa.
- Metas de ahorro (SPEC 05).
- Deshacer un pago desde la lista de próximos pagos. Se hace borrando el movimiento en Movimientos.
- Comparativas de presupuesto en Reportes.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_create_recurring_expenses_and_budgets.sql`:

```sql
create type public.recurring_frequency as enum ('monthly', 'yearly');

create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount numeric(14, 2) not null check (amount > 0),
  category_id uuid not null references public.categories (id) on delete restrict,
  frequency public.recurring_frequency not null,
  day_of_month smallint not null check (day_of_month between 1 and 31),
  month_of_year smallint check (month_of_year between 1 and 12),
  starts_on date not null,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((frequency = 'yearly') = (month_of_year is not null)),
  check (ends_on is null or ends_on >= starts_on)
);

create index recurring_expenses_workspace on public.recurring_expenses (workspace_id);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  month date not null check (extract(day from month) = 1),
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, category_id, month)
);

alter table public.transactions
  add column recurring_expense_id uuid
    references public.recurring_expenses (id) on delete set null,
  add column recurring_due_on date;

-- Una ocurrencia se paga una sola vez
create unique index transactions_recurring_occurrence
  on public.transactions (recurring_expense_id, recurring_due_on)
  where recurring_expense_id is not null;
```

- **Triggers:**
  - `set_updated_at` (`before update`) en `recurring_expenses` y `budgets`.
  - `check_expense_category` (`before insert or update` en `recurring_expenses` y `budgets`): la categoría debe ser de tipo `expense` y del sistema o del mismo `workspace_id`. Si no, lanza un error.
  - `check_transaction_recurring` (`before insert or update` en `transactions`):
    - si `recurring_expense_id` es `null`, pone `recurring_due_on` en `null` (cubre el `on delete set null`);
    - si no, exige `recurring_due_on`, `type = 'expense'` y que el gasto fijo sea del mismo `workspace_id`.
- **RLS** activo en las dos tablas nuevas: `select`, `insert`, `update` y `delete` con `is_workspace_owner(workspace_id)` (`using` y `with check`).
- **RPC** (`security invoker`, `stable`, `search_path = ''`, `grant execute` solo a `authenticated`):
  - `recurring_occurrences(p_workspace_id uuid, p_from date, p_to date)` devuelve `recurring_expense_id, name, amount, category_id, due_on date, transaction_id uuid, paid_amount numeric`:
    - solo gastos fijos con `is_active`;
    - una fila por cada fecha de vencimiento dentro de `[p_from, p_to]`, `starts_on` y `ends_on`;
    - `transaction_id` y `paid_amount` vienen del movimiento enlazado, o `null` si está pendiente.
  - `budget_progress(p_workspace_id uuid, p_month date)` devuelve `category_id, name, icon, color, archived, budget_id, budget_amount, spent, committed`:
    - una fila por cada presupuesto del mes y por cada categoría de gasto con movimientos en el mes sin presupuesto (`budget_id` y `budget_amount` en `null`);
    - `spent`: suma de gastos de la categoría en el mes, futuros incluidos;
    - `committed`: suma de `amount` de las ocurrencias pendientes de esa categoría con vencimiento en el mes.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Reglas de vencimiento:

| Frecuencia | Vencimiento                                   | Ejemplo                                       |
| ---------- | --------------------------------------------- | --------------------------------------------- |
| `monthly`  | `day_of_month` de cada mes                    | día 31 en noviembre → 30 de noviembre         |
| `yearly`   | `day_of_month` de `month_of_year` de cada año | 29 de febrero en 2027 → 28 de febrero de 2027 |

- Si el día no existe en el mes, el vencimiento cae en el último día del mes.
- La primera ocurrencia es el primer vencimiento ≥ `starts_on`. La última es el último ≤ `ends_on`.

Estado de una ocurrencia (fechas en `America/Bogota`):

| Estado  | Condición                  | Estilo |
| ------- | -------------------------- | ------ |
| Pagado  | tiene `transaction_id`     | verde  |
| Vencido | pendiente y `due_on < hoy` | rojo   |
| Hoy     | pendiente y `due_on = hoy` | ámbar  |
| Próximo | pendiente y `due_on > hoy` | neutro |

Estado de un presupuesto (`spent / budget_amount`):

| Rango       | Etiqueta         | Color  |
| ----------- | ---------------- | ------ |
| < 80 %      | —                | neutro |
| 80 % – 99 % | Cerca del límite | ámbar  |
| ≥ 100 %     | Excedido         | rojo   |

- `committed` no cambia el estado. Si `spent + committed` supera el 80 % o el 100 %, la fila dice "Con pagos pendientes llegarías al X %".

Parámetros de URL de `/dashboard/personal/budgets`:

| Parámetro | Valores                | Por defecto                    |
| --------- | ---------------------- | ------------------------------ |
| `tab`     | `budgets`, `recurring` | `budgets`                      |
| `month`   | `YYYY-MM`              | mes actual en `America/Bogota` |

- `month` solo aplica a la tab `budgets`. Un valor inválido cae a su valor por defecto.

## Plan de implementación

1. **Migración.**
   - Crear la migración del modelo de datos con tipo, tablas, columnas, índices, triggers, RLS y RPC.
   - Aplicarla con `supabase db push` (o `supabase db reset` en local) y regenerar `src/types/database.ts`.
   - Verificar: `recurring_occurrences` de un gasto mensual del día 31 devuelve el 30 de noviembre y el 28 de febrero.
2. **Componentes shadcn.**
   - Agregar `tabs` si no existe.
   - `progress` no se usa: la barra de presupuesto es propia porque necesita el segmento comprometido rayado y colores por estado.
   - Verificar: `pnpm check`, `pnpm eslint`, `pnpm build` pasan y el lockfile queda sincronizado.
3. **Gastos fijos: esquemas, consultas y acciones.**
   - `src/features/recurring-expenses/schemas.ts` (Zod): `name` de 1 a 60, `amount` igual que movimientos, `frequency`, `day_of_month` 1–31, `month_of_year` 1–12 obligatorio solo en `yearly`, `starts_on`, `ends_on` ≥ `starts_on`.
   - `src/features/recurring-expenses/occurrences.ts`: estado de cada ocurrencia y etiqueta de frecuencia ("Mensual, día 5", "Anual, 15 de marzo").
   - `src/features/recurring-expenses/queries.ts`: `getRecurringExpenses(workspaceId)` y `getUpcomingPayments(workspaceId)` (RPC del primer día de hace 2 meses al fin del mes actual; impagas de meses anteriores y todas las del mes actual).
   - `src/features/recurring-expenses/actions.ts` (`"use server"`): `createRecurringExpense`, `updateRecurringExpense`, `toggleRecurringExpense`, `deleteRecurringExpense`. Solo aceptan categorías de gasto activas.
4. **Pago enlazado.**
   - `src/features/transactions/schemas.ts` acepta `recurring_expense_id` y `recurring_due_on` opcionales.
   - `createTransaction` valida que el gasto fijo sea del workspace Personal del usuario. Una ocurrencia ya pagada devuelve "Este pago ya está registrado".
   - `TransactionDialog` recibe valores iniciales y el enlace a la ocurrencia en campos ocultos.
   - Prellenado: tipo gasto, monto, categoría (vacía si está archivada, con aviso), fecha = vencimiento y descripción = nombre del gasto fijo.
   - Editar el movimiento desde Movimientos conserva el enlace.
   - Las acciones de movimientos revalidan también `/dashboard/personal/budgets`.
5. **Tab Gastos fijos.**
   - `app/dashboard/personal/budgets/page.tsx` reemplaza el placeholder, con `buildMetadata` `noindex`, `Suspense` y tabs que escriben `?tab`.
   - `src/features/recurring-expenses/components/`:
     - `upcoming-payments.tsx`: fecha, nombre, `CategoryBadge`, monto, estado y "Marcar como pagado" o el monto pagado;
     - `recurring-expense-dialog.tsx` (client, `useActionState`): crear y editar; el mes de pago solo aparece en anual;
     - `recurring-expenses-list.tsx`: nombre, badge, monto, frecuencia, vigencia, estado, y acciones editar, pausar/reanudar y eliminar (`alert-dialog` que avisa que los movimientos se conservan).
6. **Presupuestos: esquemas, consultas y acciones.**
   - `src/features/budgets/month.ts`: parsea `?month` y devuelve `{ month, label, prev, next }` en Bogotá.
   - `src/features/budgets/schemas.ts` (Zod): `category_id`, `month` (primer día de mes) y `amount` igual que movimientos.
   - `src/features/budgets/queries.ts`: `getBudgetProgress(workspaceId, month)` (RPC, convierte `numeric` con `Number()`).
   - `src/features/budgets/actions.ts` (`"use server"`): `upsertBudget`, `deleteBudget` y `copyPreviousMonthBudgets`.
     - `copyPreviousMonthBudgets` inserta con `on conflict do nothing`, omite categorías archivadas y devuelve cuántos copió.
     - `upsertBudget` no acepta categorías archivadas ni de ingreso.
7. **Tab Presupuestos.**
   - `src/features/budgets/components/`:
     - `budget-month-nav.tsx` (client): flechas y etiqueta del mes, escribe `?month`;
     - `budget-totals.tsx`: total presupuestado, gastado y restante (negativo en rojo);
     - `budget-progress-row.tsx`: badge, "gastado de presupuestado", barra con segmento comprometido rayado, etiqueta de estado y aviso de pendientes;
     - `budget-dialog.tsx` (client): crear y editar; el selector solo lista categorías de gasto activas sin presupuesto en el mes;
     - `unbudgeted-categories.tsx`: sección "Sin presupuesto" con total gastado y botón "Presupuestar" que abre el diálogo con la categoría elegida.
   - Botón "Copiar del mes anterior" con toast "Se copiaron N presupuestos" o "No hay presupuestos nuevos para copiar".
8. **Widgets del Resumen.**
   - `src/features/budgets/components/budgets-at-risk-card.tsx` y `src/features/recurring-expenses/components/upcoming-payments-card.tsx`.
   - Se montan en `app/dashboard/personal/page.tsx` dentro de `Suspense`, después de las tarjetas de métricas.
9. **Estados vacíos.**
   - Tab Presupuestos sin presupuestos en el mes: "Aún no tienes presupuestos para este mes" con "Crear presupuesto" y, si el mes anterior tiene, "Copiar del mes anterior".
   - Tab Gastos fijos sin gastos fijos: "Agrega tus gastos fijos" con el botón de crear.
   - Próximos pagos sin pendientes: "Estás al día con tus pagos".
   - Tarjetas del Resumen: "No tienes pagos pendientes" y "Ningún presupuesto en riesgo".
10. **Docs.**
    - `docs/producto.md`: modelo de gastos fijos y presupuestos, reglas de vencimiento, estados y umbrales.
    - `ROADMAP.md`: respuestas a las preguntas abiertas del SPEC 04.
    - `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona y las dependencias nuevas tienen versión exacta.
- [ ] La migración se aplica sin errores y `src/types/database.ts` incluye `recurring_expenses`, `budgets`, las columnas nuevas de `transactions`, `recurring_occurrences` y `budget_progress`.
- [ ] `/dashboard/personal/budgets` sin parámetros abre la tab Presupuestos del mes actual. `?tab=recurring` abre Gastos fijos. Recargar conserva tab y mes.
- [ ] Crear el gasto fijo "Arriendo", 1.200.000, Vivienda, mensual, día 5, desde el 1 de octubre de 2026, lo muestra en la lista como "Mensual, día 5".
- [ ] Crear un gasto fijo anual sin mes de pago, con monto 0 o con fin antes del inicio muestra un error de validación en español y no escribe en la BD.
- [ ] Un gasto fijo mensual del día 31 vence el 30 de noviembre de 2026 y el 28 de febrero de 2027.
- [ ] Un gasto fijo que empieza el 20 de octubre con día de pago 5 no aparece en octubre y vence por primera vez el 5 de noviembre.
- [ ] El 10 de octubre, "Arriendo" del día 5 sin pagar aparece como "Vencido". Uno del día 10 aparece como "Hoy" y uno del 20 como "Próximo".
- [ ] "Marcar como pagado" abre el diálogo con tipo gasto, monto 1.200.000, Vivienda, fecha 5 de octubre y descripción "Arriendo". Cambiar el monto a 1.250.000 y guardar crea el movimiento con ese monto.
- [ ] Tras pagar, la ocurrencia aparece como "Pagado" con `$ 1.250.000` y el movimiento aparece en Movimientos.
- [ ] Registrar dos veces la misma ocurrencia falla en la BD aunque se salte la validación del cliente.
- [ ] Borrar el movimiento del pago en Movimientos devuelve la ocurrencia a pendiente.
- [ ] En noviembre, el arriendo de octubre sin pagar sigue en Próximos pagos como "Vencido". En enero ya no aparece.
- [ ] Pausar un gasto fijo lo quita de Próximos pagos y del comprometido. Reanudarlo lo devuelve.
- [ ] Eliminar un gasto fijo con pagos conserva sus movimientos, con `recurring_expense_id` y `recurring_due_on` en `null`.
- [ ] Crear un presupuesto de Comida de 800.000 para el mes lo muestra con su barra. Crear otro de Comida para el mismo mes no es posible.
- [ ] No se puede crear un presupuesto para una categoría de ingreso ni archivada, ni desde la UI ni saltando la validación del cliente.
- [ ] Con 640.000 gastados en Comida de 800.000, la fila muestra 80 % y "Cerca del límite" en ámbar. Con 800.000 muestra "Excedido" en rojo.
- [ ] Con Vivienda presupuestada en 1.500.000, 200.000 gastados y el arriendo de 1.200.000 pendiente en el mes, la barra muestra 13 % sólido más el segmento rayado y el aviso "Con pagos pendientes llegarías al 93 %". El estado no cambia.
- [ ] Las tarjetas muestran total presupuestado, gastado (solo categorías con presupuesto) y restante. Un restante negativo se ve en rojo.
- [ ] Una categoría con gastos en el mes y sin presupuesto aparece en "Sin presupuesto". "Presupuestar" abre el diálogo con esa categoría.
- [ ] "Copiar del mes anterior" con Comida y Transporte en septiembre y Comida ya definida en octubre crea solo Transporte, deja Comida igual y muestra "Se copiaron 1 presupuestos".
- [ ] Las flechas del mes navegan a meses pasados y futuros, y en ambos se pueden crear, editar y eliminar presupuestos.
- [ ] Un movimiento futuro dentro del mes suma en el gastado de su categoría.
- [ ] Resumen muestra "Próximos pagos" con hasta 5 pendientes, vencidos primero, y "Marcar como pagado" funciona desde ahí.
- [ ] Resumen muestra "Presupuestos en riesgo" con hasta 5 presupuestos del mes con gastado ≥ 80 %, ordenados por %.
- [ ] Los estados vacíos de las dos tabs y de las dos tarjetas muestran los textos definidos.
- [ ] Un usuario A, con su sesión y la clave publicable, no puede leer, crear, editar ni borrar gastos fijos o presupuestos del workspace de B, y `recurring_occurrences` y `budget_progress` con el workspace de B devuelven vacío.
- [ ] Enlazar un movimiento a un gasto fijo de otro workspace falla en la BD.
- [ ] Un cliente `anon` no puede ejecutar las RPC nuevas.

## Decisiones

- **Sí:** el pago se registra a mano con `TransactionDialog` prellenado y editable. El monto real puede variar (servicios) y nada se crea sin confirmar.
- **No:** crear el movimiento en un clic. Obligaría a editar después cuando el monto cambia.
- **No:** generar movimientos automáticamente. Exige cron y crea datos que el usuario no confirmó.
- **Sí:** frecuencias mensual y anual. Cubren arriendo, servicios, suscripciones y seguros.
- **No:** quincenal y semanal. Más modelo y más UI; pueden llegar en otro spec.
- **Sí:** un día que no existe en el mes cae al último día. Evita saltar meses cortos.
- **Sí:** presupuestos solo por categoría de gasto. El total del mes es la suma.
- **No:** presupuesto global independiente. Abre el conflicto entre total y suma de categorías.
- **Sí:** gastos fijos como tab dentro de Presupuestos. Los dos son planificación del mes y no hace falta un ítem nuevo en el aside.
- **No:** ruta `/dashboard/personal/recurring` ni Sheet desde Movimientos. Un ítem más en el aside, o la lista de próximos pagos escondida.
- **Sí:** columna `recurring_due_on` con índice único por ocurrencia. Un pago adelantado cuenta para su vencimiento y no se puede pagar dos veces.
- **No:** inferir el pago por `occurred_on`. Un pago adelantado caería en el periodo equivocado.
- **Sí:** las ocurrencias se calculan en una RPC, no se guardan. No hay filas que mantener al editar un gasto fijo.
- **Sí:** comprometido como segmento aparte, sin cambiar el estado. El usuario ve lo que viene sin que la app diga "Excedido" antes de gastar.
- **Sí:** Próximos pagos incluye los impagos de los 2 meses anteriores. Un pago olvidado no desaparece al cambiar de mes, y la lista no crece sin límite.
- **Sí:** el comprometido solo cuenta ocurrencias del mes del presupuesto. Los vencidos de meses anteriores no se mezclan con el mes actual.
- **Sí:** copiar solo crea lo que falta y omite archivadas. Nunca pisa montos que el usuario ya definió.
- **No:** reemplazar todo al copiar. Riesgo de perder cambios con un clic.
- **Sí:** pausar y eliminar. Al eliminar, los movimientos quedan con el enlace en `null` (`on delete set null` + trigger). La historia nunca se pierde.
- **No:** borrar en cascada los movimientos. Perdería historia financiera.
- **Sí:** todos los meses se ven y editan con `?month`. Permite planear y corregir sin reglas extra.
- **Sí:** sección "Sin presupuesto". Muestra dónde se gasta sin control.
- **Sí:** el gastado de las tarjetas solo suma categorías con presupuesto. Así restante = presupuestado − gastado.
- **Sí:** triggers `check_expense_category` y `check_transaction_recurring` además de Zod. Las reglas de tipo y espacio no dependen del cliente.
- **Sí:** si la categoría del gasto fijo está archivada, el diálogo de pago deja la categoría vacía con un aviso. Respeta la regla del SPEC 02 de no crear movimientos con categorías archivadas.
- **Sí:** en Resumen, top 5 de próximos pagos y de presupuestos en riesgo. Accionable sin ocupar toda la página.

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `on delete set null` deja `recurring_due_on` con valor                   | El trigger `check_transaction_recurring` pone `recurring_due_on` en `null` cuando `recurring_expense_id` es `null`                   |
| El cálculo de vencimientos en SQL falla en meses cortos o años bisiestos | `least(day_of_month, último día del mes)` y criterios de aceptación con 30 de noviembre y 28 de febrero                              |
| "Hoy" y "mes actual" cambian según la zona horaria del servidor          | Se calculan siempre en `America/Bogota`, igual que en SPEC 02 y 03                                                                   |
| Doble clic en "Marcar como pagado" crea dos movimientos                  | Índice único por ocurrencia y mensaje "Este pago ya está registrado"                                                                 |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas       | Página y tarjetas leen sesión y `searchParams` dentro de `Suspense`. Antes de implementar se consulta `node_modules/next/dist/docs/` |
| Los datos no se refrescan tras pagar desde el Resumen                    | Las acciones de movimientos, gastos fijos y presupuestos revalidan Resumen, Presupuestos, Movimientos y Reportes                     |
| `numeric` llega como `number` o `string`                                 | Las consultas convierten con `Number()`                                                                                              |

## Lo que **no** entra en este spec

- Notificaciones por email o push.
- Generación automática de movimientos.
- Frecuencias quincenal, semanal o personalizadas.
- Presupuesto total del mes y presupuestos de ingresos.
- Ingresos recurrentes.
- Arrastrar sobrantes o excesos entre meses.
- Presupuestos y gastos fijos en Empresa.
- Metas de ahorro.
- Deshacer un pago desde Próximos pagos.
- Comparativas de presupuesto en Reportes.

Cada uno de esos puntos, si llega, va en su propio spec.
