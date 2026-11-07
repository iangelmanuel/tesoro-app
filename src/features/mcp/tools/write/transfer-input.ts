import { z } from "zod"
import type { TransferRow } from "@/features/accounts/transfer-service"
import { dateSchema, formatTime } from "../shared"
import { timeInputSchema } from "./batch"

// Forma de un traspaso en las tools de escritura (SPEC 34). Se valida con
// transferSchema de la UI (src/features/accounts/schemas.ts).

export const transferFields = {
  from_account_id: z
    .uuid({ error: "Elige la cuenta de origen" })
    .describe("Cuenta de origen (de list_accounts)."),
  to_account_id: z
    .uuid({ error: "Elige la cuenta de destino" })
    .describe("Cuenta de destino, distinta a la de origen."),
  amount: z.number().describe("Monto positivo, con hasta 2 decimales."),
  occurred_on: dateSchema.describe("Fecha YYYY-MM-DD. Puede ser futura."),
  time: timeInputSchema.describe("Hora HH:MM, o null sin hora."),
  note: z.string().nullable().describe("Nota opcional.")
}

export interface TransferValues {
  from_account_id: string
  to_account_id: string
  amount: number
  occurred_on: string
  time: string | null
  note: string | null
}

export function toTransferInput(values: TransferValues) {
  return {
    from_account_id: values.from_account_id,
    to_account_id: values.to_account_id,
    amount: values.amount,
    occurred_on: values.occurred_on,
    occurred_time: values.time ?? "",
    note: values.note ?? ""
  }
}

export function transferValuesOf(row: TransferRow): TransferValues {
  return {
    from_account_id: row.from_account_id,
    to_account_id: row.to_account_id,
    amount: Number(row.amount),
    occurred_on: row.occurred_on,
    time: formatTime(row.occurred_time),
    note: row.note
  }
}

export function transferPreview(values: TransferValues) {
  return { ...values, note: values.note?.trim() || null }
}
