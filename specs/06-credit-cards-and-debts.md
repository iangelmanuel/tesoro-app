# SPEC 06 — Tarjetas de crédito y deudas

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 04, SPEC 05
> **Fecha:** 2026-10-30
> **Objetivo:** Que el usuario registre en su espacio Personal sus tarjetas de crédito, préstamos y cuentas por cobrar, con pagos, ajustes de saldo, próximos vencimientos y una proyección de cuándo termina de pagar cada deuda.

## Por qué existe este spec

Los SPEC 02 a 05 cubren lo que entra, lo que sale, lo que se planea y lo que se ahorra. Falta lo que se debe y lo que le deben al usuario.
El saldo de una deuda **no se guarda ni se pisa**: es el saldo inicial menos los pagos más los ajustes. Así el historial explica cada cambio y editar un pago viejo no descuadra nada.
Las compras con tarjeta ya son gastos (SPEC 02). Por eso el pago de una tarjeta **no** crea un movimiento: contaría el mismo consumo dos veces. Los pagos de préstamos y los abonos de cuentas por cobrar sí pueden crear su movimiento.
Del SPEC 04 reutiliza `revalidatePersonalPages`, `EmptyState` / `CardEmpty`, la regla de "día inexistente → último día del mes" y la ubicación de las tarjetas del Resumen. Del SPEC 05, el patrón de Sheet con historial, la sección plegable de inactivas y los triggers de saldo.
Deja la RPC `debt_overview`, que puede usar el score (07) para deuda sobre ingresos y utilización.

## Alcance

**Entra:**

- Tablas `debts` (tres tipos: tarjeta, préstamo y cuenta por cobrar) y `debt_entries` (pagos y ajustes).
- Categorías de sistema nuevas: "Deudas" (gasto) y "Cobros" (ingreso).
- RPC `debt_overview` (saldo y ciclo de pago por deuda) y `record_debt_payment` (pago y movimiento en una sola operación).
- Página `/dashboard/personal/debts`, que reemplaza el placeholder, con dos tabs en la URL (`?tab=debts` por defecto y `?tab=receivables`):
  - **Debo:**
    - tarjetas de deuda total, utilización global de tarjetas e interés estimado del mes;
    - lista "Próximos pagos" con el próximo vencimiento de cada tarjeta y préstamo activo y su estado;
    - tarjetas de cada deuda activa, ordenadas por próximo vencimiento, con saldo, tasa, utilización (tarjetas), % pagado (préstamos con monto original), próximo vencimiento y proyección;
    - botón "Nueva deuda" y diálogo para crear y editar, con selector de tipo (tarjeta o préstamo) solo al crear;
    - menú por deuda con editar, actualizar saldo, marcar como pagada (solo con saldo 0) y archivar;
    - sección plegable "Pagadas y archivadas", con la acción "Reactivar".
  - **Me deben:**
    - tarjeta de total "Te deben";
    - tarjetas de cada cuenta por cobrar activa con deudor, saldo, % cobrado, fecha esperada y la etiqueta "Vencida" si aplica;
    - botón "Nueva cuenta por cobrar", diálogo de crear y editar, y menú con editar, actualizar saldo, marcar como cobrada (solo con saldo 0) y archivar;
    - sección plegable "Cobradas y archivadas", con "Reactivar".
- Sheet por deuda o cuenta por cobrar, que se abre desde su tarjeta:
  - resumen con saldo y datos del tipo;
  - en tarjetas y préstamos: proyección y simulador "Si pagaras X al mes";
  - botones "Registrar pago" (o "Registrar abono") y "Actualizar saldo";
  - historial de pagos y ajustes, con editar y eliminar con confirmación;
  - en pagadas, cobradas o archivadas: solo lectura y el botón "Reactivar".
- Pago de préstamo con la casilla "Registrar como gasto" (marcada por defecto), que crea el movimiento en "Deudas". Abono con la casilla "Registrar como ingreso" (marcada por defecto), que crea el movimiento en "Cobros".
- En Resumen (`/dashboard/personal`), la tarjeta "Deudas" con deuda total, utilización global (si hay tarjetas) y hasta 3 próximos pagos, con el enlace "Ver todas".
- Estados vacíos en las dos tabs, en las secciones de inactivas, en el historial y en la tarjeta del Resumen.

**Fuera de alcance (para specs futuros):**

- Compras en cuotas detalladas por tarjeta.
- Extractos bancarios o importación de movimientos de la tarjeta.
- Marcar un gasto como "pagado con tarjeta X" para subir su saldo automáticamente.
- Separar cada pago en interés y abono a capital.
- Estrategias de pago avanzadas (avalancha, bola de nieve). Las sugiere el SPEC 07.
- Proyección con el promedio de pagos reales.
- Intereses o proyección en cuentas por cobrar.
- Eliminar deudas. Solo se archivan.
- Monedas distintas de COP.
- Notificaciones de vencimientos.
- Deudas en el espacio Empresa.
- Deudas dentro de "Próximos pagos" del SPEC 04 o en las tarjetas y gráficas del SPEC 03.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_create_debts.sql`:

```sql
create type public.debt_kind as enum ('credit_card', 'loan', 'receivable');
create type public.debt_status as enum ('active', 'paid', 'archived');
create type public.rate_type as enum ('ea', 'mv');
create type public.debt_entry_kind as enum ('payment', 'adjustment');

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.debt_kind not null,
  name text not null check (char_length(name) between 1 and 60),
  counterparty text check (char_length(counterparty) <= 60), -- entidad, acreedor o deudor
  opening_balance numeric(14, 2) not null check (opening_balance >= 0),
  credit_limit numeric(14, 2) check (credit_limit > 0),       -- tarjeta
  min_payment numeric(14, 2) check (min_payment > 0),         -- tarjeta
  closing_day smallint check (closing_day between 1 and 31),  -- tarjeta
  installment numeric(14, 2) check (installment > 0),         -- préstamo
  original_amount numeric(14, 2) check (original_amount > 0), -- préstamo
  term_months smallint check (term_months between 1 and 600), -- préstamo
  interest_rate numeric(6, 3) check (interest_rate >= 0),     -- porcentaje
  rate_type public.rate_type,
  due_day smallint check (due_day between 1 and 31),          -- tarjeta y préstamo
  expected_on date,                                           -- cuenta por cobrar
  status public.debt_status not null default 'active',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((interest_rate is null) = (rate_type is null)),
  check (rate_type <> 'ea' or interest_rate <= 200),
  check (rate_type <> 'mv' or interest_rate <= 10),
  check ((status = 'paid') = (closed_at is not null)),
  check (
    case kind
      when 'credit_card' then
        credit_limit is not null and due_day is not null
        and installment is null and original_amount is null
        and term_months is null and expected_on is null
      when 'loan' then
        installment is not null and due_day is not null
        and interest_rate is not null and opening_balance > 0
        and credit_limit is null and min_payment is null
        and closing_day is null and expected_on is null
      when 'receivable' then
        opening_balance > 0 and interest_rate is null
        and credit_limit is null and min_payment is null
        and closing_day is null and installment is null
        and original_amount is null and term_months is null
        and due_day is null
    end
  ),
  -- Destino de la FK compuesta de debt_entries
  unique (id, workspace_id)
);

create index debts_workspace on public.debts (workspace_id);

create table public.debt_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  debt_id uuid not null,
  kind public.debt_entry_kind not null,
  amount numeric(14, 2) not null check (amount <> 0), -- ajuste: > 0 sube el saldo, < 0 lo baja
  occurred_on date not null,
  note text check (char_length(note) <= 120),
  transaction_id uuid unique references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'adjustment' or amount > 0),
  check (kind = 'payment' or transaction_id is null),
  -- La entrada siempre es del mismo espacio que su deuda
  foreign key (debt_id, workspace_id)
    references public.debts (id, workspace_id) on delete cascade
);

create index debt_entries_debt
  on public.debt_entries (debt_id, occurred_on desc, created_at desc);

insert into public.categories (workspace_id, type, name, icon, color) values
  (null, 'expense', 'Deudas', 'landmark', 'slate'),
  (null, 'income', 'Cobros', 'coins', 'teal');
```

Saldo de una deuda:

```text
saldo = opening_balance − Σ amount (payment) + Σ amount (adjustment)
```

- **Triggers:**
  - `set_updated_at` (`before update`) en `debts` y `debt_entries`.
  - `check_debt_update` (`before update` en `debts`): `kind` no cambia.
  - `check_debt_entry` (`before insert or update or delete` en `debt_entries`):
    - la deuda debe estar `active` (en `delete` se revisa la fila vieja);
    - `debt_id` y `kind` no cambian en un `update`;
    - `occurred_on` ≤ hoy en `America/Bogota`;
    - con `transaction_id`: la deuda es `loan` y el movimiento es `expense`, o la deuda es `receivable` y el movimiento es `income`; el movimiento es del mismo `workspace_id`. Una tarjeta nunca tiene `transaction_id`.
    - Si no, lanza un error.
  - `check_debt_balance` (`after insert or update or delete` en `debt_entries`, y `after update of opening_balance` en `debts`): el saldo debe quedar ≥ 0. Si no, lanza un error.
  - `sync_debt_entry_transaction` (`after update or delete` en `debt_entries`, con `transaction_id`):
    - en `update`, copia `amount` y `occurred_on` al movimiento enlazado;
    - en `delete`, borra el movimiento enlazado.
- **RLS** activo en las dos tablas: `select`, `insert`, `update` y `delete` con `is_workspace_owner(workspace_id)` (`using` y `with check`). No hay política de `delete` en `debts`: las deudas solo se archivan.
- **RPC** (`security invoker`, `search_path = ''`, `grant execute` solo a `authenticated`):
  - `debt_overview(p_workspace_id uuid)` (`stable`) devuelve todas las columnas de `debts` más `balance numeric, paid_total numeric, entries_count bigint, last_payment_on date, next_due_on date, prev_due_on date, paid_current_cycle numeric, paid_previous_cycle numeric`:
    - una fila por deuda del espacio, en cualquier estado;
    - `balance` según la fórmula de arriba; `paid_total` es Σ de pagos;
    - las fechas de ciclo solo en tarjetas y préstamos (`null` en cuentas por cobrar), calculadas con hoy en `America/Bogota` según la tabla de ciclo.
  - `record_debt_payment(p_debt_id uuid, p_amount numeric, p_occurred_on date, p_note text, p_create_transaction boolean)` (`volatile`) devuelve el `id` de la entrada:
    - en una transacción, crea el movimiento (si `p_create_transaction` y la deuda es `loan` o `receivable`) y la entrada `payment` enlazada;
    - movimiento: tipo `expense` en "Deudas" con descripción "Pago <nombre>" (préstamo), o tipo `income` en "Cobros" con descripción "Abono <nombre>" (cuenta por cobrar);
    - con `p_create_transaction` en una tarjeta, lanza un error.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Ciclo de pago (tarjetas y préstamos, fechas en `America/Bogota`):

| Fecha    | Cálculo                                                   |
| -------- | --------------------------------------------------------- |
| `D_n`    | Primer vencimiento ≥ hoy (`next_due_on`)                  |
| `D_b`    | Vencimiento anterior a `D_n` (`prev_due_on`)              |
| `D_bb`   | Vencimiento anterior a `D_b`                              |
| Ciclo    | `paid_current_cycle`: Σ pagos con fecha en `(D_b, hoy]`   |
| Anterior | `paid_previous_cycle`: Σ pagos con fecha en `(D_bb, D_b]` |

- El vencimiento de cada mes es `due_day`. Si el día no existe en el mes, cae en el último día del mes (igual que el SPEC 04).
- Ejemplo: hoy 30 de octubre y `due_day` 5 → `D_n` 5 de noviembre, `D_b` 5 de octubre, `D_bb` 5 de septiembre.

Cálculos (en `src/features/debts/calculations.ts`):

| Valor              | Cálculo                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Tasa mensual `r`   | E.A.: `(1 + i/100)^(1/12) − 1`. M.V.: `i/100`. Sin tasa: 0                                   |
| Pago requerido     | `min(cuota o pago mínimo, saldo)`. Sin pago mínimo en una tarjeta: no hay                    |
| Utilización        | `saldo / credit_limit`, en porcentaje truncado. Puede pasar de 100 %                         |
| Utilización global | `Σ saldos / Σ cupos` de las tarjetas activas                                                 |
| Deuda total        | `Σ saldo` de tarjetas y préstamos activos                                                    |
| Te deben           | `Σ saldo` de cuentas por cobrar activas                                                      |
| Interés del mes    | `saldo × r` por deuda; la tarjeta del encabezado suma las activas                            |
| % pagado           | `(original_amount − saldo) / original_amount`, solo préstamos con monto original; mínimo 0 % |
| % cobrado          | `(opening_balance − saldo) / opening_balance`, mínimo 0 %                                    |

- Ejemplo: 26,82 % E.A. ≈ 2 % mensual.

Proyección (tarjetas y préstamos activos con saldo > 0):

- Pago `P`: la cuota del préstamo o el pago mínimo de la tarjeta. En el simulador, el valor que escribe el usuario.
- Simulación mes a mes desde `D_n`: `interés = saldo × r` (redondeado a centavos), `saldo = saldo + interés − P`, hasta que el saldo llegue a 0. Tope de 600 meses.
- Resultado: meses `n`, mes de pago total = mes de `D_n` + `n − 1` meses, e intereses totales = Σ intereses.
- Si `P ≤ saldo × r`: "Con este pago la deuda no baja". Si llega al tope: "Más de 50 años".
- Tarjeta sin tasa: proyección sin intereses y el aviso "Sin tasa, la proyección no incluye intereses".
- Tarjeta sin pago mínimo: "Agrega el pago mínimo para ver la proyección". El simulador sí funciona.
- Ejemplo: saldo 1.000.000, 2 % M.V., cuota 100.000, `D_n` 15 de noviembre de 2026 → 12 meses, termina en octubre de 2027, intereses `$ 127.033`.

Estado del próximo pago (tarjetas y préstamos activos con saldo > 0 y pago requerido):

| Estado    | Condición                                                                                       | Fecha | Color  |
| --------- | ----------------------------------------------------------------------------------------------- | ----- | ------ |
| Vencido   | `paid_previous_cycle` < requerido, `paid_current_cycle` < requerido y la deuda existía en `D_b` | `D_b` | rojo   |
| Pagado    | `paid_current_cycle` ≥ requerido                                                                | `D_n` | verde  |
| Hoy       | `D_n = hoy`                                                                                     | `D_n` | ámbar  |
| Pendiente | el resto                                                                                        | `D_n` | neutro |

- Se evalúan en ese orden. "La deuda existía en `D_b`" es: fecha de `created_at` en `America/Bogota` ≤ `D_b`.
- Un pago tardío (después de `D_b`) quita el "Vencido" y cuenta para el ciclo actual. La app no reparte pagos entre ciclos.
- Una tarjeta sin pago mínimo muestra solo la fecha `D_n`, sin estado.

Estado de utilización de una tarjeta:

| Rango       | Etiqueta  | Color |
| ----------- | --------- | ----- |
| < 30 %      | Saludable | verde |
| 30 % – 69 % | Moderada  | ámbar |
| ≥ 70 %      | Alta      | rojo  |

Etiquetas de estado de una deuda:

| `status`   | Tarjeta o préstamo | Cuenta por cobrar | Color  |
| ---------- | ------------------ | ----------------- | ------ |
| `paid`     | Pagada             | Cobrada           | verde  |
| `archived` | Archivada          | Archivada         | neutro |

- Una cuenta por cobrar activa con `expected_on < hoy` y saldo > 0 muestra "Vencida" en ámbar.
- Una deuda activa con saldo 0 muestra "Saldo en cero" con el botón "Marcar como pagada" (o "Marcar como cobrada").

Transiciones de estado:

| Acción             | Desde              | Hacia      | Condición | Efecto              |
| ------------------ | ------------------ | ---------- | --------- | ------------------- |
| Marcar como pagada | `active`           | `paid`     | saldo 0   | `closed_at = now()` |
| Archivar           | `active`, `paid`   | `archived` | —         | `closed_at = null`  |
| Reactivar          | `paid`, `archived` | `active`   | —         | `closed_at = null`  |

- Archivar con saldo > 0 pide confirmación: "Esta deuda tiene saldo. Al archivarla sale de los totales y de los próximos pagos."
- Pagadas y archivadas no cuentan en totales, utilización, interés del mes, próximos pagos ni Resumen.

"Actualizar saldo":

- El usuario escribe el saldo real (por ejemplo, el del extracto), la fecha y una nota opcional.
- Se crea una entrada `adjustment` con `amount = saldo nuevo − saldo actual`. Si la diferencia es 0, no se crea nada y se muestra "El saldo ya es ese".
- En el historial, un ajuste se muestra como "Ajuste" con el signo (+ sube el saldo, − lo baja).

Parámetros de URL de `/dashboard/personal/debts`:

| Parámetro | Valores                | Por defecto |
| --------- | ---------------------- | ----------- |
| `tab`     | `debts`, `receivables` | `debts`     |

- Un valor inválido cae a su valor por defecto.

## Plan de implementación

1. **Migración.**
   - Crear la migración del modelo de datos con tipos, tablas, índices, categorías, triggers, RLS y RPC.
   - Aplicarla con `supabase db push` y regenerar `src/types/database.ts`.
   - Verificar en la BD: un pago mayor que el saldo falla; un pago con `transaction_id` en una tarjeta falla; `debt_overview` de una deuda con `due_day` 31 devuelve el 31 de octubre como `next_due_on` el 30 de octubre, y sus vencimientos de noviembre de 2026 y febrero de 2027 caen el 30 de noviembre y el 28 de febrero.
2. **Esquemas y cálculos.**
   - `src/features/debts/schemas.ts` (Zod):
     - tarjeta: `name` 1 a 60, `counterparty` hasta 60, `opening_balance` ≥ 0, `credit_limit`, `due_day` 1–31, y opcionales `interest_rate` con `rate_type`, `min_payment` y `closing_day`;
     - préstamo: lo común más `opening_balance` > 0, `installment`, `interest_rate` (0 permitido) con `rate_type`, `due_day`, y opcionales `original_amount` y `term_months`;
     - cuenta por cobrar: `name`, `counterparty`, `opening_balance` > 0 y `expected_on` opcional;
     - pago: `amount` igual que movimientos, `occurred_on` ≤ hoy, `note` hasta 120 y `create_transaction`;
     - actualizar saldo: `balance` ≥ 0, `occurred_on` ≤ hoy y `note`.
     - Montos con las mismas reglas de formato que movimientos. Tasa con coma decimal (`28,5`).
   - `src/features/debts/calculations.ts`: tasa mensual, pago requerido, utilización, totales, interés del mes, % pagado, % cobrado, proyección y estados.
3. **Consultas y acciones.**
   - `src/features/debts/queries.ts`: `getDebts(workspaceId)` (RPC `debt_overview`, convierte `numeric` con `Number()`) y `getDebtEntries(debtId)`.
   - `src/features/debts/actions.ts` (`"use server"`):
     - `createDebt`, `updateDebt`, `markDebtPaid`, `archiveDebt`, `reactivateDebt`;
     - `recordPayment` (RPC `record_debt_payment`), `updateEntry`, `deleteEntry`, `adjustBalance`;
     - un pago mayor que el saldo devuelve "El pago supera el saldo"; una deuda no activa devuelve "Reactiva la deuda para registrar pagos"; "Marcar como pagada" con saldo > 0 devuelve "La deuda aún tiene saldo";
     - todas validan contra el workspace Personal del usuario y llaman a `revalidatePersonalPages()`, que también revalida `/dashboard/personal/debts`.
   - Las acciones de movimientos también revalidan `/dashboard/personal/debts`.
4. **Tab Debo.**
   - `app/dashboard/personal/debts/page.tsx` reemplaza el placeholder, con `buildMetadata` `noindex`, `Suspense` y tabs que escriben `?tab`.
   - `src/features/debts/components/`:
     - `debt-totals.tsx`: deuda total, utilización global con su etiqueta e interés estimado del mes;
     - `upcoming-debt-payments.tsx`: fecha, nombre, monto requerido y estado;
     - `debt-dialog.tsx` (client, `useActionState`): crear y editar; el tipo se elige solo al crear y muestra los campos de ese tipo;
     - `debt-card.tsx`: nombre, entidad, saldo, tasa ("28,5 % E.A."), barra de utilización o % pagado, próximo vencimiento con estado, proyección corta ("Terminas en octubre de 2027") y menú de acciones;
     - `inactive-debts.tsx`: sección plegable "Pagadas y archivadas" con "Reactivar".
5. **Sheet, pagos y ajustes.**
   - `src/features/debts/components/debt-sheet.tsx`: resumen, proyección completa (meses, fecha, intereses totales), simulador "Si pagaras X al mes", botones e historial. En inactivas, solo lectura con "Reactivar".
   - `payment-dialog.tsx` (client): monto, fecha con calendario, nota y la casilla "Registrar como gasto" en préstamos. En tarjetas, sin casilla y con el texto "Las compras con tarjeta se registran como gasto al comprar. Este pago no crea un movimiento".
   - `adjust-balance-dialog.tsx` (client): saldo nuevo, fecha y nota.
   - `debt-entries-list.tsx`: fecha, "Pago" o "Ajuste", monto con signo, nota, icono si tiene movimiento enlazado, editar y eliminar con `alert-dialog` (avisa si también borra el movimiento).
6. **Tab Me deben.**
   - `receivable-dialog.tsx`, `receivable-card.tsx` (deudor, saldo, % cobrado, fecha esperada, "Vencida") e `inactive-receivables.tsx` ("Cobradas y archivadas").
   - El Sheet y los diálogos de pago y ajuste se reutilizan con textos de abono y la casilla "Registrar como ingreso".
7. **Tarjeta del Resumen.**
   - `src/features/debts/components/debts-card.tsx`: deuda total, utilización global (si hay tarjetas activas) y hasta 3 próximos pagos, vencidos primero y luego por fecha, con "Ver todas".
   - Se monta en `app/dashboard/personal/page.tsx` dentro de `Suspense`, después de la tarjeta del SPEC 05.
8. **Estados vacíos.**
   - Tab Debo sin deudas: "Registra tus tarjetas y préstamos" con "Nueva deuda".
   - Tab Debo sin activas pero con inactivas: "No tienes deudas activas" con "Nueva deuda", y la sección de inactivas debajo.
   - Próximos pagos sin pendientes: "No tienes pagos de deudas pendientes".
   - Tab Me deben sin cuentas: "Nadie te debe dinero por ahora" con "Nueva cuenta por cobrar".
   - Historial sin entradas: "Aún no hay pagos registrados".
   - Tarjeta del Resumen: "No tienes deudas activas" con un enlace "Registrar deuda".
9. **Docs.**
   - `docs/producto.md`: sección "Tarjetas de crédito y deudas" con el modelo, el saldo, el ciclo de pago, la proyección, los estados y los umbrales.
   - `ROADMAP.md`: respuestas a las preguntas abiertas del SPEC 06.
   - `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona y las dependencias nuevas tienen versión exacta.
- [ ] La migración se aplica sin errores y `src/types/database.ts` incluye `debts`, `debt_entries`, los cuatro tipos nuevos, `debt_overview` y `record_debt_payment`.
- [ ] Las categorías de sistema "Deudas" (gasto) y "Cobros" (ingreso) aparecen en el selector de categorías de Movimientos.
- [ ] `/dashboard/personal/debts` sin parámetros abre la tab Debo. `?tab=receivables` abre Me deben. Recargar conserva la tab.
- [ ] Crear la tarjeta "Visa", cupo 5.000.000, saldo 1.500.000, 28,5 % E.A., día de pago 15, sin pago mínimo, la muestra con utilización 30 % "Moderada", tasa "28,5 % E.A.", próximo vencimiento 15 de noviembre sin estado y "Agrega el pago mínimo para ver la proyección".
- [ ] Crear una tarjeta sin cupo, un préstamo sin cuota o sin tasa, una tasa de 15 % M.V. o una cuenta por cobrar con monto 0 muestra un error de validación en español y no escribe en la BD.
- [ ] Un préstamo con saldo 1.000.000, 2 % M.V., cuota 100.000 y día de pago 15, el 30 de octubre de 2026, muestra 12 meses, "Terminas en octubre de 2027" e intereses `$ 127.033`.
- [ ] Un préstamo con tasa 26,82 % E.A. y los mismos datos da la misma proyección que con 2 % M.V. (± 1 mes, ± `$ 100` de intereses).
- [ ] Un préstamo con saldo 1.200.000, tasa 0 y cuota 100.000 muestra 12 meses e intereses `$ 0`.
- [ ] Con cuota 10.000 sobre un saldo de 1.000.000 al 2 % M.V., la tarjeta muestra "Con este pago la deuda no baja".
- [ ] En el simulador del Sheet, escribir 200.000 en el préstamo de 1.000.000 al 2 % M.V. recalcula los meses y los intereses sin guardar nada.
- [ ] El 30 de octubre, un préstamo creado en septiembre con día de pago 5, cuota 100.000 y sin pagos desde el 5 de septiembre muestra "Vencido" con fecha 5 de octubre.
- [ ] Registrar un pago de 100.000 el 30 de octubre en ese préstamo quita el "Vencido" y muestra "Pagado" con fecha 5 de noviembre.
- [ ] Un préstamo creado el 20 de octubre con día de pago 5 y sin pagos muestra "Pendiente" con fecha 5 de noviembre, no "Vencido".
- [ ] Un préstamo creado el 20 de octubre con día de pago 30 y sin pagos, consultado el 30 de octubre, muestra "Hoy".
- [ ] Un préstamo con día de pago 31 vence el 30 de noviembre de 2026 y el 28 de febrero de 2027.
- [ ] Pagar 100.000 en un préstamo con "Registrar como gasto" marcado baja el saldo en 100.000 y crea en Movimientos un gasto "Pago <nombre>" en "Deudas" con la misma fecha.
- [ ] Pagar con la casilla desmarcada baja el saldo y no crea movimiento.
- [ ] Editar el monto o la fecha de un pago enlazado cambia también su movimiento. Eliminar el pago elimina su movimiento.
- [ ] Eliminar en Movimientos el gasto de un pago deja el pago en el historial sin enlace y el saldo igual.
- [ ] Pagar una tarjeta baja su saldo y no crea movimiento. Un pago con movimiento en una tarjeta falla en la BD aunque se salte la validación del cliente.
- [ ] Un pago mayor que el saldo muestra "El pago supera el saldo" y falla también en la BD.
- [ ] "Actualizar saldo" a 1.800.000 en la tarjeta de 1.500.000 crea un ajuste "+ $ 300.000", sube la utilización a 36 % y no crea movimiento.
- [ ] Editar el saldo inicial de modo que el saldo quede negativo falla en la BD.
- [ ] Un pago o ajuste con fecha futura falla en el formulario y en la BD.
- [ ] Con saldo 0, la tarjeta muestra "Saldo en cero" y "Marcar como pagada". Marcarla la mueve a "Pagadas y archivadas" como "Pagada".
- [ ] "Marcar como pagada" con saldo > 0 falla con "La deuda aún tiene saldo".
- [ ] Archivar una deuda con saldo pide confirmación, la saca de la deuda total, de los próximos pagos y del Resumen, y la muestra como "Archivada".
- [ ] Una deuda pagada o archivada no acepta pagos ni ajustes, ni desde la UI ni saltando la validación del cliente, y su Sheet es de solo lectura.
- [ ] "Reactivar" una deuda pagada o archivada la devuelve a las activas con su historial intacto.
- [ ] El encabezado de Debo muestra deuda total = Σ saldos de tarjetas y préstamos activos, la utilización global de tarjetas y el interés estimado del mes.
- [ ] Crear la cuenta por cobrar "Préstamo a Juan", 500.000, fecha esperada 15 de octubre de 2026, la muestra en Me deben con "Vencida" el 30 de octubre.
- [ ] Registrar un abono de 200.000 con "Registrar como ingreso" baja su saldo a 300.000, muestra 40 % cobrado y crea un ingreso "Abono <nombre>" en "Cobros".
- [ ] Las cuentas por cobrar no aparecen en la deuda total, en los próximos pagos ni en la tarjeta del Resumen.
- [ ] Resumen muestra "Deudas" con deuda total, utilización global y hasta 3 próximos pagos, vencidos primero, y "Ver todas" abre `/dashboard/personal/debts`.
- [ ] Los estados vacíos de las dos tabs, del historial y de la tarjeta del Resumen muestran los textos definidos.
- [ ] Un usuario A, con su sesión y la clave publicable, no puede leer, crear, editar ni archivar deudas o entradas del workspace de B, y `debt_overview` con el workspace de B devuelve vacío.
- [ ] Una entrada con `workspace_id` distinto al de su deuda falla en la BD. Enlazar una entrada a un movimiento de otro workspace falla en la BD.
- [ ] Un cliente `anon` no puede ejecutar `debt_overview` ni `record_debt_payment`.
- [ ] No existe forma de eliminar una deuda desde el cliente (sin política `delete`).

## Decisiones

- **Sí:** tasa E.A. o M.V. a elección (`rate_type`). Los bancos colombianos publican E.A., pero muchos extractos de tarjeta muestran M.V.
- **No:** solo E.A. Obligaría al usuario a convertir la tasa del extracto.
- **Sí:** tasa obligatoria en préstamos (0 permitido) y opcional en tarjetas. Un préstamo de un familiar sin interés usa 0; una tarjeta se puede registrar sin saber su tasa.
- **Sí:** las compras con tarjeta son gastos al comprar y el pago de la tarjeta no crea movimiento. Conserva las categorías reales del consumo y no cuenta dos veces.
- **No:** gasto al pagar la tarjeta. Pierde en qué se gastó.
- **No:** marcar un gasto como "pagado con tarjeta X". Toca el modelo y el formulario del SPEC 02; puede llegar en otro spec.
- **Sí:** saldo = saldo inicial − pagos + ajustes, con los ajustes como filas del historial. Nada se pisa y editar un pago viejo no descuadra.
- **No:** saldo guardado y sobrescrito. Pierde trazabilidad.
- **No:** separar interés y capital en cada pago. Más exacto en préstamos, confuso en tarjetas; el saldo real se corrige con "Actualizar saldo".
- **Sí:** "Actualizar saldo" pide el saldo real y calcula el ajuste. El usuario copia el número del extracto, no una diferencia.
- **Sí:** cuentas por cobrar como tercer tipo en la misma tabla, en su propia tab. Comparten pagos, ajustes, Sheet y estados; no cuentan como deuda.
- **No:** intereses o proyección en cuentas por cobrar. Casi siempre son préstamos informales.
- **Sí:** pago de préstamo y abono con casilla de movimiento marcada por defecto. El pago normal es un gasto real; los pagos antiguos se cargan sin inflar los gastos.
- **Sí:** categorías de sistema "Deudas" y "Cobros". El movimiento siempre tiene categoría válida sin pedirla en el diálogo.
- **Sí:** el pago manda sobre su movimiento (trigger `sync_debt_entry_transaction`). Un solo lugar para corregir; borrar el movimiento en Movimientos solo quita el enlace.
- **Sí:** `record_debt_payment` crea pago y movimiento en una transacción. Sin movimientos huérfanos si falla la segunda escritura.
- **Sí:** un pago no puede superar el saldo, validado con trigger además de Zod. Igual que los retiros de metas.
- **No:** saldo a favor (saldo negativo). Complica utilización y proyección.
- **Sí:** proyección con la cuota o el pago mínimo, interés compuesto mensual, más un simulador. Responde "cuándo termino" y "qué pasa si pago más".
- **No:** proyección con el promedio de pagos reales. Sin historial no hay proyección.
- **Sí:** tarjeta sin pago mínimo: sin proyección ni estado de ciclo, solo fecha. El mínimo cambia cada mes y es opcional.
- **Sí:** estado del próximo pago por ciclo (`(D_b, hoy]`), con "Vencido" si el ciclo anterior quedó corto y no hubo pago después. Simple de explicar.
- **No:** repartir pagos entre ciclos. Un pago tardío cubre el ciclo actual; la precisión extra no compensa la complejidad.
- **No:** unir las deudas a "Próximos pagos" del SPEC 04. Tocaría `recurring_occurrences`; la tarjeta "Deudas" del Resumen es aparte.
- **Sí:** umbrales de utilización 30 % y 70 %. El 30 % es la referencia usual de las centrales de riesgo.
- **Sí:** monto original y plazo opcionales e informativos en préstamos. El % pagado usa el monto original; la proyección no usa el plazo.
- **Sí:** cierre manual con saldo 0 ("Marcar como pagada"), archivar con saldo y "Reactivar". Una tarjeta en 0 se puede seguir usando.
- **No:** cierre automático al llegar a 0. Una tarjeta en 0 que se sigue usando se reabriría sola.
- **No:** eliminar deudas. La historia de pagos no se pierde.
- **Sí:** el tipo de una deuda no cambia tras crearla. Cada tipo tiene campos distintos.
- **Sí:** `workspace_id` en `debt_entries` con FK compuesta a la deuda, como en `goal_contributions`.
- **Sí:** Sheet por deuda para el historial y el simulador. Sin rutas dinámicas, como en metas.
- **Sí:** top 3 de próximos pagos en el Resumen, vencidos primero.

## Riesgos

| Riesgo                                                                               | Mitigación                                                                                                                          |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Editar o borrar una entrada, o el saldo inicial, deja el saldo negativo              | Trigger `check_debt_balance` (`after`) en `debt_entries` y en `debts.opening_balance`                                               |
| El pago y su movimiento se desincronizan                                             | `record_debt_payment` crea ambos en una transacción; `sync_debt_entry_transaction` propaga ediciones y borrados                     |
| Borrar el movimiento de un pago desde Movimientos                                    | `on delete set null`: el pago queda sin enlace y el saldo no cambia                                                                 |
| El usuario espera que pagar la tarjeta cree un gasto                                 | El diálogo de pago de tarjeta dice "Las compras con tarjeta se registran como gasto al comprar. Este pago no crea un movimiento"    |
| El saldo de la tarjeta no sube solo con las compras ni con los intereses             | "Actualizar saldo" visible en la tarjeta y en el Sheet                                                                              |
| Un pago tardío cuenta para el ciclo actual y puede marcarlo "Pagado"                 | Regla documentada en `docs/producto.md`; la precisión por ciclo queda fuera de alcance                                              |
| Diferencias de redondeo entre E.A. y M.V.                                            | Interés redondeado a centavos por mes y criterio de aceptación con tolerancia                                                       |
| "Hoy" y los vencimientos cambian según la zona horaria del servidor                  | Se calculan siempre en `America/Bogota`, igual que en SPEC 02 a 05                                                                  |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas                   | Página y tarjeta leen sesión y `searchParams` dentro de `Suspense`. Antes de implementar se consulta `node_modules/next/dist/docs/` |
| El Resumen sin movimientos muestra el estado vacío del SPEC 03 y oculta las tarjetas | Igual que las tarjetas del SPEC 04 y 05: la tarjeta de deudas solo aparece cuando hay movimientos                                   |
| `numeric` llega como `number` o `string`                                             | Las consultas convierten con `Number()`                                                                                             |
| El alcance creció con las cuentas por cobrar                                         | Reutilizan tabla, Sheet y diálogos; sin intereses ni proyección                                                                     |

## Lo que **no** entra en este spec

- Compras en cuotas por tarjeta.
- Extractos bancarios e importación.
- Gastos marcados como "pagado con tarjeta X".
- Separar interés y capital por pago.
- Estrategias de pago avanzadas (SPEC 07).
- Proyección con el promedio de pagos.
- Intereses en cuentas por cobrar.
- Eliminar deudas.
- Otras monedas.
- Notificaciones.
- Deudas en Empresa.
- Deudas en "Próximos pagos" del SPEC 04 y en las tarjetas y gráficas del SPEC 03.

Cada uno de esos puntos, si llega, va en su propio spec.
