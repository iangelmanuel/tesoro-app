import "server-only"
import { occurrenceDescription } from "@/features/recurring-expenses/occurrences"
import { nextUnpaidOccurrence } from "@/features/recurring-expenses/payment"
import { getRecurringExpenseOccurrences } from "@/features/recurring-expenses/queries"
import { getIncomeSources } from "@/features/recurring-incomes/queries"
import { incomeReceiptDescription } from "@/features/recurring-incomes/receipt"
import { monthRange, shiftMonth } from "@/libs/dates"
import { createClient } from "@/libs/supabase/server"
import { getEditableTransaction } from "./queries"
import { NOT_FOUND } from "./transaction-errors"
import type { RecurringOccurrenceLink, TransactionInitialValues } from "./types"

// Valores para duplicar un movimiento (SPEC 49). Solo lectura: RLS limita las
// filas al dueño.

/** Error genérico al preparar un duplicado */
export const DUPLICATE_ERROR =
  "No se pudo preparar el duplicado. Intenta de nuevo"
const NO_PENDING_OCCURRENCE =
  "Este gasto fijo no tiene periodos pendientes de pago"

// Cuánto hacia adelante se buscan ocurrencias sin pagar: cubre el siguiente
// periodo de un gasto anual aunque ya esté pagado el de después
const DUPLICATE_HORIZON_MONTHS = 24

const NO_OPEN_INCOME_PERIOD =
  "Este ingreso fijo no tiene periodos pendientes de cobro"

/**
 * Cobro de ingreso fijo: el duplicado lleva el mismo ingreso fijo y la BD lo
 * reparte con la regla de SPEC 38 (periodo abierto más antiguo). Sin periodo
 * abierto, o si el ingreso fijo ya no está activo, no se duplica. "Sin fecha
 * fija" no tiene periodos: se enlaza tal cual
 */
async function incomeDuplicate(
  workspaceId: string,
  recurringIncomeId: string,
  initialValues: TransactionInitialValues
) {
  const sources = await getIncomeSources(workspaceId)
  const source = sources.find((option) => option.id === recurringIncomeId)

  if (!source) {
    return { error: NO_OPEN_INCOME_PERIOD }
  }

  const values = { ...initialValues, recurring_income_id: source.id }
  if (source.frequency === "none") {
    return { initialValues: values }
  }
  if (!source.periods.some((period) => period.due > 0)) {
    return { error: NO_OPEN_INCOME_PERIOD }
  }

  // La descripción nombra el periodo que se cubre, no el del original
  return {
    initialValues: {
      ...values,
      description: incomeReceiptDescription(source)
    }
  }
}

async function nextRecurringOccurrence(
  supabase: Awaited<ReturnType<typeof createClient>>,
  transactionId: string,
  recurringExpenseId: string
) {
  const { data, error } = await supabase
    .from("transactions")
    .select("recurring_due_on")
    .eq("id", transactionId)
    .single()

  if (error || !data.recurring_due_on) {
    throw new Error(DUPLICATE_ERROR)
  }

  const afterDueOn = data.recurring_due_on
  const occurrences = await getRecurringExpenseOccurrences(
    recurringExpenseId,
    afterDueOn,
    monthRange(shiftMonth(afterDueOn.slice(0, 7), DUPLICATE_HORIZON_MONTHS)).to
  )
  return nextUnpaidOccurrence(occurrences, recurringExpenseId, afterDueOn)
}

/**
 * Valores del duplicado de un movimiento suelto o de un pago de fijo (SPEC
 * 49). Copia tipo, monto, categoría, cuenta, descripción, nota y contraparte.
 * Sin fecha (el diálogo pone hoy), hora, factura ni posición del día. La
 * cuenta y la categoría archivadas quedan vacías. Solo lectura: RLS limita
 * las filas al dueño. Lanza si falla una consulta; la action responde con
 * DUPLICATE_ERROR.
 */
export async function getTransactionDuplicate(
  workspaceId: string,
  transactionId: string
): Promise<
  | {
      initialValues: TransactionInitialValues
      recurring?: RecurringOccurrenceLink
    }
  | { error: string }
> {
  const original = await getEditableTransaction(workspaceId, transactionId)
  if (!original) {
    return { error: NOT_FOUND }
  }

  const supabase = await createClient()
  const [category, account] = await Promise.all([
    supabase
      .from("categories")
      .select("id")
      .eq("id", original.category_id)
      .is("archived_at", null)
      .maybeSingle(),
    original.account_id
      ? supabase
          .from("accounts")
          .select("id")
          .eq("id", original.account_id)
          .eq("workspace_id", workspaceId)
          .is("archived_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ])
  if (category.error || account.error) {
    return { error: DUPLICATE_ERROR }
  }

  const initialValues: TransactionInitialValues = {
    type: original.type,
    amount: original.amount,
    category_id: category.data?.id,
    account_id: account.data?.id ?? null,
    description: original.description,
    note: original.note ?? "",
    counterparty: original.counterparty
  }

  if (original.recurring_income_id !== null) {
    return incomeDuplicate(
      workspaceId,
      original.recurring_income_id,
      initialValues
    )
  }

  if (original.recurring_expense_id === null) {
    return { initialValues }
  }

  // Pago de gasto fijo: el duplicado paga la primera ocurrencia sin pagar
  // posterior a la del original, nunca la misma
  const next = await nextRecurringOccurrence(
    supabase,
    original.id,
    original.recurring_expense_id
  )
  if (!next) {
    return { error: NO_PENDING_OCCURRENCE }
  }

  return {
    // La descripción nombra el periodo que se paga, no el del original
    initialValues: {
      ...initialValues,
      description: occurrenceDescription(next)
    },
    recurring: {
      recurringExpenseId: next.recurringExpenseId,
      dueOn: next.dueOn
    }
  }
}
