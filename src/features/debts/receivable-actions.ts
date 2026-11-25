"use server"

import { z } from "zod"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { todayISO } from "@/libs/dates"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { findDebt, findEntry, idSchema } from "./debt-lookup"
import {
  DEBT_NOT_ACTIVE,
  ENTRY_NOT_FOUND,
  RECEIVABLE_NOT_FOUND
} from "./errors"
import { getDebtEntries, getDebtEntry, getDebts } from "./queries"
import {
  type CollectableReceivable,
  lastCoveredPeriod,
  nextPendingInstallment,
  toCollectableReceivable
} from "./receivable-collect"
import { receivableCollectSchema } from "./receivable-schemas"
import { recordReceivableCollection } from "./receivable-service"
import type { PaymentFormState } from "./types"

// Cobros de una cuenta por cobrar (SPEC 39) y Duplicar un cobro (SPEC 49)

const COLLECT_FIELDS = [
  "mode",
  "amount",
  "period_on",
  "occurred_on",
  "note",
  "description",
  "create_transaction",
  "account_id"
] as const

// Cobro de una cuenta por cobrar (SPEC 39): Abono o Pago completo en una de
// cobro único, Una cuota o Varios meses en una mensual. Lo usan el tab Me
// deben del diálogo de movimiento y el Sheet de la cuenta por cobrar.
export async function collectReceivable(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const values = readFormValues(formData, COLLECT_FIELDS)
  const debtId = idSchema.safeParse(formData.get("debt_id"))

  if (!debtId.success) {
    return { fieldErrors: { debt_id: [RECEIVABLE_NOT_FOUND] }, values }
  }

  const parsed = receivableCollectSchema.safeParse(values)
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values }
  }

  const debt = await findDebt(debtId.data)
  if (!debt) {
    return { fieldErrors: { debt_id: [RECEIVABLE_NOT_FOUND] }, values }
  }

  const result = await recordReceivableCollection(
    await createClient(),
    debt,
    parsed.data
  )
  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

const NO_PENDING_INSTALLMENT =
  "Esta cuenta por cobrar no tiene cuotas pendientes"

/**
 * Duplicar el cobro de un Me deben mensual desde Movimientos (SPEC 49): la
 * cuenta por cobrar con sus cuotas y la cuota pendiente siguiente a la última
 * que cubrió el original. Solo lectura: RLS limita las filas al dueño.
 */
export async function loadReceivableDuplicate(
  entryId: string
): Promise<
  { receivable: CollectableReceivable; periodOn: string } | { error: string }
> {
  const id = idSchema.safeParse(entryId)
  if (!id.success) {
    return { error: ENTRY_NOT_FOUND }
  }

  try {
    const [loaded, entry] = await Promise.all([
      findEntry(id.data),
      getDebtEntry(id.data)
    ])
    if (!loaded || !entry) {
      return { error: ENTRY_NOT_FOUND }
    }
    if (loaded.debt.status !== "active") {
      return { error: DEBT_NOT_ACTIVE }
    }

    const [debts, entries] = await Promise.all([
      getDebts(loaded.debt.workspace_id),
      getDebtEntries(loaded.debt.id)
    ])
    const debt = debts.find((option) => option.id === loaded.debt.id)
    if (!debt || debt.kind !== "receivable" || debt.schedule !== "monthly") {
      return { error: ENTRY_NOT_FOUND }
    }

    const receivable = toCollectableReceivable(debt, entries, todayISO())
    const next = nextPendingInstallment(receivable, lastCoveredPeriod(entry))
    return next
      ? { receivable, periodOn: next.period_on }
      : { error: NO_PENDING_INSTALLMENT }
  } catch {
    return { error: "No se pudo cargar el cobro. Intenta de nuevo" }
  }
}
