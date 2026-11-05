# SPEC 26 — Editar pagos de deuda, avances, aportes y pagos de gasto fijo desde Movimientos

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 04, SPEC 05, SPEC 06, SPEC 16, SPEC 19
> **Fecha:** 2026-11-04
> **Objetivo:** Que todo movimiento vinculado (pago o avance de tarjeta, pago de préstamo o cobro de Me deben, aporte o retiro de meta y pago de gasto fijo) se pueda editar y eliminar desde Movimientos y que el cambio se refleje en la deuda, la meta o el gasto fijo de origen.

## Por qué existe este spec

Los usuarios reportan movimientos que no se pueden modificar, casi siempre de meses pasados. Revisando el código:

- **Pagos y avances de tarjeta y aportes de meta con cuenta** (`debt_payment`, `debt_advance`, `goal_contribution` en `ACCOUNT_MOVEMENT_KINDS`) salen en Movimientos como filas grises de **solo lectura** (`AccountMovementRow` en `transactions-table.tsx`). Solo se editan desde la deuda o la meta.
- **Pagos de préstamo y cobros de Me deben** son movimientos (`transactions`) enlazados por `debt_entries.transaction_id`. Se editan con `TransactionDialog`, pero el cambio **no llega** al abono: `sync_debt_entry_transaction` solo sincroniza del abono al movimiento, no al revés. El saldo de la deuda queda desfasado.
  - Eliminar ese movimiento deja el abono vivo (`on delete set null`): la deuda sigue contando un pago cuyo movimiento ya no existe.
- **Pagos de gasto fijo** (`transactions.recurring_expense_id`) se abren con `TransactionDialog` con el tipo bloqueado. Hay reportes de que algunos de meses pasados no se pueden guardar; la causa exacta se confirma en el paso 1 del plan.

Es el segundo de cuatro specs que salen del mismo pedido (ver SPEC 25).

### Causa del bug (paso 1, reproducido en local)

No es del gasto fijo ni del servidor: el `update` pasa en Postgres con RLS y
triggers, y la action guarda bien ("Movimiento actualizado", la ocurrencia
sigue pagada). El problema es que **el menú de la fila no abre**:

- `SortableRow` llama a `useSortable({ disabled: !reorder?.canDrag })`.
- Con `disabled`, dnd-kit pone `aria-disabled="true"` en el `<tr>`.
- HeroUI estiliza `.table__row[aria-disabled="true"]` con `status-disabled`:
  opacidad atenuada y **`pointer-events: none`**. El botón ⋮ queda
  inalcanzable con mouse o dedo.
- `canDrag` es falso cuando la fila es **la única de su día** a la vista, y
  `reorder` no existe con búsqueda activa. En meses pasados casi todos los
  días tienen un solo movimiento, por eso el reporte "casi siempre de meses
  pasados". Afecta a cualquier fila (ingreso, gasto, traspaso, ajuste), no
  solo a gastos fijos.

Arreglo (paso 2): que la fila no reciba `aria-disabled` cuando no se puede
arrastrar; el asa ya se oculta en ese caso.

## Alcance

**Entra:**

- **Filas de solo lectura pasan a editables** en Movimientos (escritorio y móvil, `DataRows`):
  - Pago de tarjeta (`debt_payment`) y avance de tarjeta (`debt_advance`): editar abre `PaymentDialog` en modo edición con el `DebtEntry` (acción existente `updateEntry`); eliminar usa `deleteEntry`.
  - Aporte o retiro de meta (`goal_contribution`): editar abre `ContributionDialog` en modo edición (acción `updateContribution`); eliminar usa `deleteContribution`.
  - Las filas mantienen su estilo gris y quedan fuera de los totales (SPEC 16). Solo ganan el menú de acciones (`EntryActions`) como el resto.
- **Movimientos enlazados a un abono** (pago de préstamo, cobro de Me deben):
  - Editar abre el `PaymentDialog` del abono en vez de `TransactionDialog`. El abono es la fuente de verdad y el trigger existente sincroniza el movimiento.
  - Eliminar llama a `deleteEntry`, que borra abono y movimiento juntos.
  - La consulta de Movimientos (`queries.ts`) trae el `debt_entry` enlazado (id y deuda) para saber qué diálogo abrir.
  - **Defensa en el servidor:** `updateTransaction` y `deleteTransaction` rechazan un movimiento que tenga abono enlazado, con el mensaje "Este movimiento es un pago de deuda: edítalo desde su diálogo de pago". Así el desfase no puede volver a ocurrir por otra vía.
- **Pagos de gasto fijo:**
  - Reproducir el bug con un pago de un mes pasado y corregir la causa (validación de categoría archivada, de `recurring_due_on` u otra que aparezca).
  - Al editar se pueden cambiar monto, fecha, hora, cuenta, categoría y nota. La ocurrencia (`recurring_due_on`) no cambia y sigue marcada pagada.
  - Eliminar el movimiento deja la ocurrencia otra vez pendiente (comportamiento actual, se verifica).
- **Validación:** se aplican las mismas reglas que al registrar desde la deuda o la meta (triggers actuales). Si el nuevo monto deja la deuda con saldo negativo, o la fecha cae fuera de lo permitido, se rechaza y el diálogo muestra el error en el campo.
- **Revalidación:** al guardar o eliminar se revalidan Movimientos, Cuentas, Resumen y la página de origen (Deudas, Metas o Gastos fijos).
- **Corrección de datos existentes:** migración que detecta abonos cuyo `amount`, `occurred_on` u `occurred_time` no coincidan con su movimiento enlazado y los alinea con el **movimiento** (lo que el usuario editó por última vez). Abonos con `transaction_id` nulo que antes tenían movimiento no se pueden detectar y quedan como están.
- Documentar en `docs/producto.md` (qué se edita desde dónde); anotar en `[Unreleased]` del `CHANGELOG.md` (en inglés).

**Fuera de alcance (para otros specs):**

- Cambiar la deuda, la meta o el gasto fijo al que pertenece un pago (se elimina y se registra de nuevo).
- Editar cuotas de manejo (`fee`) desde Movimientos.
- Edición masiva o en línea en la tabla.
- Mejoras de UI de SPEC 25 y tabs de pago en el diálogo de movimiento.

## Modelo de datos

No hay tablas ni columnas nuevas. Cambian la consulta y una migración de corrección:

```ts
// src/features/transactions/queries.ts — fila de movimiento
interface TransactionRow {
  // ...campos actuales
  recurring_expense_id: string | null
  /** Abono enlazado (pago de préstamo o cobro de Me deben), si existe */
  debt_entry: { id: string; debt_id: string; debt_kind: DebtKind } | null
}
```

```sql
-- supabase/migrations/<timestamp>_realign_debt_entries_with_transactions.sql
-- Alinea abonos con su movimiento enlazado cuando difieren (desfase previo a SPEC 26)
update public.debt_entries e
set amount = t.amount, occurred_on = t.occurred_on, occurred_time = t.occurred_time
from public.transactions t
where e.transaction_id = t.id
  and (e.amount, e.occurred_on, e.occurred_time)
      is distinct from (t.amount, t.occurred_on, t.occurred_time);
```

La migración se revisa contra los triggers de `debt_entries` (saldo no negativo, cuenta activa): si alguna fila los viola, se reporta y se deja sin tocar en lugar de fallar toda la migración.

## Plan de implementación

1. **Reproducir.** Con datos de un mes pasado: editar un pago de gasto fijo, un pago de préstamo, un pago de tarjeta y un aporte. Anotar en este spec la causa del bug de gasto fijo.
2. **Arreglo de gasto fijo.** Corregir la causa encontrada en `transactions/actions.ts` o `transaction-dialog.tsx`.
3. **Consulta.** Agregar `debt_entry` a la fila de movimiento en `queries.ts`.
4. **Filas de tarjeta y meta editables.** `AccountMovementRow` recibe `EntryActions` con `PaymentDialog` o `ContributionDialog` en modo edición y la acción de eliminar correspondiente.
5. **Movimientos con abono.** En la fila de movimiento, si `debt_entry` existe, editar abre `PaymentDialog` y eliminar llama a `deleteEntry`.
6. **Defensa en el servidor.** `updateTransaction` y `deleteTransaction` rechazan movimientos con abono enlazado.
7. **Móvil.** Mismo comportamiento en `DataRows` y en el menú de fila de SPEC 20.
8. **Revalidación.** Revisar que `updateEntry`, `deleteEntry`, `updateContribution` y `deleteContribution` revaliden Movimientos además de su página.
9. **Migración de corrección.** Crear, probar en local (`supabase db reset`) y regenerar `src/types/database.ts` si cambia algo.
10. **Docs y CHANGELOG.**
11. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [x] Un pago de tarjeta de un mes pasado se edita desde Movimientos y el saldo de la tarjeta cambia en Deudas.
- [x] Un avance de tarjeta se edita y elimina desde Movimientos y el saldo de la tarjeta lo refleja.
- [x] Un pago de préstamo editado desde Movimientos cambia el saldo del préstamo en Deudas.
- [x] Eliminar un pago de préstamo desde Movimientos devuelve el saldo del préstamo y borra el abono.
- [x] Un cobro de Me deben editado desde Movimientos cambia el saldo pendiente.
- [x] Un aporte o retiro de meta se edita y elimina desde Movimientos y el progreso de la meta cambia.
- [x] Un pago de gasto fijo de un mes pasado se guarda con nuevo monto y fecha, y su ocurrencia sigue pagada.
- [x] Un monto que deja la deuda con saldo negativo se rechaza con error visible en el campo.
- [x] Llamar a `updateTransaction` o `deleteTransaction` con un movimiento enlazado a un abono devuelve error y no cambia nada.
- [x] Las filas grises siguen fuera de los totales de Movimientos.
- [x] Tras la migración, ningún abono con `transaction_id` difiere de su movimiento en monto, fecha u hora (salvo los reportados por violar un trigger).

Verificado con Playwright y SQL contra Supabase local (usuario demo, meses
pasados). Dos casos se cubrieron por la ruta compartida y no de punta a punta:
editar un avance (mismo `PaymentDialog` y `updateEntry` que el pago de tarjeta
probado) y eliminar un aporte (misma `deleteContribution` que usa Metas).

## Decisiones

- **Sí:** los cuatro tipos de fila editables desde Movimientos (decisión del usuario).
- **Sí:** reutilizar los diálogos de dominio (`PaymentDialog`, `ContributionDialog`) en vez de editar el movimiento. Motivo: el abono o aporte es la fuente de verdad y ya tiene sus validaciones y triggers.
- **No:** trigger de sincronización inversa (movimiento → abono). Motivo: dos direcciones de sincronización crean ciclos y dos fuentes de verdad.
- **Sí:** rechazar con error si la edición viola las reglas de la deuda (decisión del usuario). Mismas reglas que al registrar.
- **Sí:** alinear el desfase histórico con el movimiento. Motivo: es lo último que el usuario editó y lo que ve en Movimientos.
- **No:** alinear `account_id` en la migración (decisión del usuario, paso 9). En préstamos y cuentas por cobrar la cuenta vive solo en el movimiento: `check_debt_entry` exige `account_id` nulo en el abono, así que no hay desfase posible. **Sí** se alinea `occurred_time`, que el trigger sincroniza desde SPEC 19.
- **No:** permitir cambiar la deuda o meta de destino al editar. Complica saldos y validaciones; se elimina y se registra de nuevo.

## Riesgos

| Riesgo                                                                            | Mitigación                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| La migración de corrección viola un trigger (saldo negativo) y falla todo el push | Ejecutar fila por fila con manejo de excepción y `raise notice`; las que fallen se listan y quedan sin tocar. |
| La causa del bug de gasto fijo es distinta a la esperada                          | El paso 1 la documenta antes de tocar código; si exige cambio de esquema, se agrega un paso.                  |
| Doble revalidación lenta al editar                                                | Revalidar solo rutas afectadas, como hacen las actions actuales.                                              |

## Qué **no** entra en este spec

- Cambiar la deuda o meta de un pago.
- Editar cuotas de manejo desde Movimientos.
- Edición en línea en la tabla.
- Lo de SPEC 25, 27 y 28.
