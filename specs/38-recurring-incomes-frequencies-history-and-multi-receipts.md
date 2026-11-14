# SPEC 38 — Ingresos fijos: semanal, diario, cada N días, historial y cobros de varias ocurrencias

> **Estado:** Implementado
> **Depende de:** SPEC 30, SPEC 37
> **Fecha:** 2026-11-13
> **Objetivo:** Que un ingreso fijo pueda ser semanal, diario o cada N días, que se vean todas sus ocurrencias pasadas con su estado (como **Gastos fijos**), y que un solo movimiento pueda cubrir varias ocurrencias o abonar una parte.

## Por qué existe este spec

El usuario recibe 50.000 COP cada sábado de una inversión. SPEC 30 solo ofrece mensual, quincenal, anual y **Sin fecha fija**, y **Próximos ingresos** solo mira 2 meses atrás. No hay forma de saber cuántos sábados le deben.

Además, quien paga suele juntar varias semanas: transfiere 150.000 por tres sábados, o 30.000 de 50.000. SPEC 30 permite un movimiento por ocurrencia y sin abonos.

La página debe verse y comportarse como **Gastos fijos** tras SPEC 37: navegador de mes, estados y Sheet por fuente.

Es el tercero de cinco specs del mismo pedido (SPEC 36 a 40).

## Alcance

**Entra:**

- **Frecuencias nuevas** en `recurring_incomes`:
  - **Semanal:** día de la semana (lunes a domingo). Ej.: cada sábado.
  - **Diaria:** todos los días desde `starts_on`.
  - **Cada N días:** intervalo de 2 a 90 días contado desde `starts_on`.
  - Se suman a mensual, quincenal, anual y **Sin fecha fija** (SPEC 30), que no cambian.
  - El formulario (`recurring-income-dialog.tsx`) pide solo los campos de la frecuencia elegida y muestra un resumen en vivo ("Cada sábado · 50.000", "Cada 14 días desde el 3 nov").
- **Estados de una ocurrencia** (`occurrences.ts`):
  - **Recibido:** lo asignado suma el monto esperado o más.
  - **Abonado:** lo asignado es mayor que 0 y menor que el esperado. Muestra "Recibió X de Y · Falta Z".
  - **De hoy**, **Pendiente** (aún no llega) y **Atrasado** (pasó sin asignaciones), como SPEC 30.
- **Página `/dashboard/personal/recurring-income`** con la misma estructura que **Gastos fijos** tras SPEC 37:
  - navegador de mes (`?month=YYYY-MM`) con el mismo componente compartido de SPEC 37; sin meses futuros ni anteriores al `starts_on` más antiguo;
  - **mes actual:** ocurrencias del mes y todas las no recibidas o abonadas de meses anteriores, sin tope de 2 meses;
  - **mes anterior:** todas las ocurrencias de ese mes con su estado;
  - resumen "Recibido $ X de $ Y" del mes elegido;
  - indicador "N atrasados · $ Z" en la cabecera, que lleva al mes del atraso más antiguo;
  - fuentes **Diaria** y **Cada N días** con muchas ocurrencias en el mes: una fila resumen por fuente ("Diario · 18 de 30 días · Falta $ Z") que abre su Sheet, en vez de una fila por día;
  - fuentes **Semanal**: una fila por semana.
- **Sheet por ingreso fijo** (clic en la fila de la lista de fuentes):
  - datos de la fuente y acciones existentes (editar, pausar, eliminar);
  - ocurrencias desde `starts_on` hasta hoy más la próxima, más reciente primero; últimas 12 (o 31 para diaria) y **Ver más**;
  - cada fila: fecha, estado, lo recibido y los movimientos que la cubren;
  - totales: recibido en el año y por cobrar a la fecha.
- **Recibir** (reemplaza **Marcar recibido** y se muestra en toda ocurrencia no recibida o abonada):
  - abre `TransactionDialog` en el tab Ingreso con la fuente elegida, categoría y cuenta por defecto;
  - monto prellenado con lo que falta de **todas** las ocurrencias atrasadas, de hoy y abonadas hasta la de la fila;
  - el monto es editable y se **reparte automáticamente** desde la ocurrencia no recibida más antigua;
  - **vista previa** bajo el monto: "Cubre sáb 1 nov, sáb 8 nov · Abona 20.000 a sáb 15 nov";
  - si sobra después de cubrir lo vencido, cubre ocurrencias futuras, hasta 12 por delante; más allá, error en el campo "El monto cubre más de 12 ocurrencias futuras";
  - con `ends_on`, no se puede asignar más allá de la última ocurrencia; el sobrante da error en el campo;
  - crea **un solo** ingreso en la cuenta.
- **Select "Ingreso fijo"** del tab Ingreso (SPEC 30) usa el mismo reparto y la misma vista previa en lugar de enlazar a una sola ocurrencia.
- **Editar o eliminar** un ingreso con asignaciones (desde Movimientos o el Sheet):
  - cambiar el monto reparte de nuevo desde la ocurrencia no recibida más antigua, sin contar las asignaciones propias;
  - cambiar a **Otro ingreso** borra las asignaciones;
  - eliminar el movimiento borra las asignaciones y las ocurrencias vuelven a su estado calculado.
- **Fuentes Sin fecha fija:** siguen como SPEC 30 (sin ocurrencias ni reparto).
- **Cargador de acciones rápidas** (`quick-actions.tsx`): `IncomeSourceOption` lleva las ocurrencias pendientes necesarias para la vista previa.
- **MCP y exportes:** las tools de lectura y `exports/queries.ts` que lean `recurring_income_due_on` pasan a leer las asignaciones.
- Ocultar cifras (SPEC 22), móvil a 390 px y AA en claro y oscuro.
- **Documentación:** `docs/producto.md`, `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Frecuencias nuevas en **Gastos fijos**.
- Elegir a mano qué ocurrencias cubre un pago (casillas).
- Ingresos fijos en Empresa.
- Tarjeta **Próximos ingresos** en el Resumen.
- Recordatorios, intereses o mora.
- Proyectos con monto total o % recibido.

## Modelo de datos

Dos migraciones, porque un valor nuevo de `enum` no se usa en la misma transacción que lo crea.

`supabase/migrations/<timestamp>_add_income_frequencies.sql`:

```sql
alter type public.income_frequency add value 'weekly';
alter type public.income_frequency add value 'daily';
alter type public.income_frequency add value 'every_n_days';
```

`supabase/migrations/<timestamp>_recurring_income_allocations.sql`:

```sql
alter table public.recurring_incomes
  add column day_of_week smallint check (day_of_week between 1 and 7), -- ISO: 1 lunes … 7 domingo
  add column interval_days smallint check (interval_days between 2 and 90);

-- Los check por frecuencia de SPEC 30 se reemplazan:
--   weekly       → day_of_week obligatorio; sin day_of_month, interval_days
--   daily        → sin días
--   every_n_days → interval_days obligatorio; sin días
--   monthly / biweekly / yearly / none → como SPEC 30, sin day_of_week ni interval_days

create table public.recurring_income_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  recurring_income_id uuid not null references public.recurring_incomes (id) on delete cascade,
  due_on date not null,
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (transaction_id, due_on)
);

create index recurring_income_allocations_occurrence
  on public.recurring_income_allocations (recurring_income_id, due_on);
```

- **Migración de datos:** cada movimiento con `recurring_income_due_on` crea una asignación por su monto completo. Luego se borran `transactions.recurring_income_due_on` y el índice único `transactions_recurring_income_occurrence`. `transactions.recurring_income_id` se queda: enlaza el movimiento con su fuente (y las **Sin fecha fija**).
- **Triggers:**
  - `check_recurring_income_allocation` (`before insert or update`): el movimiento es `income`, del mismo espacio y con el mismo `recurring_income_id`; `due_on` es una fecha real de la fuente; la fuente no es `none`.
  - La suma de asignaciones de un movimiento es igual a su monto. Se valida al final de la RPC, no por trigger fila a fila.
- **RLS** en `recurring_income_allocations`: `select` con `is_workspace_owner`; escritura con `is_workspace_writable`.
- **RPC** (todas `security invoker`, `search_path = ''`, solo `authenticated`):
  - `recurring_income_occurrences` se reemplaza: soporta las frecuencias nuevas y devuelve `received_amount` = Σ asignaciones por ocurrencia (en vez de `transaction_id`).
  - `allocate_income_receipt(p_transaction_id uuid)`: borra las asignaciones del movimiento y reparte su monto desde la ocurrencia no recibida más antigua de su fuente, con el tope de 12 futuras y `ends_on`. Lanza error si sobra. La llaman `createTransaction` y `updateTransaction` en la misma transacción que guarda el movimiento (vía `record_transaction` o una RPC equivalente).
- Tras las migraciones se regenera `src/types/database.ts` y se le pasa Prettier.

Reparto puro, compartido con SPEC 39:

```ts
// src/libs/allocate.ts
export interface Period {
  key: string // due_on o period_on
  due: number // lo que falta en ese periodo
}

export interface Allocation {
  key: string
  amount: number
}

/** Reparte `amount` desde el primer periodo; `leftover` > 0 si sobra */
export function allocateOldestFirst(
  periods: Period[],
  amount: number
): { allocations: Allocation[]; leftover: number }
```

La vista previa del cliente usa `allocateOldestFirst`; el servidor hace el mismo cálculo en la RPC y es el que manda.

```ts
// src/features/recurring-incomes/schemas.ts
export const INCOME_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
  "daily",
  "every_n_days",
  "none"
] as const

// src/features/recurring-incomes/occurrences.ts
type IncomeOccurrenceStatus =
  "received" | "partial" | "today" | "pending" | "overdue"
```

## Plan de implementación

1. **Reparto puro.** `src/libs/allocate.ts` con `allocateOldestFirst` y sus casos (exacto, sobrante, abono, monto cero).
2. **Migración de frecuencias y asignaciones.** Enum, columnas, checks, tabla, RLS, migración de datos, RPC de ocurrencias y `allocate_income_receipt`. Probar con `supabase db reset` y con ingresos de SPEC 30 sembrados. Regenerar tipos.
3. **Ocurrencias en TS.** `occurrences.ts` genera semanal, diaria y cada N días, y calcula **Abonado**.
4. **Formulario de la fuente.** Campos por frecuencia y resumen en vivo.
5. **Movimientos.** `transactions/service.ts` guarda el movimiento y llama al reparto; editar y eliminar reparten de nuevo o borran.
6. **Select y vista previa.** El tab Ingreso muestra el reparto bajo el monto; **Recibir** prellena lo que falta hasta su fila.
7. **Página.** Navegador de mes (componente de SPEC 37), lista por mes, filas resumen para diaria y cada N días, indicador de atrasados.
8. **Sheet por fuente** con ocurrencias, movimientos que las cubren y **Ver más**.
9. **MCP y exportes.** Cambiar las lecturas de `recurring_income_due_on` por asignaciones.
10. **Docs y CHANGELOG.**
11. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [x] Se crea un ingreso fijo **Semanal** de 50.000 cada sábado; el formulario solo pide el día de la semana.
- [x] Se crea uno **Diario** y uno **Cada 14 días**; el formulario pide solo lo que aplica.
- [x] Un semanal que empezó hace 4 sábados sin cobros muestra 4 ocurrencias **Atrasado** (o 3 y **De hoy** si hoy es sábado).
- [x] **Recibir** en la cuarta prellena 200.000; guardar crea un solo ingreso de 200.000 y las 4 pasan a **Recibido**.
- [x] Un ingreso de 120.000 con 4 sábados pendientes deja 2 **Recibido** y la tercera **Abonado** con "Falta 30.000"; la cuarta sigue **Atrasado**.
- [x] La vista previa bajo el monto describe el mismo reparto que se guarda.
- [x] Un monto que cubre más de 12 ocurrencias futuras es rechazado con error en el campo.
- [x] Editar el monto del ingreso de 120.000 a 200.000 deja las 4 ocurrencias **Recibido**.
- [x] Eliminar ese ingreso devuelve las 4 a **Atrasado** o **De hoy**.
- [x] Los ingresos registrados con SPEC 30 conservan su ocurrencia **Recibido** tras la migración.
- [x] El navegador de mes muestra un mes pasado con sus ocurrencias recibidas y atrasadas.
- [x] Una fuente **Diaria** aparece como una sola fila resumen por mes y abre su Sheet.
- [x] El Sheet de una fuente lista sus ocurrencias con estado y **Ver más**.
- [x] Las fuentes **Sin fecha fija** se comportan igual que en SPEC 30.
- [x] Un usuario no puede leer ni escribir asignaciones de otro (RLS).
- [x] Con cifras ocultas, montos nuevos muestran `***`; a 390 px no hay desplazamiento horizontal.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

## Decisiones

- **Sí:** semanal, diaria y cada N días (decisión del usuario).
- **Sí:** misma interfaz que **Gastos fijos** con navegador de mes y estados (decisión del usuario). Depende de SPEC 37 para el componente compartido.
- **Sí:** abonos parciales con estado **Abonado** (decisión del usuario), igual que SPEC 29.
- **Sí:** reparto automático desde la más antigua, con vista previa (decisión del usuario).
- **Sí:** un solo movimiento por pago (decisión del usuario). Calza con el extracto del banco.
- **Sí:** tabla de asignaciones en vez de `recurring_income_due_on`. Motivo: un movimiento cubre varias ocurrencias y una ocurrencia recibe varios movimientos.
- **No:** un movimiento por ocurrencia. Descartado por el usuario.
- **No:** casillas para elegir ocurrencias. Más pasos en el teléfono.
- **Sí:** se mantienen las etiquetas actuales (**Atrasado**, **Pendiente**, **De hoy**) en vez de "Vencido" / "Próximo". Motivo: mismo lenguaje que Gastos fijos y Me deben.
- **Sí:** filas resumen para diaria y cada N días. Motivo: 30 filas por mes ahogan la lista.
- **Sí:** tope de 12 ocurrencias futuras. Motivo: evita asignar por error a un año entero de días.
- **Sí:** el servidor reparte; el cliente solo previsualiza. Evita asignaciones manipuladas o desfasadas.
- **Sí:** ISO 1–7 para el día de la semana. Motivo: coincide con `isodow` de Postgres.

## Riesgos

| Riesgo                                                        | Mitigación                                                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Migrar `recurring_income_due_on` pierde enlaces               | Crear asignaciones antes de borrar la columna; criterio de ingresos de SPEC 30.                          |
| Vista previa y servidor reparten distinto                     | Misma regla documentada en `allocate.ts` y en la RPC; el servidor manda y el toast describe lo guardado. |
| Diaria con años de historial hace lenta la RPC                | Rango acotado por mes y por **Ver más**; índice por `(recurring_income_id, due_on)`.                     |
| Cambiar frecuencia o días de una fuente con asignaciones      | Asignaciones cuyo `due_on` ya no calce se muestran como **Recibido** en su fecha, como SPEC 30.          |
| Dos movimientos a la vez sobre las mismas ocurrencias         | `allocate_income_receipt` bloquea la fuente con `for update` antes de repartir.                          |
| MCP (SPEC 34) y exportes (SPEC 32/33) leen la columna borrada | Paso 9 del plan; `pnpm check` falla si queda una referencia tras regenerar tipos.                        |

## Qué **no** entra en este spec

- Frecuencias nuevas en Gastos fijos.
- Elegir ocurrencias a mano.
- Ingresos fijos en Empresa, Resumen, recordatorios y proyectos con total.
- Lo de SPEC 36, 37, 39 y 40.
