# SPEC 37 — Gastos fijos: navegar meses anteriores e historial por gasto

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 16, SPEC 23, SPEC 28
> **Fecha:** 2026-11-13
> **Objetivo:** Que en **Gastos fijos** se pueda ir a meses anteriores para ver qué se pagó y qué no, pagar desde ese mes, y abrir cada gasto fijo con su lista mes a mes de pagos y atrasos.

## Por qué existe este spec

Hoy **Próximos pagos** muestra el mes actual y los impagos de los 2 meses anteriores (`OVERDUE_MONTHS = 2` en `recurring-expenses/queries.ts`). Un gasto atrasado de hace 4 meses desaparece y el usuario no sabe qué debe. Tampoco puede revisar un mes pasado para ver qué pagó.

**Me deben mes a mes** (SPEC 28) ya tiene la lista de cuotas Pagada / Pendiente / Atrasada. Gastos fijos adopta la misma idea.

Es el segundo de cinco specs del mismo pedido (SPEC 36 a 40).

## Alcance

**Entra:**

- **Navegador de mes** en la tarjeta **Próximos pagos** de `/dashboard/personal/recurring`:
  - mismo patrón que `budget-month-nav.tsx` (anterior, mes, siguiente), en `?month=YYYY-MM`;
  - por defecto el mes actual; no permite ir más allá del mes actual;
  - no permite ir antes del mes del `starts_on` más antiguo de los gastos fijos;
  - el título cambia a "Pagos de <mes>" cuando no es el mes actual.
- **Contenido de un mes elegido:**
  - **Mes actual:** igual que hoy (ocurrencias del mes + impagos anteriores), pero **sin tope de 2 meses**: lista todos los atrasados desde el inicio de cada gasto.
  - **Mes anterior:** todas las ocurrencias de ese mes, pagadas e impagas, con su estado (**Pagado** con fecha y monto, **Atrasado** si no se pagó).
  - **Marcar como pagado** disponible en toda ocurrencia impaga de cualquier mes. Abre `TransactionDialog` prellenado y enlazado a esa ocurrencia, como hoy (`PayOccurrenceButton`).
  - Resumen arriba de la lista: "Pagado $ X de $ Y" del mes elegido.
- **Indicador de atrasados:** contador "N atrasados · $ Z" en la cabecera de la página cuando hay ocurrencias impagas de meses anteriores, que lleva al mes del atraso más antiguo.
- **Sheet por gasto fijo** (nuevo, al hacer clic en la fila de la lista de gastos fijos, SPEC 25):
  - datos del gasto (monto, frecuencia, día, categoría, cuenta) y acciones existentes (editar, pausar, eliminar);
  - lista de ocurrencias desde `starts_on` hasta el mes actual, más reciente primero;
  - cada fila: periodo, fecha de vencimiento, estado y, si se pagó, fecha y monto del pago;
  - **Marcar como pagado** en filas impagas;
  - últimos 12 periodos y **Ver más**, como SPEC 28;
  - totales: pagado en el año y atrasado a la fecha.
- Los anuales muestran un periodo por año en el Sheet y aparecen solo en el mes de su vencimiento en el navegador.
- Un gasto pausado conserva sus ocurrencias pasadas en el Sheet y en meses anteriores, pero no genera nuevas desde que se pausó si hoy ya se excluye; se respeta el comportamiento actual de `recurring_occurrences`.
- Ocultar cifras (SPEC 22) aplica a montos y totales nuevos.
- Móvil: navegador de mes con controles de 44 px; Sheet en hoja inferior como los demás.
- **Documentación:** `docs/producto.md`, `docs/ui.md` si se agrega un patrón, `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Pagar varios meses en un solo pago o abonos parciales en gastos fijos.
- Frecuencias nuevas en gastos fijos (semanal, diaria, cada N días).
- Recordatorios o notificaciones de atrasos.
- Efecto de atrasos en el score.
- Gastos fijos en Empresa.

## Modelo de datos

Este spec no introduce tablas ni columnas. Reutiliza `recurring_expenses`, `transactions.recurring_expense_id` y la RPC `recurring_occurrences` de SPEC 04.

Cambios de código:

```ts
// src/features/recurring-expenses/queries.ts
// Reemplaza el tope OVERDUE_MONTHS en el mes actual
export async function getUpcomingPayments(
  workspaceId: string,
  month: string // YYYY-MM; por defecto currentMonth()
): Promise<UpcomingPayment[]>

// Lista completa de ocurrencias de un gasto fijo para el Sheet
export async function getRecurringExpenseHistory(
  recurringExpenseId: string,
  options: { limit: number } // 12 por defecto, "Ver más" aumenta
): Promise<UpcomingPayment[]>

export interface OverdueSummary {
  count: number
  amount: number
  oldestMonth: string | null // YYYY-MM
}
```

- La RPC `recurring_occurrences(p_workspace_id, p_from, p_to)` ya acepta rango. Para el mes actual, `p_from` = `starts_on` más antiguo del espacio.
- Si el rango largo es lento, se agrega en el paso 1 un índice o un parámetro `p_recurring_expense_id` a la RPC en una migración. Se decide midiendo, no por adelantado.

## Plan de implementación

1. **Queries.** `getUpcomingPayments` con `month` y sin tope de atrasados en el mes actual; `getOverdueSummary`; `getRecurringExpenseHistory`. Medir con un gasto de 24 meses.
2. **Navegador de mes.** Reutilizar o extraer `budget-month-nav.tsx` a un componente compartido (`src/components/dashboard/month-nav.tsx`) y conectarlo con `?month=`. Límites de inicio y mes actual.
3. **Lista por mes.** Estados Pagado / Atrasado en meses pasados, total "Pagado $ X de $ Y", **Marcar como pagado** en impagos.
4. **Indicador de atrasados** en la cabecera con enlace al mes más antiguo.
5. **Sheet por gasto fijo** con la lista de ocurrencias, **Ver más** y acciones.
6. **Móvil y cifras ocultas.**
7. **Docs y CHANGELOG.**
8. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [x] **Próximos pagos** tiene navegador de mes; el botón siguiente está deshabilitado en el mes actual.
- [x] El botón anterior está deshabilitado en el mes del gasto fijo más antiguo.
- [x] Un gasto mensual impago desde hace 5 meses aparece como **Atrasado** en el mes actual (antes desaparecía a los 2 meses).
- [x] En un mes pasado se ven las ocurrencias pagadas con fecha y monto, y las impagas como **Atrasado**.
- [x] **Marcar como pagado** en una ocurrencia de hace 3 meses crea el gasto enlazado a esa ocurrencia y la fila pasa a **Pagado**.
- [x] La cabecera muestra "N atrasados · $ Z" y lleva al mes del atraso más antiguo.
- [x] Clic en un gasto fijo abre su Sheet con una fila por periodo desde su inicio (últimos 12 y **Ver más**).
- [x] Un gasto anual muestra un periodo por año en el Sheet.
- [x] Con cifras ocultas, montos y totales nuevos muestran `***`.
- [ ] A 390 px el navegador y el Sheet se usan sin desplazamiento horizontal.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

## Decisiones

- **Sí:** navegador de mes para ir atrás y pagar desde ese mes (decisión del usuario).
- **Sí:** el mes pasado muestra también lo pagado (decisión del usuario), no solo lo impago.
- **Sí:** Sheet por gasto estilo Me deben (decisión del usuario).
- **Sí:** quitar el tope de 2 meses para atrasados en el mes actual. Motivo: un atraso viejo es justo lo que el usuario necesita ver.
- **No:** pagar varios meses en un pago ni abonos parciales (decisión del usuario).
- **No:** frecuencias nuevas en gastos fijos (decisión del usuario); van solo a ingresos fijos (SPEC 38).
- **Sí:** estado calculado, no guardado, igual que SPEC 04 y 28.
- **Sí:** no navegar a meses futuros. Motivo: el mes actual ya muestra lo próximo; meses futuros no tienen nada que pagar aún.
- **Sí (al implementar):** la RPC `recurring_occurrences` se respeta tal cual (decisión del usuario): un gasto pausado no aparece en ningún mes ni en los atrasados, y su Sheet muestra un aviso en vez de periodos. Sin migración.
- **Sí (al implementar):** sin migración ni índice nuevo. No se pudo medir con Supabase local (Docker apagado); la RPC genera un `generate_series` por gasto y el join usa el índice único `transactions_recurring_occurrence`.
- **Sí (al implementar):** la etiqueta del estado `overdue` pasa de "Vencido" a "Atrasado" en toda la app (UI, exportes y MCP).
- **Sí (al implementar):** `getRecurringExpenseHistory` devuelve `{ payments, hasMore, paidThisYear, overdueAmount }` en vez de un arreglo: el Sheet necesita saber si hay más y los totales sin pedir dos veces. El Sheet lo pide con la acción `loadRecurringExpenseHistory`.
- **Sí (al implementar):** el Sheet no muestra "cuenta": `recurring_expenses` no tiene esa columna (la cuenta se elige en cada pago). Muestra la vigencia.
- **Sí (al implementar):** el indicador de atrasados va en la fila de acciones de la vista, no en el header global (`DashboardTitle` vive en el layout). El navegador va dentro de la tarjeta, bajo el título.
- **Sí (al implementar):** `MonthNav` (compartido) tiene flechas de 44 px en móvil, también en Presupuestos.

## Riesgos

| Riesgo                                                   | Mitigación                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Rango largo hace lenta la RPC                            | Medir en el paso 1; índice o filtro por gasto en una migración si hace falta.                |
| Gastos importados (SPEC 08b) con `starts_on` muy antiguo | El indicador lo muestra como atrasos reales; el usuario puede editar `starts_on` o pagarlos. |
| Gastos pausados generan atrasos falsos                   | Respetar la regla actual de la RPC para pausados; criterio manual con un gasto pausado.      |
| Mover `budget-month-nav.tsx` rompe Presupuestos          | Extraer sin cambiar su API; verificar Presupuestos en el paso 2.                             |

## Qué **no** entra en este spec

- Pagos de varios meses o abonos en gastos fijos.
- Frecuencias semanal, diaria o cada N días en gastos.
- Recordatorios, score y Empresa.
- Lo de SPEC 36, 38, 39 y 40.
