# SPEC 28 — Me deben mes a mes

> **Estado:** Aprobado
> **Depende de:** SPEC 06, SPEC 16, SPEC 25, SPEC 26
> **Fecha:** 2026-11-04
> **Objetivo:** Que en **Me deben** se pueda registrar a alguien que paga una cuota mensual fija, con la lista de cuotas mes a mes (Pagada, Pendiente o Atrasada) y la fecha de cada cobro, además del cobro único que existe hoy.

## Por qué existe este spec

Hoy **Me deben** (`debts.kind = 'receivable'`) solo modela un préstamo que se devuelve en un momento o por abonos libres: un saldo inicial y una fecha esperada. No sirve para quien paga lo mismo cada mes (un arriendo, una cuota acordada con un familiar). El usuario no sabe qué meses le pagaron y cuáles no.

Es el cuarto de cuatro specs que salen del mismo pedido (ver SPEC 25).

## Alcance

**Entra:**

- **Tab en el formulario de crear** (`receivable-dialog.tsx`): **Una vez | Mes a mes**.
  - **Una vez:** el formulario actual (saldo y fecha esperada), sin cambios.
  - **Mes a mes:** nombre, deudor (opcional), **monto mensual**, **día de pago** (1–31), **fecha de inicio** y **número de cuotas** (opcional; vacío = indefinida).
  - El tipo de cobro no se cambia al editar: el tab solo aparece al crear. Al editar se muestran los campos del tipo elegido.
- **Saldo:**
  - Con número de cuotas: `opening_balance = monto mensual × cuotas`. El saldo pendiente baja con cada cobro, como hoy.
  - Indefinida: sin saldo total. La tarjeta muestra el monto mensual y lo cobrado en el año.
- **Lista de cuotas** en el Sheet de la cuenta por cobrar (`debt-sheet.tsx`):
  - Una fila por mes desde la fecha de inicio hasta el mes actual más el siguiente (o hasta la última cuota si tiene número de cuotas).
  - Cada fila: mes, fecha de pago esperada, estado y, si se cobró, fecha y monto del cobro.
  - Estados: **Pagada** (tiene cobro), **Atrasada** (pasó el día de pago sin cobro), **Pendiente** (aún no llega el día de pago). Colores desde `tone.ts`.
  - El día de pago se ajusta al último día del mes cuando el mes es más corto (31 → 30 de abril, 28 o 29 de febrero).
  - Una cuota pendiente o atrasada tiene **Marcar pagada**.
- **Cobro de una cuota:**
  - **Marcar pagada** abre el diálogo de cobro existente con el monto mensual prellenado (editable), la fecha (hoy por defecto) y la cuenta destino.
  - Igual que el cobro actual, crea el abono (`debt_entries`, `payment`) y el ingreso a la cuenta, y la cuota queda **Pagada el 5 nov**.
  - Una cuota solo admite un cobro. Si el monto es distinto al mensual, se muestra el monto cobrado en la fila.
  - Editar o eliminar el cobro (desde el Sheet o desde Movimientos, SPEC 26) devuelve la cuota a su estado calculado.
- **Tarjeta** (`receivable-card.tsx`): para mes a mes muestra el monto mensual, la próxima cuota y un indicador de cuotas atrasadas, con el mismo lenguaje visual de la tarjeta actual. Clicable completa (SPEC 25).
- **Fin del cobro:**
  - Con número de cuotas, al cobrar la última pasa a pagada (`status = 'paid'`) como hoy.
  - Indefinida, sigue activa hasta que el usuario la archiva.
- Ocultar cifras (SPEC 22) aplica a montos de tarjeta y totales; las filas de cuotas usan `Amount`.
- Documentar en `docs/producto.md`; anotar en `[Unreleased]` del `CHANGELOG.md` (en inglés).

**Fuera de alcance (para otros specs):**

- Recordatorios o notificaciones de cuotas atrasadas.
- Intereses o mora sobre cuotas atrasadas.
- Cobros mensuales en Empresa.
- Importar cuotas mensuales desde Excel/CSV.
- Efecto en el score y en recomendaciones.
- Frecuencias distintas a mensual (quincenal, semanal).
- Cambiar una cuenta por cobrar de **Una vez** a **Mes a mes** o al revés.

## Modelo de datos

```sql
-- supabase/migrations/<timestamp>_monthly_receivables.sql
create type public.receivable_schedule as enum ('once', 'monthly');

alter table public.debts
  add column schedule public.receivable_schedule,  -- solo cuentas por cobrar
  add column starts_on date;                        -- inicio del cobro mensual

-- Las cuentas por cobrar existentes son de cobro único
update public.debts set schedule = 'once' where kind = 'receivable';
```

Se reutilizan columnas existentes para el cobro mensual:

- `installment`: monto mensual.
- `due_day`: día de pago.
- `term_months`: número de cuotas (nulo = indefinida).

El `check` por tipo de `debts` se reemplaza para `receivable`:

- `schedule = 'once'`: igual que hoy (`opening_balance > 0`, sin `installment`, `due_day`, `term_months` ni `starts_on`).
- `schedule = 'monthly'`: `installment`, `due_day` y `starts_on` obligatorios; `expected_on` nulo.
  - Con `term_months`: `opening_balance = installment * term_months`.
  - Sin `term_months`: `opening_balance = 0`.
- Para `credit_card` y `loan`: `schedule` y `starts_on` nulos.

```sql
alter table public.debt_entries
  add column period_on date;  -- primer día del mes de la cuota cobrada

create unique index debt_entries_one_payment_per_period
  on public.debt_entries (debt_id, period_on)
  where period_on is not null;
```

Reglas en triggers:

- `period_on` solo se permite en abonos `payment` de cuentas por cobrar mensuales y es obligatorio en ellos; siempre es día 1 y no anterior al mes de `starts_on`.
- Con `term_months`, `period_on` no supera el mes de la última cuota.
- `check_debt_balance` no valida saldo negativo en cuentas por cobrar mensuales indefinidas (no tienen saldo total).

El estado de cada cuota se **calcula** en `src/features/debts/receivable-schedule.ts` (función pura), no se guarda:

```ts
type InstallmentStatus = "paid" | "pending" | "overdue"

interface Installment {
  period_on: string // YYYY-MM-01
  due_on: string // día de pago ajustado al mes
  status: InstallmentStatus
  entry: { id: string; amount: number; occurred_on: string } | null
}
```

## Plan de implementación

1. **Migración.** Enum, columnas, `check` nuevo, `period_on`, índice único y triggers; probar en local con `supabase db reset`; regenerar `src/types/database.ts`.
2. **Cálculo de cuotas.** `receivable-schedule.ts` con la lista de cuotas, ajuste de fin de mes y estados.
3. **Schemas y actions.** `monthlyReceivableSchema` en `schemas.ts`; `createDebt` acepta el cobro mensual y calcula `opening_balance`; `recordPayment` acepta `period_on`.
4. **Formulario.** Tabs **Una vez | Mes a mes** en `receivable-dialog.tsx` (solo al crear), con `useActionState` + Zod y `validationBehavior="aria"`.
5. **Sheet.** Lista de cuotas en `debt-sheet.tsx` con estado, fecha de cobro y **Marcar pagada**.
6. **Diálogo de cobro.** `PaymentDialog` con `period_on` y monto prellenado para cuotas.
7. **Tarjeta.** Monto mensual, próxima cuota y atrasadas en `receivable-card.tsx`.
8. **Queries.** `getDebts` trae `schedule`, `starts_on` y los abonos con `period_on`; totales de Me deben excluyen las indefinidas del saldo total.
9. **Docs y CHANGELOG.**
10. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [ ] Crear una cuenta por cobrar muestra los tabs **Una vez** y **Mes a mes**; **Una vez** se comporta igual que antes.
- [ ] Las cuentas por cobrar existentes quedan como **Una vez** tras la migración y no cambian su saldo.
- [ ] Una cuenta mes a mes con 12 cuotas de 100.000 tiene saldo inicial de 1.200.000.
- [ ] Una cuenta mes a mes sin cuotas se crea sin saldo total y la tarjeta muestra el monto mensual.
- [ ] El Sheet lista una fila por mes desde la fecha de inicio hasta el mes siguiente al actual (o la última cuota).
- [ ] Una cuota cuyo día de pago ya pasó sin cobro aparece como **Atrasada**.
- [ ] Una cuota con día de pago futuro aparece como **Pendiente**.
- [ ] **Marcar pagada** crea un ingreso en la cuenta elegida y la cuota pasa a **Pagada** con su fecha.
- [ ] Registrar un segundo cobro para la misma cuota es rechazado con error.
- [ ] Con día de pago 31, la cuota de febrero vence el último día de febrero.
- [ ] Eliminar el cobro de una cuota la devuelve a **Pendiente** o **Atrasada**.
- [ ] Con número de cuotas, cobrar la última marca la cuenta por cobrar como pagada.
- [ ] Una cuenta indefinida sigue activa hasta archivarla.
- [ ] El tipo de cobro no se puede cambiar al editar.
- [ ] Con cifras ocultas, montos de tarjeta y cuotas muestran `***`.

## Decisiones

- **Sí:** reutilizar `debts` y `debt_entries` en vez de tablas nuevas. Motivo: el cobro mensual es una cuenta por cobrar; así hereda Sheet, archivo, cobros con cuenta, Movimientos y edición de SPEC 26.
- **Sí:** número de cuotas opcional (decisión del usuario). Con cuotas hay saldo; sin cuotas, solo lista mes a mes.
- **Sí:** el cobro crea ingreso a cuenta con fecha (decisión del usuario), como el cobro actual.
- **Sí:** estados Pagada, Pendiente y Atrasada (decisión del usuario).
- **Sí:** estado calculado, no guardado. Motivo: depende de la fecha de hoy; guardarlo exigiría un job diario.
- **Sí:** un cobro por cuota con monto editable. Motivo: simple de leer en la lista; los pagos parciales quedan visibles por el monto.
- **No:** convertir entre **Una vez** y **Mes a mes** al editar. Cambia el saldo y el sentido de los abonos ya registrados.
- **No:** guardar filas por cuota por adelantado. Una cuenta indefinida no tiene final.

## Riesgos

| Riesgo                                                           | Mitigación                                                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Reemplazar el `check` de `debts` rompe filas existentes          | La migración pone `schedule = 'once'` antes de crear el `check` nuevo; probar con `supabase db reset` y con datos reales copiados. |
| `check_debt_balance` y saldo cero en indefinidas                 | Excepción explícita en el trigger para `schedule = 'monthly'` sin `term_months`.                                                   |
| Zona horaria al decidir **Atrasada**                             | Comparar fechas `YYYY-MM-DD` en la zona del usuario (`es-CO`), igual que gastos fijos.                                             |
| Importaciones (SPEC 08b) crean cuentas por cobrar sin `schedule` | `import_debt_entries` y la importación de deudas ponen `schedule = 'once'`; revisar en el paso 1.                                  |
| Lista larga en cuentas indefinidas antiguas                      | Mostrar los últimos 12 meses y un **Ver más**.                                                                                     |

## Qué **no** entra en este spec

- Recordatorios, intereses o mora.
- Cobros mensuales en Empresa.
- Importación de cuotas.
- Score y recomendaciones.
- Otras frecuencias.
- Lo de SPEC 25, 26 y 27.
