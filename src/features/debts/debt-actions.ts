"use server"

import { z } from "zod"
import { getPersonalWorkspace } from "@/features/workspaces/queries"
import { revalidatePersonalPages } from "@/features/workspaces/revalidate"
import { readFormValues } from "@/libs/form-data"
import { createClient } from "@/libs/supabase/server"
import { findDebt, idSchema } from "./debt-lookup"
import { DEBT_KINDS, type DebtKind } from "./debt-schemas"
import { DEBT_NOT_FOUND } from "./errors"
import {
  type ReceivableSchedule,
  receivableScheduleSchema
} from "./receivable-schemas"
import {
  type DebtRowStatus,
  createDebtRecord,
  debtFieldsFor,
  markDebtPaidRecord,
  parseDebtInput,
  transitionDebtRecord,
  updateDebtRecord
} from "./service"
import type { DebtActionResult, DebtFormState } from "./types"

// Crear, editar y cambiar el estado de una deuda o cuenta por cobrar

const kindSchema = z.enum(DEBT_KINDS)

// Valida con el esquema del tipo (y, en una cuenta por cobrar, del tipo de
// cobro) más la cuenta por defecto
function readDebtForm(
  formData: FormData,
  kind: DebtKind,
  schedule: ReceivableSchedule | null
) {
  const values = {
    ...readFormValues(formData, [
      ...debtFieldsFor(kind, schedule),
      "account_id"
    ]),
    kind,
    ...(schedule ? { schedule } : {})
  }
  return { values, parsed: parseDebtInput(kind, schedule, values) }
}

export async function createDebt(
  _prevState: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const kind = kindSchema.safeParse(formData.get("kind"))

  if (!kind.success) {
    return { fieldErrors: { kind: ["Elige el tipo de deuda"] } }
  }

  // El tipo de cobro solo aplica a cuentas por cobrar; sin él, cobro único
  let schedule: ReceivableSchedule | null = null
  if (kind.data === "receivable") {
    const parsedSchedule = receivableScheduleSchema.safeParse(
      formData.get("schedule") ?? "once"
    )
    if (!parsedSchedule.success) {
      return { fieldErrors: { schedule: ["Elige el tipo de cobro"] } }
    }
    schedule = parsedSchedule.data
  }

  const { values, parsed } = readDebtForm(formData, kind.data, schedule)

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors, values }
  }

  const workspace = await getPersonalWorkspace()
  const result = await createDebtRecord(
    await createClient(),
    workspace,
    kind.data,
    parsed.data
  )

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

export async function updateDebt(
  _prevState: DebtFormState,
  formData: FormData
): Promise<DebtFormState> {
  const id = idSchema.safeParse(formData.get("id"))

  if (!id.success) {
    return { error: DEBT_NOT_FOUND }
  }

  const debt = await findDebt(id.data)
  if (!debt) {
    return { error: DEBT_NOT_FOUND }
  }

  // El tipo y el tipo de cobro no cambian: se valida con el esquema de los
  // guardados
  const { values, parsed } = readDebtForm(formData, debt.kind, debt.schedule)

  if (!parsed.success) {
    return { fieldErrors: parsed.fieldErrors, values }
  }

  const result = await updateDebtRecord(await createClient(), debt, parsed.data)

  if (!result.ok) {
    return { error: result.error, fieldErrors: result.fieldErrors, values }
  }

  revalidatePersonalPages()
  return { ok: true }
}

// Cambia el estado solo si la deuda está en uno de los estados `from`
async function transitionDebt(
  id: string,
  from: DebtRowStatus[],
  to: DebtRowStatus
): Promise<DebtActionResult> {
  const workspace = await getPersonalWorkspace()
  const result = await transitionDebtRecord(
    await createClient(),
    workspace,
    id,
    from,
    to
  )

  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePersonalPages()
  return {}
}

export async function markDebtPaid(id: string): Promise<DebtActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: DEBT_NOT_FOUND }
  }

  const debt = await findDebt(parsedId.data)
  if (!debt) {
    return { error: DEBT_NOT_FOUND }
  }

  const result = await markDebtPaidRecord(
    await createClient(),
    { id: debt.workspace_id },
    debt
  )
  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePersonalPages()
  return {}
}

export async function archiveDebt(id: string): Promise<DebtActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: DEBT_NOT_FOUND }
  }
  return transitionDebt(parsedId.data, ["active", "paid"], "archived")
}

export async function reactivateDebt(id: string): Promise<DebtActionResult> {
  const parsedId = idSchema.safeParse(id)

  if (!parsedId.success) {
    return { error: DEBT_NOT_FOUND }
  }
  return transitionDebt(parsedId.data, ["paid", "archived"], "active")
}
