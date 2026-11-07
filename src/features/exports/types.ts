export const EXPORT_FORMATS = ["xlsx", "csv"] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

/** Meses que puede cubrir un archivo, contando el primero y el último */
export const MAX_EXPORT_MONTHS = 36

export interface ExportRange {
  /** YYYY-MM, inclusivo */
  from: string
  /** YYYY-MM, inclusivo, nunca después del mes actual */
  to: string
  /** ["2026-01", "2026-02", ...] */
  months: string[]
}

export type ExportMovementKind =
  "Ingreso" | "Gasto" | "Traspaso" | "Venta" | "Costo o gasto"

/** Fila común de la hoja Movimientos y del CSV */
export interface ExportMovementRow {
  /** YYYY-MM */
  month: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time: string | null
  kind: ExportMovementKind
  description: string
  category: string | null
  account: string | null
  /** Solo traspasos */
  destination: string | null
  note: string | null
  /** Siempre positivo; el signo lo da `kind` */
  amount: number
  /** Empresa */
  counterparty?: string | null
  /** Empresa */
  invoiceRef?: string | null
}

export interface ExportAccountRow {
  name: string
  opening: number
  inflow: number
  outflow: number
  closing: number
}

/** Todo lo que necesita una hoja de mes de Personal */
export interface PersonalMonthData {
  month: string
  summary: {
    income: number
    expense: number
    openingBalance: number
    closingBalance: number
  }
  accounts: ExportAccountRow[]
  recurringIncomes: {
    name: string
    dueOn: string | null
    category: string
    account: string | null
    expected: number
    received: number
    status: string
  }[]
  recurringExpenses: {
    name: string
    dueOn: string
    category: string
    amount: number
    paid: number
    status: string
  }[]
  budgets: { category: string; limit: number; spent: number }[]
  goals: {
    name: string
    contributed: number
    savedAtClose: number
    target: number
  }[]
  debts: {
    name: string
    kind: string
    payments: number
    charges: number
    balanceAtClose: number
  }[]
  receivables: {
    name: string
    expected: number
    collected: number
    pendingAtClose: number
    status: string
  }[]
  movements: ExportMovementRow[]
}

/** Todo lo que necesita una hoja de mes de Empresa */
export interface BusinessMonthData {
  month: string
  summary: {
    sales: number
    costs: number
    openingBalance: number
    closingBalance: number
  }
  accounts: ExportAccountRow[]
  costsByCategory: { category: string; total: number }[]
  sales: ExportMovementRow[]
  costs: ExportMovementRow[]
  transfers: ExportMovementRow[]
}
