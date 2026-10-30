import { currentMonth, monthRange, shiftMonth, todayISO } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import type { Database } from "@/types/database"
import { type OccurrenceStatus, getOccurrenceStatus } from "./occurrences"

type RecurringExpenseRow =
  Database["public"]["Tables"]["recurring_expenses"]["Row"]
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"]

type CategorySummary = Pick<
  CategoryRow,
  "id" | "name" | "icon" | "color" | "archived_at"
>

export type RecurringExpense = Omit<RecurringExpenseRow, "amount"> & {
  amount: number
  category: CategorySummary
}

export interface UpcomingPayment {
  recurringExpenseId: string
  name: string
  amount: number
  category: CategorySummary
  dueOn: string
  transactionId: string | null
  paidAmount: number | null
  status: OccurrenceStatus
}

// Meses anteriores al actual cuyas ocurrencias impagas siguen en la lista
const OVERDUE_MONTHS = 2

const CATEGORY_COLUMNS = "id, name, icon, color, archived_at"

export async function getRecurringExpenses(
  workspaceId: string
): Promise<RecurringExpense[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select(`*, category:categories!inner (${CATEGORY_COLUMNS})`)
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true })

  if (error) {
    throw new Error("No se pudieron cargar los gastos fijos")
  }

  return data.map((row) => ({ ...row, amount: Number(row.amount) }))
}

// Todas las ocurrencias del mes actual y las impagas de los 2 meses
// anteriores, en orden de vencimiento (las vencidas quedan primero)
export async function getUpcomingPayments(
  workspaceId: string
): Promise<UpcomingPayment[]> {
  const month = currentMonth()
  const today = todayISO()
  const monthStart = monthRange(month).from
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("recurring_occurrences", {
    p_workspace_id: workspaceId,
    p_from: monthRange(shiftMonth(month, -OVERDUE_MONTHS)).from,
    p_to: monthRange(month).to
  })

  if (error) {
    throw new Error("No se pudieron cargar los próximos pagos")
  }

  const occurrences = data.filter(
    (row) => row.due_on >= monthStart || row.transaction_id === null
  )
  if (occurrences.length === 0) {
    return []
  }

  const categoryIds = [...new Set(occurrences.map((row) => row.category_id))]
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .in("id", categoryIds)

  if (categoriesError) {
    throw new Error("No se pudieron cargar los próximos pagos")
  }

  const categoryById = new Map(categories.map((row) => [row.id, row]))

  return occurrences.flatMap((row) => {
    const category = categoryById.get(row.category_id)
    if (!category) {
      return []
    }
    return {
      recurringExpenseId: row.recurring_expense_id,
      name: row.name,
      amount: Number(row.amount),
      category,
      dueOn: row.due_on,
      transactionId: row.transaction_id,
      paidAmount: row.paid_amount === null ? null : Number(row.paid_amount),
      status: getOccurrenceStatus(row, today)
    }
  })
}
