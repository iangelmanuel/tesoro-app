import type {
  FactorResult,
  Recommendation,
  ScoreResult
} from "@/features/score/types"

export type BusinessFactorKey =
  | "net_margin"
  | "liquidity"
  | "sales_growth"
  | "profitable_months"
  | "cost_concentration"
  | "regularity"

export type BusinessRuleKey =
  | "loss_month"
  | "negative_account"
  | "low_liquidity"
  | "sales_drop"
  | "low_margin"
  | "cost_growth"
  | "client_concentration"
  | "cost_concentration"
  | "missing_accounts"
  | "irregular_records"

// Mismas formas que Personal (SPEC 07) con las claves de Empresa
export type BusinessFactorResult = FactorResult<BusinessFactorKey>
export type BusinessScoreResult = ScoreResult<BusinessFactorKey>
export type BusinessRecommendation = Recommendation<BusinessRuleKey>

/** Totales de un mes, con el mes como YYYY-MM */
export interface BusinessMonthlyInput {
  month: string
  /** Ventas: movimientos de ingreso, con o sin cuenta */
  sales: number
  /** Costos y gastos: movimientos de gasto, con o sin cuenta */
  costs: number
  /** Saldo de las cuentas activas al fin del mes */
  accountsBalance: number
}

/** Costo de una categoría en un mes (YYYY-MM) */
export interface CategoryCost {
  month: string
  categoryId: string
  name: string
  total: number
}

/**
 * Insumos ya consultados. `months` cubre al menos los 6 meses anteriores al
 * primer mes que se calcula; `categoryCosts`, los meses de su ventana.
 */
export interface BusinessScoreInputs {
  today: string
  firstTransactionOn: string | null
  months: BusinessMonthlyInput[]
  categoryCosts: CategoryCost[]
  activeWeeks: Set<string>
}
