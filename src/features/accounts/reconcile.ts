import type { Tone } from "@/components/dashboard/feedback/tone"
import { SITE } from "@/config/site"
import { formatCurrency } from "@/libs/format"
import { roundCents } from "@/libs/money"
import { parseSignedAmount } from "./schemas"

// Cálculos del diálogo de cuadrar saldo (SPEC 21). Puro: lo usa
// ReconcileDialog y se prueba sin React. La diferencia que se guarda la
// recalcula el servidor; aquí solo se muestra.

/** Saldo pedido al servidor para una fecha distinta de hoy */
export interface FetchedBalance {
  date: string
  balance: number | null
}

/**
 * Saldo calculado a `date`: el de la cuenta si es hoy, el que llegó del
 * servidor si ya es de esa fecha, o undefined mientras se calcula
 */
export function calculatedBalanceAt(
  date: string,
  today: string,
  accountBalance: number,
  fetched: FetchedBalance
): number | null | undefined {
  if (date === today) {
    return accountBalance
  }
  if (fetched.date === date) {
    return fetched.balance
  }
  return undefined
}

/**
 * Saldo real escrito menos el calculado, en centavos. null sin un saldo
 * real válido o sin saldo calculado
 */
export function reconcileDifference(
  realText: string,
  calculated: number | null | undefined
): number | null {
  const real = realText.trim() === "" ? Number.NaN : parseSignedAmount(realText)
  return Number.isFinite(real) && typeof calculated === "number"
    ? roundCents(real - calculated)
    : null
}

/**
 * La diferencia es grande: supera el monto o el porcentaje del saldo
 * calculado de SITE.reconciliation, y vale avisar antes de crear el ajuste
 */
export function isLargeDifference(
  difference: number | null,
  calculated: number | null | undefined
): boolean {
  if (difference === null || typeof calculated !== "number") {
    return false
  }
  const size = Math.abs(difference)
  return (
    size > 0 &&
    (size > SITE.reconciliation.warnAmount ||
      size > (Math.abs(calculated) * SITE.reconciliation.warnPercent) / 100)
  )
}

/** Tono de la diferencia: sube en verde, baja en rojo, cero o nada neutro */
export function differenceTone(difference: number | null): Tone {
  if (difference === null || difference === 0) {
    return "neutral"
  }
  return difference > 0 ? "success" : "danger"
}

/** Texto del saldo calculado: calculando, no disponible o el monto */
export function calculatedLabel(
  calculated: number | null | undefined,
  currency: string
): string {
  if (calculated === undefined) {
    return "Calculando..."
  }
  if (calculated === null) {
    return "No disponible"
  }
  return formatCurrency(calculated, currency, 2)
}
