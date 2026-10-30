import type { Band, FactorKey, RuleKey, Severity } from "./types"

/** Claves de regla; deben coincidir con el check de dismissed_recommendations */
export const RULE_KEYS = [
  "deficit",
  "category_growth",
  "budget_exceeded",
  "goal_at_risk",
  "high_utilization",
  "highest_rate_first",
  "overdue_payment",
  "low_cushion",
  "unbudgeted_spending",
  "irregular_records"
] as const satisfies readonly RuleKey[]

/** Puntos [dato, puntos] de una curva, con el dato en orden ascendente */
export type Curve = readonly (readonly [number, number])[]

export const FACTORS: Record<
  FactorKey,
  { label: string; weight: number; curve: Curve }
> = {
  savings_rate: {
    label: "Tasa de ahorro",
    weight: 25,
    curve: [
      [0, 0],
      [0.2, 100]
    ]
  },
  debt_to_income: {
    label: "Deuda / ingresos",
    weight: 20,
    curve: [
      [0.15, 100],
      [0.5, 0]
    ]
  },
  emergency_cushion: {
    label: "Colchón",
    weight: 15,
    curve: [
      [0, 0],
      [6, 100]
    ]
  },
  budgets: {
    label: "Presupuestos",
    weight: 15,
    curve: [
      [0, 0],
      [1, 100]
    ]
  },
  card_utilization: {
    label: "Utilización de tarjetas",
    weight: 10,
    curve: [
      [0.1, 100],
      [0.3, 75],
      [0.7, 25],
      [1, 0]
    ]
  },
  goals: {
    label: "Metas",
    weight: 10,
    curve: [
      [0, 0],
      [1, 100]
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
export const FACTOR_KEYS = Object.keys(FACTORS) as FactorKey[]

export const EXCLUDED_REASONS = {
  noClosedMonths: "Aún no hay meses cerrados",
  noClosedExpense: "Sin gastos en los meses cerrados",
  noBudgets: "Sin presupuestos en el mes",
  noCards: "Sin tarjetas de crédito",
  noGoals: "Sin metas con fecha objetivo"
} as const

export const MIN_HISTORY_DAYS = 30

export const INSUFFICIENT_REASONS = {
  noIncome: "Registra tus ingresos",
  missingDays: (days: number) =>
    `Necesitamos ${MIN_HISTORY_DAYS} días de registros (faltan ${days} ${days === 1 ? "día" : "días"})`
} as const

/** Meses de la ventana móvil, incluido `M` */
export const WINDOW_MONTHS = 3

/** Meses cerrados para el gasto promedio */
export const CLOSED_MONTHS = 3

export const HISTORY_MONTHS = 12

export type BandTone = "danger" | "warning" | "info" | "success"

/** Bandas por puntaje mínimo, de mayor a menor */
export const BANDS: readonly {
  band: Band
  min: number
  label: string
  tone: BandTone
}[] = [
  { band: "excellent", min: 80, label: "Excelente", tone: "success" },
  { band: "good", min: 60, label: "Bueno", tone: "info" },
  { band: "fair", min: 40, label: "Regular", tone: "warning" },
  { band: "weak", min: 0, label: "Débil", tone: "danger" }
]

export const SEVERITY_ORDER: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja"
}

// Umbrales de las reglas de recomendación
export const CATEGORY_GROWTH_RATIO = 1.3
export const CATEGORY_GROWTH_MIN_SHARE = 0.05
export const CATEGORY_GROWTH_BASE_MONTHS = 3
export const BUDGET_EXCEEDED_RATIO = 1
export const HIGH_UTILIZATION_RATIO = 0.7
export const TARGET_UTILIZATION_RATIO = 0.3
export const LOW_CUSHION_MONTHS = 3
export const UNBUDGETED_MIN_CATEGORIES = 2
export const IRREGULAR_RATIO = 0.5

/** Recomendaciones que van a la tarjeta del Resumen */
export const SUMMARY_RECOMMENDATIONS = 3
