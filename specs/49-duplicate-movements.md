# SPEC 49 — Duplicar movimientos

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 05, SPEC 06, SPEC 08c, SPEC 10, SPEC 20, SPEC 26, SPEC 29, SPEC 37, SPEC 38, SPEC 39, SPEC 42
> **Fecha:** 2026-11-19
> **Objetivo:** Agregar la acción **Duplicar** a cada movimiento para abrir su diálogo de creación ya prellenado con sus datos, de modo que al guardar se registre un movimiento nuevo.

## Por qué existe este spec

Muchos movimientos se repiten casi iguales: el mercado de la semana, el pago de la cuota del préstamo, el aporte a una meta, el traspaso a la cuenta de ahorro. Hoy hay que llenar todo el formulario cada vez.

Duplicar es solo un atajo de rellenado. No crea nada por sí mismo: abre el diálogo de **crear** con los datos copiados. El usuario cambia lo que quiera y guarda. Si cancela, no pasa nada.

La única regla de fondo es no pagar dos veces el mismo periodo. Por eso el duplicado de un pago de gasto fijo, un cobro de ingreso fijo o un cobro de Me deben mensual va al **siguiente periodo sin pagar**.

## Alcance

**Entra:**

- **Acción Duplicar** en el menú de fila (`RowActions`), entre **Editar** y **Eliminar**, con ícono `Copy` de `lucide-react`. Llega igual a escritorio y a las tarjetas móviles (SPEC 20).
- **Dónde aparece:**
  - **Movimientos** (Personal y Empresa):
    - entradas y salidas sueltas (`TransactionDialog`);
    - traspasos (`TransferDialog`);
    - pagos, cobros y avances enlazados a una deuda (`LinkedPaymentActions`);
    - pagos de tarjeta, avances antiguos y aportes o retiros de meta (`AccountMovementRow`).
  - **Sheet de una deuda** (`DebtEntriesList`): pago, abono, compra, avance y cuota de manejo.
  - **Sheet de una meta** (`ContributionsList`): aporte y retiro.
  - **Sheet de un gasto fijo o ingreso fijo**: cada pago o cobro registrado (`RecordedPaymentActions`, SPEC 42).
- **Qué se copia:** tipo, monto, categoría, cuenta, descripción, nota y contraparte (Empresa). En deudas, además, el modo del diálogo (pago, abono extra, compra, avance, cuota de manejo) y el número de cuotas de una compra o avance.
- **Qué no se copia:**
  - la **fecha**: va **hoy** (`todayISO()`);
  - la **hora**: va vacía;
  - el **n.º de factura** (`invoice_ref`, Empresa): va vacío;
  - el orden dentro del día (`day_position`): lo asigna la creación normal.
- **Cuenta o categoría archivada:** el campo queda vacío y el usuario elige otra. Se usa la misma regla que los prellenados de fijos (`activeAccountId`).
- **Periodos (no pagar dos veces el mismo):**
  - **Gasto fijo:** el duplicado se enlaza a la primera ocurrencia sin pagar con vencimiento **posterior** a la del original (`recurring` de `TransactionDialog`). Ej.: el original paga noviembre → el duplicado paga diciembre. Si diciembre ya está pagado, salta a enero.
  - **Ingreso fijo:** el duplicado lleva `recurring_income_id` y se reparte con la regla de SPEC 38 (periodo abierto más antiguo).
  - **Me deben mensual:** el duplicado cubre la primera cuota pendiente posterior a la que cubrió el original (`periodOn` de `ReceivableCollectDialog`).
  - **Sin periodo pendiente** (el fijo terminó o todas las cuotas están cobradas): en el Sheet, Duplicar no aparece; en Movimientos, la acción muestra un toast y no abre el diálogo.
- **Préstamos y tarjetas:** el duplicado es un pago nuevo de la misma deuda. Si la cuota del ciclo actual ya está cubierta (`nextPayment(debt).status === "paid"`), el diálogo muestra un aviso pero deja guardar.
- **Cuándo no aparece Duplicar:**
  - en ajustes de cuenta y en ajustes de deuda;
  - si la deuda no está activa (pagada o archivada), salvo un Me deben con cuotas pendientes;
  - si la meta no está activa;
  - en espacios marcados para borrar (solo lectura, como Editar).
- **Al guardar:** mismo flujo, validaciones y toast que crear (por ejemplo "Movimiento registrado", "Pago registrado"). No hay acción de servidor nueva para escribir.
- **Documentación:** `docs/producto.md` (Duplicar y sus reglas de periodo), `docs/ui.md` (orden del menú de fila) y `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Duplicar ajustes (de cuenta o de deuda): se corrigen con **Actualizar saldo**.
- Duplicar desde los agentes de IA (MCP). El agente ya crea movimientos con todos los datos.
- Duplicar varios movimientos a la vez.
- Duplicar entidades (deudas, metas, gastos fijos, presupuestos). Solo movimientos.
- Elegir el periodo destino a mano en la modal.
- Movimientos importados en bloque (Importar) como fuente especial: se duplican como cualquier otro una vez guardados.

## Modelo de datos

Este spec no agrega tablas, columnas ni migraciones. Reusa `transactions`, `transfers`, `debt_entries`, `debt_entry_allocations`, `goal_contributions` y `recurring_income_allocations`.

Cambios de tipos en el cliente:

```ts
// src/features/transactions/components/transaction-dialog.tsx
export interface TransactionInitialValues {
  // ...los de hoy
  note?: string
  counterparty?: string | null
}

// src/features/debts/components/payment-dialog.tsx
export interface PaymentInitialValues {
  mode: PaymentMode // "payment" | "extra" | "purchase" | "advance" | "fee"
  amount: number
  account_id: string | null
  category_id: string | null
  description: string
  note: string
  installments?: number | null
}

// src/features/goals/components/contribution-dialog.tsx
export interface ContributionInitialValues {
  amount: number
  account_id: string | null
  note: string
}

// src/features/accounts/components/transfer-dialog.tsx
export interface TransferInitialValues {
  from_account_id: string | null
  to_account_id: string | null
  amount: number
  note: string
}
```

Acción de lectura nueva en `src/features/transactions/actions.ts`:

```ts
// Valores del duplicado de un movimiento suelto o de un pago de fijo.
// Resuelve el periodo destino en el servidor.
loadTransactionDuplicate(workspaceId: string, transactionId: string): Promise<
  | {
      initialValues: TransactionInitialValues
      recurring?: RecurringOccurrenceLink // gasto fijo: siguiente ocurrencia sin pagar
    }
  | { error: string } // incluye "no hay periodos pendientes"
>
```

Helpers puros:

- `nextUnpaidOccurrence(payments, recurringExpenseId, afterDueOn)` en `src/features/recurring-expenses/payment.ts`, junto a `unpaidOccurrence`.
- `nextPendingInstallment(receivable, afterPeriodOn)` en `src/features/debts/receivable-collect.ts`.
- `duplicateDate()` no existe: se usa `todayISO()` directo.

## Plan de implementación

1. **Menú de fila.** Agregar el ítem opcional `duplicate` a `EntryActions` (`transactions-table.tsx`), con `renderDuplicate` igual que `renderEdit`. Orden: Editar, Duplicar, Eliminar. Sin consumidores todavía.
2. **Movimientos sueltos.** Ampliar `TransactionInitialValues` con `note` y `counterparty`, y que el formulario los use. Crear `loadTransactionDuplicate` sin periodos (solo copia y fecha de hoy). Conectar Duplicar en la fila de movimiento suelto. Prueba manual: duplicar un gasto, cambiar el monto, guardar → aparece uno nuevo hoy y el original sigue igual.
3. **Gasto fijo.** Agregar `nextUnpaidOccurrence` y usarlo en `loadTransactionDuplicate` cuando el original tiene `recurring_expense_id`. Sin ocurrencia pendiente → `{ error }` y toast. Prueba: duplicar el pago de noviembre → la modal paga diciembre.
4. **Ingreso fijo.** En `loadTransactionDuplicate`, copiar `recurring_income_id` para que el reparto de SPEC 38 cubra el periodo abierto. Sin periodo abierto → `{ error }`.
5. **Sheets de fijos.** Agregar Duplicar a `RecordedPaymentActions`, oculto cuando el Sheet sabe que no hay periodos pendientes.
6. **Traspasos.** Agregar `initialValues` a `TransferDialog` y conectar Duplicar en `TransferRow`.
7. **Metas.** Agregar `initialValues` a `ContributionDialog` (con `goalId` y `kind` fijos). Conectar Duplicar en `ContributionsList` y en la fila de aporte de `AccountMovementRow`. Oculto si la meta no está activa.
8. **Deudas: diálogo.** Agregar `initialValues` a `PaymentDialog` / `PaymentForm` (modo, monto, cuenta, categoría, descripción, nota, cuotas). Aviso de ciclo ya cubierto en préstamos y tarjetas con `nextPayment`.
9. **Deudas: Sheet.** Conectar Duplicar en `DebtEntriesList` usando `loadDebtEntryEditor` para leer el original. Oculto en ajustes y en deudas no activas.
10. **Deudas: Movimientos.** Conectar Duplicar en `LinkedPaymentActions` y en la rama de deuda de `AccountMovementRow`, con el mismo camino del paso 9.
11. **Me deben.** Agregar `nextPendingInstallment` y abrir `ReceivableCollectDialog` con `periodOn` de la cuota siguiente a la del original (leída de `debt_entry_allocations`). Sin cuota pendiente → oculto en el Sheet y toast en Movimientos.
12. **Documentación.** `docs/producto.md`, `docs/ui.md` y `CHANGELOG.md`.

## Criterios de aceptación

- [ ] El menú de fila de un movimiento suelto muestra **Editar**, **Duplicar** y **Eliminar**, en ese orden, en escritorio y en móvil.
- [ ] Duplicar abre el diálogo de crear (no el de editar) con tipo, monto, categoría, cuenta, descripción, nota y contraparte del original.
- [ ] La fecha del duplicado es hoy y la hora está vacía.
- [ ] En Empresa, el n.º de factura del duplicado está vacío.
- [ ] Cancelar el diálogo no crea nada.
- [ ] Guardar crea un movimiento nuevo y el original no cambia (mismo id, monto y fecha).
- [ ] Si la cuenta o la categoría del original están archivadas, el campo aparece vacío.
- [ ] Duplicar el pago de noviembre de un gasto fijo abre el pago de diciembre; si diciembre ya está pagado, abre el de enero.
- [ ] Duplicar el pago de un gasto fijo sin ocurrencias pendientes no abre el diálogo: en Movimientos muestra un toast y en su Sheet no aparece la acción.
- [ ] Duplicar el cobro de un ingreso fijo guarda un cobro que cubre un periodo abierto, nunca uno ya cubierto del todo.
- [ ] Duplicar un cobro de Me deben mensual cubre la cuota pendiente siguiente a la del original.
- [ ] Duplicar un pago de préstamo o tarjeta con la cuota del ciclo ya cubierta muestra el aviso y permite guardar.
- [ ] Duplicar una compra de tarjeta con cuotas copia el número de cuotas.
- [ ] Duplicar un traspaso abre el traspaso con las mismas cuentas, monto y nota.
- [ ] Duplicar un aporte o un retiro de meta abre el mismo tipo en la misma meta.
- [ ] Los ajustes de cuenta y de deuda no muestran Duplicar.
- [ ] Una deuda pagada o archivada y una meta no activa no muestran Duplicar en sus movimientos.
- [ ] En un espacio marcado para borrar no aparece Duplicar.
- [ ] Con cifras ocultas (SPEC 22), el monto prellenado se ve igual que al crear.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

## Decisiones

- **Sí:** abrir el diálogo de crear prellenado. Duplicar es un atajo de formulario; el usuario confirma cada copia.
- **No:** copiar directo sin modal. Crearía movimientos sin revisar y obligaría a deshacer.
- **Sí:** fecha de hoy y hora vacía. El caso típico es repetir un movimiento de otro día.
- **No:** copiar la fecha del original. Habría que cambiarla casi siempre.
- **Sí:** limpiar el n.º de factura. Una factura no se repite.
- **Sí:** gasto fijo → siguiente ocurrencia sin pagar posterior a la del original. Evita pagar dos veces un periodo, que es lo que pidió el usuario.
- **No:** selector de periodo en la modal. Más UI para un caso raro; se puede agregar después.
- **Sí:** ingreso fijo → regla de reparto de SPEC 38 (periodo abierto más antiguo). Ya reparte entre varios periodos y no deja huecos. En la práctica coincide con "el siguiente" salvo que haya un periodo anterior abierto.
- **Sí:** préstamos y tarjetas → aviso sin bloquear. Sus ciclos se calculan por fecha, no hay periodo guardado, y un segundo pago puede ser un abono válido.
- **No:** bloquear Duplicar con el ciclo cubierto. Impediría abonos extra por esta vía.
- **Sí:** el periodo destino de un movimiento suelto se resuelve en el servidor (`loadTransactionDuplicate`). La tabla de Movimientos no carga las ocurrencias pendientes; calcularlas por fila sería caro.
- **Sí:** sin periodo pendiente, la acción se oculta donde ya se conocen los periodos (Sheets) y responde con toast en Movimientos. Ocultarla en Movimientos exigiría cargar los periodos de cada fila.
- **No:** Duplicar en ajustes. Un ajuste corrige un saldo a una cifra; repetirlo dejaría el saldo mal.
- **No:** tool del MCP. El agente ya puede crear movimientos con todos los datos.
- **No:** columnas ni migraciones. Todo se resuelve con los diálogos y servicios de crear.

## Riesgos

| Riesgo                                                                               | Mitigación                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| El periodo destino cambia entre abrir la modal y guardar (otro pago en otra pestaña) | La creación ya valida la ocurrencia en el servidor (SPEC 37/38/39) y responde error si ya está pagada. |
| Un diálogo de crear ignora un campo nuevo de `initialValues` y el usuario no lo nota | Criterios de aceptación por campo y por diálogo.                                                       |
| La deuda cambió de estado (se pagó) después de cargar el Sheet                       | `PaymentDialog` ya rechaza pagos a deudas no activas en el servidor; el toast lo explica.              |
| El duplicado de un pago de deuda en Movimientos abre el diálogo equivocado           | Se usa `loadDebtEntryEditor` para leer el tipo real del abono, igual que Editar (SPEC 42).             |

## Qué no entra en este spec

- Duplicar ajustes de cuenta o de deuda.
- Duplicar desde el MCP.
- Duplicar en lote.
- Duplicar deudas, metas, gastos fijos, ingresos fijos o presupuestos.
- Elegir a mano el periodo destino.

Cada uno de esos, si llega, va en su propio spec.
