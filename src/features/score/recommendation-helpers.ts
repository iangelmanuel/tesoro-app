// Piezas puras que comparten las recomendaciones de Personal (SPEC 07) y de
// Empresa (SPEC 11): umbrales, formatos, orden, ocultas y las reglas que son
// iguales en los dos espacios. `score` es la feature dueña; `business-score`
// importa.
import type { Route } from "next"
import { isNegativeAccount } from "@/features/accounts/negative-balance"
import type { AccountWithBalance } from "@/features/accounts/types"
import { monthName } from "@/features/recurring-expenses/occurrences"
import { shiftMonth } from "@/libs/dates"
import { formatCurrency } from "@/libs/format"
import { IRREGULAR_RATIO, SEVERITY_ORDER } from "./constants"
import type { Recommendation } from "./types"

/**
 * Tolerancia de los umbrales por razón, para que 1.300.000 / 1.000.000 cuente
 * como 130 %
 */
export const RATIO_EPSILON = 1e-9

/** "septiembre", desde un mes YYYY-MM */
export function formatMonthName(month: string) {
  return monthName(Number(month.slice(5, 7)))
}

/**
 * ¿Hay al menos `count` meses completos antes de `month` (YYYY-MM)? El
 * primer movimiento tiene que caer el día 1 del primero de ellos o antes.
 */
export function hasFullMonthsBefore(
  firstTransactionOn: string | null,
  month: string,
  count: number
) {
  return (
    firstTransactionOn !== null &&
    firstTransactionOn <= `${shiftMonth(month, -count)}-01`
  )
}

/**
 * Crecimiento inusual de una categoría (`category_growth`, `cost_growth`):
 * el total llega al `ratio` de su promedio y la diferencia, a `minShare` del
 * promedio mensual del espacio
 */
export function isUnusualGrowth(
  total: number,
  average: number,
  monthlyAverage: number,
  thresholds: { ratio: number; minShare: number }
) {
  return (
    average > 0 &&
    total / average >= thresholds.ratio - RATIO_EPSILON &&
    total - average >= monthlyAverage * thresholds.minShare - RATIO_EPSILON
  )
}

/** Severidad (alta, media, baja) y luego monto descendente */
export function compareRecommendations<R extends string>(
  a: Recommendation<R>,
  b: Recommendation<R>
) {
  const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  return bySeverity !== 0 ? bySeverity : b.amount - a.amount
}

/**
 * Regla `irregular_records`, igual en los dos espacios: semanas con
 * movimientos < 50 % de las de la ventana. Quien llama ya comprobó que el mes
 * tiene datos suficientes; `href` es Movimientos del espacio.
 */
export function irregularRecordsRecommendation(
  counts: { active: number; total: number },
  href: Route
): Recommendation<"irregular_records">[] {
  const { active, total } = counts
  if (total === 0 || active / total >= IRREGULAR_RATIO) return []

  return [
    {
      rule: "irregular_records",
      entityKey: "workspace",
      severity: "low",
      title: "Registra tus movimientos con más frecuencia",
      evidence: `Registraste movimientos en ${active} de ${total} semanas`,
      amount: 0,
      href,
      linkLabel: "Ir a Movimientos"
    }
  ]
}

/**
 * Regla `negative_account` (SPEC 21), igual en los dos espacios: una
 * billetera o un banco activo con saldo a hoy < 0. `href` es Cuentas del
 * espacio y `currency`, su moneda.
 */
export function negativeAccountRecommendations(
  accounts: AccountWithBalance[],
  href: Route,
  currency?: string
): Recommendation<"negative_account">[] {
  return accounts.flatMap((account) => {
    if (!isNegativeAccount(account)) return []

    return {
      rule: "negative_account",
      entityKey: account.id,
      severity: "high",
      title: `La cuenta ${account.name} está en negativo`,
      evidence: `${account.name} tiene saldo de −${formatCurrency(Math.abs(account.balance), currency)}`,
      amount: Math.abs(account.balance),
      href,
      linkLabel: "Ir a Cuentas"
    }
  })
}

/**
 * Separa las recomendaciones activas de las ocultas este mes. Una fila
 * oculta cuya condición ya no se cumple no aparece en ninguna lista.
 */
export function splitDismissed<R extends string>(
  recommendations: Recommendation<R>[],
  dismissed: { rule: string; entityKey: string }[]
) {
  const keys = new Set(dismissed.map((row) => `${row.rule}|${row.entityKey}`))
  const isHidden = (item: Recommendation<R>) =>
    keys.has(`${item.rule}|${item.entityKey}`)

  return {
    active: recommendations.filter((item) => !isHidden(item)),
    hidden: recommendations.filter(isHidden)
  }
}
