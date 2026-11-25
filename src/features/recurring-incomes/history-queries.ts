import "server-only"
import { todayISO } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import {
  type RecurringIncomeHistory,
  buildIncomeHistory
} from "./income-history"

/**
 * Ocurrencias de un ingreso fijo para su Sheet (SPEC 38): desde `starts_on`
 * hasta hoy más la próxima, la más reciente primero, con lo recibido y los
 * movimientos que cubren cada una. "Sin fecha fija" no tiene ocurrencias.
 */
export async function getRecurringIncomeHistory(
  recurringIncomeId: string,
  options: { limit: number }
): Promise<RecurringIncomeHistory> {
  const supabase = await createClient()
  const [{ data: income, error }, { data: allocations, error: allocError }] =
    await Promise.all([
      supabase
        .from("recurring_incomes")
        .select(
          "amount, frequency, day_of_month, second_day_of_month, month_of_year, day_of_week, interval_days, starts_on, ends_on"
        )
        .eq("id", recurringIncomeId)
        .maybeSingle(),
      supabase
        .from("recurring_income_allocations")
        .select(
          "due_on, amount, transaction:transactions (id, occurred_on, description, day_position, created_at)"
        )
        .eq("recurring_income_id", recurringIncomeId)
        .order("created_at", { ascending: true })
    ])

  if (error || allocError) {
    throw new Error("No se pudo cargar el historial del ingreso fijo")
  }
  if (!income || income.frequency === "none") {
    return {
      occurrences: [],
      hasMore: false,
      receivedThisYear: 0,
      dueToDate: 0
    }
  }

  return buildIncomeHistory(
    { ...income, amount: Number(income.amount) },
    allocations,
    todayISO(),
    options.limit
  )
}
