# SPEC 39 — Me deben en movimiento rápido: abono, pago completo y varios meses

> **Estado:** Aprobado
> **Depende de:** SPEC 28, SPEC 29, SPEC 30, SPEC 36, SPEC 38
> **Fecha:** 2026-11-13
> **Objetivo:** Que **Me deben** tenga su propio tab en el diálogo de movimiento rápido con abono o pago completo para cobros únicos, y una cuota o varios meses para cobros mensuales, repartiendo un solo pago entre varias cuotas.

## Por qué existe este spec

El usuario cobra 5.100 al mes a cada integrante de su plan familiar. Uno le transfirió 20.000 para cubrir varios meses. SPEC 29 dejó fuera "repartir un pago grande entre varias cuotas desde la UI": hoy cada abono va a una cuota, así que tendría que registrar cuatro cobros separados que no calzan con su extracto.

Además, cobrar algo de **Me deben** exige entrar a Deudas, abrir el Sheet y cobrar. En el diálogo de movimiento rápido las cuentas por cobrar se mezclan con las deudas en el tab **Deuda**.

Es el cuarto de cinco specs del mismo pedido (SPEC 36 a 40). Usa el reparto de SPEC 38 y el aviso "Quedará en" de SPEC 36.

## Alcance

**Entra:**

- **Tab "Me deben"** en `TransactionDialog` (solo Personal), entre **Deuda** y **Gasto fijo**. Orden: Gasto, Ingreso, Traspaso, Deuda, Me deben, Gasto fijo, Meta.
  - El tab **Deuda** deja de listar cuentas por cobrar.
  - Sin cuentas por cobrar activas: `PanelEmpty` con enlace a Me deben.
  - Lo usan el botón **Registrar movimiento** del header y **Movimiento rápido** de la hoja del teléfono (mismo componente, SPEC 30).
- **Formulario de cobro** (`src/features/debts/components/receivable-collect-form.tsx`, nuevo), compartido por el tab y por el Sheet de la cuenta por cobrar (reemplaza el cobro de cuentas por cobrar en `PaymentDialog`):
  - `Select` de cuenta por cobrar activa, con saldo o "N cuotas por cobrar · $ Z";
  - fecha, cuenta destino (`PaymentAccountSection` con `direction="in"`, SPEC 36), nota y la casilla "Registrar como ingreso" de SPEC 06.
- **Cobro único** (`schedule = 'once'`), tabs **Abono | Pago completo**:
  - **Abono:** monto libre, mayor que 0 y menor o igual que el saldo pendiente.
  - **Pago completo:** monto = saldo pendiente, de solo lectura. Al guardar la cuenta por cobrar pasa a pagada (`status = 'paid'`).
- **Cobro mensual** (`schedule = 'monthly'`), tabs **Una cuota | Varios meses**:
  - **Una cuota:** `Select` de cuota no pagada (por defecto la más antigua), monto prellenado con lo que falta de esa cuota y editable. Menor que lo que falta deja la cuota **Abonada** (SPEC 29).
  - **Varios meses:** monto libre. Se **reparte automáticamente** desde la cuota no pagada más antigua con `allocateOldestFirst` (SPEC 38).
    - Vista previa bajo el monto: "Cubre sep, oct y nov · Abona 4.700 a dic (falta 400)".
    - Atajos opcionales "2 meses", "3 meses", "6 meses" que llenan el monto con lo que falta de esas cuotas.
    - Con número de cuotas, el monto no puede superar lo que falta en total; error en el campo.
    - Indefinida: el sobrante cubre meses futuros hasta 12 por delante; más allá, error en el campo.
  - Crea **un solo** ingreso en la cuenta (si se marcó "Registrar como ingreso") y **un solo** abono en `debt_entries`, con sus asignaciones por cuota.
- **Lista de cuotas** del Sheet (`receivable-installments.tsx`): cada cuota muestra los abonos que la cubren; un abono que cubre varias cuotas aparece en cada una con "parte de un pago de $ 20.000 del 12 nov".
- **Editar o eliminar** un abono con asignaciones (desde el Sheet o Movimientos, SPEC 26):
  - cambiar el monto reparte de nuevo desde la cuota no pagada más antigua, sin contar las asignaciones propias;
  - eliminar borra las asignaciones y las cuotas vuelven a su estado calculado.
- **Menú del header** (`quick-actions-menu.tsx`): si lista accesos por tipo, se agrega **Cobro de Me deben** que abre el diálogo en el tab **Me deben**.
- **MCP y exportes:** las lecturas de `debt_entries.period_on` pasan a las asignaciones (`list-receivables.ts`, `exports/queries.ts`).
- Ocultar cifras, móvil a 390 px y AA en claro y oscuro.
- **Documentación:** `docs/producto.md`, `docs/ui.md#móvil` (orden de tabs), `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Elegir a mano qué meses cubre un pago (casillas).
- Cambiar una cuenta por cobrar de **Una vez** a **Mes a mes** o al revés.
- Grupos de deudores (un cobro para todo el plan familiar a la vez).
- Recordatorios, intereses o mora.
- Me deben en Empresa.
- Pagos de varios meses en gastos fijos o deudas propias.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_debt_entry_allocations.sql`:

```sql
create table public.debt_entry_allocations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entry_id uuid not null references public.debt_entries (id) on delete cascade,
  period_on date not null,          -- primer día del mes de la cuota
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (entry_id, period_on)
);

create index debt_entry_allocations_period
  on public.debt_entry_allocations (period_on);
```

- **Migración de datos:** cada `debt_entries` con `period_on` crea una asignación por su monto completo. Luego se borra `debt_entries.period_on` y sus reglas en triggers.
- Un abono sigue enlazado a **un** movimiento (`debt_entries.transaction_id` único). `sync_debt_entry_transaction` no cambia: el abono tiene el monto total.
- **Triggers:**
  - `check_debt_entry_allocation` (`before insert or update`): el abono es `payment` de una cuenta por cobrar mensual del mismo espacio; `period_on` es día 1, no anterior al mes de `starts_on` y, con `term_months`, no posterior a la última cuota.
  - La suma de asignaciones de un abono es igual a su monto. Se valida al final de la RPC.
- **RLS** en `debt_entry_allocations`: `select` con `is_workspace_owner`; escritura con `is_workspace_writable`.
- **RPC** `record_receivable_collection(p_debt_id uuid, p_amount numeric, p_occurred_on date, p_note text, p_create_transaction boolean, p_account_id uuid default null, p_mode text default 'allocate', p_period_on date default null)` (`security invoker`, `search_path = ''`, solo `authenticated`):
  - crea el abono y, si `p_create_transaction`, el ingreso enlazado (categoría **Cobros**);
  - en mensuales: `p_mode = 'single'` asigna todo a `p_period_on`; `'allocate'` reparte desde la cuota no pagada más antigua (tope de 12 futuras en indefinidas, de `term_months` en las demás) y lanza error si sobra;
  - bloquea la cuenta por cobrar con `for update` antes de repartir;
  - con número de cuotas, pasa a `status = 'paid'` cuando se cubre todo, como hoy.
- Una RPC `reallocate_debt_entry(p_entry_id uuid)` reparte de nuevo al editar el monto.
- `receivable-schedule.ts` calcula lo recibido por cuota con Σ asignaciones en vez de `period_on`.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

```ts
// src/features/debts/schemas.ts
export const RECEIVABLE_COLLECT_MODES = [
  "partial", // Abono (una vez)
  "full", // Pago completo (una vez)
  "single", // Una cuota (mes a mes)
  "allocate" // Varios meses (mes a mes)
] as const

// src/features/transactions/components/transaction-dialog.tsx
type FormPanel = /* existentes */ "receivable"
```

## Plan de implementación

1. **Migración.** Tabla, RLS, migración de `period_on`, triggers y RPC. Probar con `supabase db reset` y con cuotas de SPEC 28/29 sembradas. Regenerar tipos.
2. **Cálculo de cuotas.** `receivable-schedule.ts` lee asignaciones; los estados de SPEC 28/29 no cambian para datos existentes.
3. **Servicio y actions.** `debts/entry-service.ts` usa `record_receivable_collection` y `reallocate_debt_entry`; schema Zod por modo.
4. **Formulario compartido.** `receivable-collect-form.tsx` con tabs por tipo, vista previa con `allocateOldestFirst`, atajos de meses y "Quedará en".
5. **Sheet.** El cobro de cuentas por cobrar usa el formulario nuevo; la lista de cuotas muestra los abonos compartidos.
6. **Tab Me deben.** Panel `receivable` en `TransactionDialog`, quitar cuentas por cobrar del tab **Deuda**, datos en `QuickActionsProvider`, acceso en el menú del header si aplica. Revisar tours de SPEC 27.
7. **MCP y exportes.** Cambiar lecturas de `period_on`.
8. **Docs y CHANGELOG.**
9. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [ ] El diálogo de movimiento en Personal muestra los tabs Gasto, Ingreso, Traspaso, Deuda, Me deben, Gasto fijo y Meta, en ese orden, en escritorio y a 390 px.
- [ ] El tab **Deuda** ya no lista cuentas por cobrar.
- [ ] Sin cuentas por cobrar activas, el tab **Me deben** muestra el enlace a Me deben.
- [ ] En un cobro único, **Abono** de 50.000 sobre un saldo de 200.000 deja saldo de 150.000.
- [ ] En un cobro único, **Pago completo** muestra el saldo fijo y al guardar la cuenta por cobrar queda pagada.
- [ ] En una mensual de 5.100 con sep, oct y nov sin pagar, **Varios meses** con 20.000 deja sep, oct y nov **Pagada** y dic **Abonada** con "Falta 400".
- [ ] Ese cobro crea un solo ingreso de 20.000 en la cuenta elegida y un solo abono en la cuenta por cobrar.
- [ ] La vista previa describe el mismo reparto que se guarda.
- [ ] En una mensual con número de cuotas, un monto mayor que lo que falta en total es rechazado con error en el campo.
- [ ] **Una cuota** con monto menor que lo que falta deja esa cuota **Abonada**.
- [ ] Editar el cobro de 20.000 a 10.200 deja sep y oct **Pagada** y nov y dic sin pagar.
- [ ] Eliminar el cobro devuelve las cuotas a su estado calculado.
- [ ] Las cuotas cobradas con SPEC 28/29 conservan su estado tras la migración.
- [ ] El cobro desde el Sheet y desde el tab usan el mismo formulario y dan el mismo resultado.
- [ ] Un usuario no puede leer ni escribir asignaciones de otro (RLS).
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

## Decisiones

- **Sí:** tab propio **Me deben** en el diálogo de movimiento (decisión del usuario), entre Deuda y Gasto fijo.
- **Sí:** opciones según tipo: **Abono | Pago completo** en cobro único, **Una cuota | Varios meses** en mensual (decisión del usuario).
- **Sí:** reparto automático desde la cuota más antigua con vista previa (decisión del usuario).
- **Sí:** un solo movimiento y un solo abono por pago (decisión del usuario).
- **Sí:** tabla de asignaciones en vez de varios abonos por pago. Motivo: conserva la relación 1:1 entre abono y movimiento de SPEC 26 y `sync_debt_entry_transaction`.
- **No:** varios `debt_entries` con el mismo `transaction_id`. Rompe el índice único y la sincronización de monto.
- **Sí:** mismo `allocateOldestFirst` que SPEC 38. Una sola regla de reparto en la app.
- **Sí:** formulario compartido entre tab y Sheet. Motivo: dos formularios de cobro divergen con el tiempo.
- **No:** casillas para elegir meses. Más pasos y el reparto automático cubre el caso pedido.
- **Sí:** tope de 12 meses futuros en indefinidas. Evita errores de dedo.

## Riesgos

| Riesgo                                                       | Mitigación                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Migrar `period_on` cambia estados de cuotas existentes       | Crear asignaciones antes de borrar la columna; criterio de cuotas de SPEC 28/29. |
| Siete tabs no caben en 360 px                                | Desplazamiento horizontal con `scrollIntoView` del activo, como SPEC 30.         |
| `check_debt_balance` y saldo de cuentas con número de cuotas | La RPC valida contra lo que falta antes de insertar; el trigger sigue como red.  |
| Cobros simultáneos sobre la misma cuenta por cobrar          | `for update` sobre la deuda en la RPC.                                           |
| Tours de SPEC 27 apuntan al tab **Deuda** para cobros        | Revisar en el paso 6.                                                            |
| MCP y exportes leen `period_on` borrado                      | Paso 7; `pnpm check` falla si queda una referencia.                              |

## Qué **no** entra en este spec

- Elegir meses a mano.
- Convertir entre **Una vez** y **Mes a mes**.
- Grupos de deudores, recordatorios, intereses y Empresa.
- Pagos de varios meses en gastos fijos o deudas propias.
- Lo de SPEC 36, 37, 38 y 40.
