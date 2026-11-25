import { z } from "zod"
import type { TransferInput } from "@/features/accounts/schemas"
import type { TransferRow } from "@/features/accounts/transfer-service"
import { trimSeconds } from "@/libs/dates"
import { dateSchema } from "../shared"
import { type RowError, type accountErrors, timeInputSchema } from "./batch"

// Forma de un traspaso en las tools de escritura (SPEC 34). Se valida con
// transferSchema de la UI (src/features/accounts/schemas.ts).

/** Campos de un traspaso en las tools */
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

/** Un traspaso con los nombres de las tools */
export interface TransferValues {
  from_account_id: string
  to_account_id: string
  amount: number
  occurred_on: string
  time: string | null
  note: string | null
}

/** Valores del formulario de traspaso (transferSchema) */
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

/** Un traspaso guardado como valores de las tools */
export function transferValuesOf(row: TransferRow): TransferValues {
  return {
    from_account_id: row.from_account_id,
    to_account_id: row.to_account_id,
    amount: Number(row.amount),
    occurred_on: row.occurred_on,
    time: trimSeconds(row.occurred_time),
    note: row.note
  }
}

/** Traspaso de la vista previa del dry_run */
export function transferPreview(values: TransferValues) {
  return { ...values, note: values.note?.trim() || null }
}

/** "1 traspaso creado", "3 traspasos borrados" */
export function transfersLabel(count: number, verb: string) {
  return `${count} ${count === 1 ? "traspaso" : "traspasos"} ${verb}${count === 1 ? "" : "s"}`
}

/** Cuentas de origen y destino de las filas válidas */
export function transferAccountChecks(
  rows: { index: number; data: TransferInput }[]
): Parameters<typeof accountErrors>[2] {
  return rows.flatMap(({ index, data }) => [
    { index, accountId: data.from_account_id, field: "from_account_id" },
    { index, accountId: data.to_account_id, field: "to_account_id" }
  ])
}

/** Errores de fila en el orden de las filas */
export function sortRowErrors(errors: RowError[]) {
  return errors.sort((a, b) => a.index - b.index)
}

/** El traspaso guardado con los campos enviados encima */
export function applyTransferPatch(
  before: TransferValues,
  patch: Partial<TransferValues>
): TransferValues {
  return {
    ...before,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    )
  }
}
