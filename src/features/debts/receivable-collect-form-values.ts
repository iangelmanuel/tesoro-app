import {
  type PaymentPeriod,
  buildPaymentDescription
} from "@/libs/payment-description"
import {
  type CollectPeriod,
  type CollectPreview,
  type CollectableReceivable,
  MONTH_SHORTCUTS,
  amountForMonths,
  previewCollection
} from "./receivable-collect"
import type { ReceivableCollectMode } from "./receivable-schemas"

// Prellenado y textos del formulario de cobro de una cuenta por cobrar
// (ReceivableCollectForm, SPEC 39 y 41). Puro: lo usa el formulario
// (cliente).

/** Etiqueta de cada modo de cobro */
export const COLLECT_MODE_LABELS: Record<ReceivableCollectMode, string> = {
  partial: "Abono",
  full: "Pago completo",
  single: "Una cuota",
  allocate: "Varios meses"
}

/** Toast al registrar: el pago completo salda la cuenta por cobrar */
export function collectToast(mode: ReceivableCollectMode) {
  return mode === "full" ? "Cuenta por cobrar pagada" : "Cobro registrado"
}

/** Una cuota: la elegida al abrir o la más antigua sin cubrir; "" si no hay */
export function initialCollectPeriod(open: CollectPeriod[], periodOn?: string) {
  return (
    open.find((item) => item.period_on === periodOn)?.period_on ??
    open[0]?.period_on ??
    ""
  )
}

/** Lo que falta de una cuota abierta; null si no está entre las abiertas */
export function remainingOf(open: CollectPeriod[], periodOn: string) {
  return open.find((item) => item.period_on === periodOn)?.remaining ?? null
}

/** Vista previa del reparto: solo en Varios meses y con un monto positivo */
export function collectPreview(
  mode: ReceivableCollectMode,
  receivable: CollectableReceivable,
  amount: number | null
) {
  return mode === "allocate" && amount !== null && amount > 0
    ? previewCollection(receivable, amount)
    : null
}

/**
 * Cuotas que toca el cobro, en orden: la elegida en Una cuota, o las que
 * cubre o abona el reparto de Varios meses. Vacío en los demás modos o si el
 * reparto tiene error
 */
export function collectedPeriods(
  mode: ReceivableCollectMode,
  period: string,
  preview: CollectPreview | null
) {
  if (mode === "single") return [period].filter(Boolean)
  if (!preview || preview.error) return []
  return [
    ...preview.covered,
    ...(preview.partial ? [preview.partial.key] : [])
  ].sort()
}

/**
 * Descripción sugerida del ingreso y la nota (SPEC 41): "Cobro {nombre} ·
 * {cuotas}", o solo "Cobro {nombre}" sin cuotas
 */
export function collectDescription(receivableName: string, periods: string[]) {
  const period: PaymentPeriod =
    periods.length === 0
      ? { kind: "none" }
      : { kind: "range", from: periods[0], to: periods[periods.length - 1] }
  return buildPaymentDescription("Cobro", receivableName, period)
}

/** Saldo o "N cuotas por cobrar · $ Z"; `money` formatea (u oculta) montos */
export function receivableSummary(
  receivable: CollectableReceivable,
  money: (value: number) => string
) {
  if (receivable.schedule === "once") {
    return `Saldo ${money(receivable.balance ?? 0)}`
  }
  if (receivable.owedCount === 0) {
    return "Al día"
  }
  const noun = receivable.owedCount === 1 ? "cuota" : "cuotas"
  return `${receivable.owedCount} ${noun} por cobrar · ${money(receivable.owed)}`
}

/** Atajos "2, 3 o 6 meses" con el monto que falta; sin los que no alcanzan */
export function monthShortcutOptions(receivable: CollectableReceivable) {
  return MONTH_SHORTCUTS.map((months) => ({
    months,
    amount: amountForMonths(receivable, months)
  })).filter(
    (
      option
    ): option is { months: (typeof MONTH_SHORTCUTS)[number]; amount: number } =>
      option.amount !== null
  )
}
