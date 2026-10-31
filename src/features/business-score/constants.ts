import type { Curve } from "@/features/score/curves"
import type { BusinessFactorKey, BusinessRuleKey } from "./types"

/**
 * Claves de regla de Empresa; deben estar en el check de
 * dismissed_recommendations. irregular_records se comparte con Personal.
 */
export const BUSINESS_RULE_KEYS = [
  "loss_month",
  "negative_account",
  "low_liquidity",
  "sales_drop",
  "low_margin",
  "cost_growth",
  "client_concentration",
  "cost_concentration",
  "missing_accounts",
  "irregular_records"
] as const satisfies readonly BusinessRuleKey[]

export const BUSINESS_FACTORS: Record<
  BusinessFactorKey,
  { label: string; weight: number; curve: Curve }
> = {
  net_margin: {
    label: "Margen neto",
    weight: 30,
    curve: [
      [0, 0],
      [0.2, 100]
    ]
  },
  liquidity: {
    label: "Liquidez",
    weight: 25,
    curve: [
      [0, 0],
      [3, 100]
    ]
  },
  sales_growth: {
    label: "Crecimiento de ventas",
    weight: 15,
    curve: [
      [-0.2, 0],
      [0, 50],
      [0.2, 100]
    ]
  },
  profitable_months: {
    label: "Meses con utilidad",
    weight: 15,
    curve: [
      [0, 0],
      [1, 100]
    ]
  },
  cost_concentration: {
    label: "Concentración de costos",
    weight: 10,
    curve: [
      [0.3, 100],
      [0.7, 0]
    ]
  },
  regularity: {
    label: "Regularidad",
    weight: 5,
    curve: [
      [0, 0],
      [1, 100]
    ]
  }
}

/** Orden en que se muestran los factores */
export const BUSINESS_FACTOR_KEYS = Object.keys(
  BUSINESS_FACTORS
) as BusinessFactorKey[]

/** Etiquetas de los factores, para los componentes de score */
export const BUSINESS_FACTOR_LABELS = Object.fromEntries(
  BUSINESS_FACTOR_KEYS.map((key) => [key, BUSINESS_FACTORS[key].label])
) as Record<BusinessFactorKey, string>

export const BUSINESS_EXCLUDED_REASONS = {
  noClosedMonths: "Aún no hay meses cerrados",
  noClosedCosts: "Sin costos en los meses cerrados",
  fewClosedMonths: "Necesita 6 meses cerrados",
  noPreviousSales: "Sin ventas en el trimestre previo",
  noWindowCosts: "Sin costos en los últimos 3 meses"
} as const

export const BUSINESS_INSUFFICIENT_REASONS = {
  noSales: "Registra tus ventas"
} as const

/** Meses de cada trimestre del crecimiento de ventas */
export const QUARTER_MONTHS = 3

/** Meses cerrados que exige el crecimiento: trimestre reciente + previo */
export const GROWTH_CLOSED_MONTHS = QUARTER_MONTHS * 2

/** Meses cerrados que mira "Meses con utilidad" */
export const PROFITABLE_CLOSED_MONTHS = 6

// Umbrales de las reglas de recomendación
export const LOW_LIQUIDITY_MONTHS = 1
export const SALES_DROP_RATIO = 0.8
export const SALES_DROP_BASE_MONTHS = 3
export const LOW_MARGIN_RATIO = 0.1
export const COST_GROWTH_RATIO = 1.3
export const COST_GROWTH_MIN_SHARE = 0.05
export const COST_GROWTH_BASE_MONTHS = 3
export const CLIENT_CONCENTRATION_RATIO = 0.5
export const COST_CONCENTRATION_RATIO = 0.5
export const MISSING_ACCOUNTS_RATIO = 0.3
