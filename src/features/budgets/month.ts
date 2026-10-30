import { format } from "date-fns"
import { es } from "date-fns/locale"
import { z } from "zod"
import { currentMonth, shiftMonth } from "@/libs/dates"

export const monthParamSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Elige un mes válido" })

export interface BudgetMonth {
  /** Mes elegido (YYYY-MM) */
  month: string
  /** "octubre 2026" */
  label: string
  /** Mes anterior y siguiente (YYYY-MM) */
  prev: string
  next: string
}

/** Primer día del mes YYYY-MM, como lo guarda `budgets.month` */
export function monthStart(month: string) {
  return `${month}-01`
}

/**
 * `?month` de la tab Presupuestos. Un valor inválido cae al mes actual en
 * America/Bogota. Llamar después de leer la sesión: usa new Date().
 */
export function parseBudgetMonth(
  value: string | string[] | undefined,
  now = new Date()
): BudgetMonth {
  const parsed = monthParamSchema.safeParse(
    Array.isArray(value) ? value[0] : value
  )
  const month = parsed.success ? parsed.data : currentMonth(now)
  const [year, monthIndex] = month.split("-").map(Number)

  return {
    month,
    label: format(new Date(year, monthIndex - 1, 1), "MMMM yyyy", {
      locale: es
    }),
    prev: shiftMonth(month, -1),
    next: shiftMonth(month, 1)
  }
}
