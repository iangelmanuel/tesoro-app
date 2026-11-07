import { z } from "zod"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import { validateCategory } from "@/features/transactions/service"
import type { WorkspaceType } from "@/features/workspaces/queries"
import type { McpContext } from "../../types"
import { dateSchema } from "../shared"
import { type RowError, timeInputSchema } from "./batch"

// Forma de un movimiento en las tools de escritura (SPEC 34). Se traduce a
// la entrada de los esquemas de la UI (src/features/transactions/schemas.ts)
// para validar con las mismas reglas.

export const transactionFields = {
  type: z
    .enum(TRANSACTION_TYPES)
    .describe("income (ingreso) o expense (gasto)."),
  amount: z.number().describe("Monto positivo, con hasta 2 decimales."),
  category_id: z
    .uuid({ error: "Elige una categoría" })
    .describe("Categoría del mismo tipo (de list_categories)."),
  account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .nullable()
    .describe("Cuenta (de list_accounts), o null fuera de las cuentas."),
  occurred_on: dateSchema.describe("Fecha YYYY-MM-DD."),
  time: timeInputSchema.describe("Hora HH:MM, o null sin hora."),
  description: z.string().describe("Descripción (1–120 caracteres)."),
  note: z.string().nullable().describe("Nota opcional (hasta 500).")
}

/** Movimiento completo en la forma de la UI (strings vacíos = sin valor) */
export interface TransactionValues {
  type: string
  amount: number
  category_id: string
  account_id: string | null
  occurred_on: string
  time: string | null
  description: string
  note: string | null
  counterparty: string | null
  invoice_ref: string | null
}

export function toFormInput(values: TransactionValues) {
  return {
    type: values.type,
    amount: values.amount,
    occurred_on: values.occurred_on,
    occurred_time: values.time ?? "",
    category_id: values.category_id,
    description: values.description,
    note: values.note ?? "",
    account_id: values.account_id ?? "",
    counterparty: values.counterparty ?? "",
    invoice_ref: values.invoice_ref ?? "",
    recurring_income_id: ""
  }
}

/** Lo que ve el agente en el antes y después de un dry_run */
export function previewOf(values: TransactionValues) {
  return {
    type: values.type,
    amount: values.amount,
    category_id: values.category_id,
    account_id: values.account_id,
    occurred_on: values.occurred_on,
    time: values.time,
    description: values.description.trim(),
    note: values.note?.trim() || null
  }
}

/**
 * Valida la categoría de cada fila (tipo, scope y archivada) con la misma
 * función que la UI, una vez por combinación distinta.
 */
export async function categoryErrors(
  ctx: McpContext,
  scope: WorkspaceType,
  rows: {
    index: number
    categoryId: string
    type: string
    currentCategoryId?: string
  }[]
): Promise<RowError[]> {
  const cache = new Map<string, Promise<string | null>>()
  const errors = await Promise.all(
    rows.map(async (row) => {
      const key = `${row.categoryId}|${row.type}|${row.currentCategoryId ?? ""}`
      if (!cache.has(key)) {
        cache.set(
          key,
          validateCategory(
            ctx.supabase,
            row.categoryId,
            row.type,
            scope,
            row.currentCategoryId
          )
        )
      }
      const message = await cache.get(key)
      return message
        ? [{ index: row.index, field: "category_id", message }]
        : []
    })
  )
  return errors.flat()
}
