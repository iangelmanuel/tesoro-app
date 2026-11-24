"use server"

import { z } from "zod"
import type {
  RecurringOccurrenceLink,
  TransactionInitialValues
} from "./components/transaction-dialog"
import { DUPLICATE_ERROR, getTransactionDuplicate } from "./duplicate-queries"
import { NOT_FOUND } from "./transaction-errors"

const idSchema = z.uuid()

// Valores para duplicar un movimiento suelto o un pago de fijo (SPEC 49).
// Solo lectura: RLS limita las filas al dueño.
export async function loadTransactionDuplicate(
  workspaceId: string,
  transactionId: string
): Promise<
  | {
      initialValues: TransactionInitialValues
      recurring?: RecurringOccurrenceLink
    }
  | { error: string }
> {
  const parsedWorkspace = idSchema.safeParse(workspaceId)
  const parsedId = idSchema.safeParse(transactionId)

  if (!parsedWorkspace.success || !parsedId.success) {
    return { error: NOT_FOUND }
  }

  try {
    return await getTransactionDuplicate(parsedWorkspace.data, parsedId.data)
  } catch {
    return { error: DUPLICATE_ERROR }
  }
}
