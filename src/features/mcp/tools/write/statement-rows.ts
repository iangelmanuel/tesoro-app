import { z } from "zod"
import { SITE } from "@/config/site"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import { roundCents } from "@/libs/money"
import { type StatementPreview, dateSchema } from "../shared"
import { timeInputSchema } from "./batch"
import { accountNameSchema, categoryNameSchema } from "./references"

// Filas de un extracto bancario (SPEC 43): su esquema, cómo se interpreta
// cada una, los duplicados probables y la conciliación del saldo. Lógica
// pura: las lecturas están en statement-queries.ts.

/** Días de diferencia para un duplicado probable */
export const DUPLICATE_WINDOW_DAYS = 2
/** Historial para sugerir categoría */
export const SUGGESTION_WINDOW_DAYS = 180

/** Una fila del extracto, como la envía el agente */
export const statementRowSchema = z.object({
  date: dateSchema.describe("Fecha del movimiento, YYYY-MM-DD."),
  time: timeInputSchema.optional().describe("Hora HH:MM, opcional."),
  description: z
    .string()
    .describe("Descripción tal como sale en el extracto (1–120 caracteres)."),
  amount: z
    .number()
    .refine((value) => value !== 0, { error: "El monto no puede ser 0." })
    .describe(
      "Monto: negativo sale de la cuenta (gasto) y positivo entra (ingreso). Con type se usa su valor absoluto."
    ),
  type: z
    .enum(TRANSACTION_TYPES)
    .optional()
    .describe("income o expense, si el monto viene sin signo."),
  category_id: z
    .uuid({ error: "Elige una categoría" })
    .optional()
    .describe(
      "Categoría del mismo tipo. Sin ella se usa la sugerida por el historial."
    ),
  category: categoryNameSchema.optional(),
  note: z.string().nullable().optional().describe("Nota opcional (hasta 500)."),
  transfer_account_id: z
    .uuid({ error: "Elige una cuenta válida" })
    .optional()
    .describe(
      "Solo si la fila es un traspaso entre cuentas propias: la otra cuenta. Destino si el monto sale; origen si entra."
    ),
  transfer_account: accountNameSchema
    .optional()
    .describe("Nombre de la otra cuenta del traspaso, si no tienes el id.")
})

/** Fila del extracto de entrada */
export type StatementRowInput = z.infer<typeof statementRowSchema>

/** Las filas del extracto, con el tope por llamada */
export const statementRowsSchema = z
  .array(statementRowSchema)
  .min(1, { error: "Envía al menos una fila." })
  .max(SITE.mcp.statementLimit, {
    error: `Máximo ${SITE.mcp.statementLimit} filas por extracto. Pártelo en varias llamadas.`
  })

/** Tipo de movimiento de una fila */
export type StatementKind = "income" | "expense" | "transfer"

/** Una fila del extracto ya interpretada */
export interface StatementRow {
  index: number
  kind: StatementKind
  /** in = entra a la cuenta del extracto; out = sale */
  direction: "in" | "out"
  amount: number
  date: string
  time: string | null
  description: string
  note: string | null
  /** Explícita, por nombre o sugerida; null en traspasos o si falta */
  categoryId: string | null
  transferAccountId: string | null
}

// Placeholder para validar el resto de la fila mientras falta un dato
export const PLACEHOLDER_ID = "11111111-1111-4111-8111-111111111111"

/** Campos de los esquemas de la UI → campos de la fila */
export const FIELD_NAMES: Record<string, string> = {
  occurred_on: "date",
  occurred_time: "time",
  from_account_id: "transfer_account_id",
  to_account_id: "transfer_account_id"
}

/** Días entre dos fechas YYYY-MM-DD, sin importar el orden */
function daysApart(a: string, b: string) {
  return (
    Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
    86_400_000
  )
}

const cents = (value: number) => Math.round(value * 100)

/** Monto con signo según el sentido */
export function signed(row: Pick<StatementRow, "direction" | "amount">) {
  return row.direction === "in" ? row.amount : -row.amount
}

/** Mismo tipo, sentido y monto (para duplicados) */
function sameKey(
  a: Pick<StatementRow, "kind" | "direction" | "amount">,
  b: Pick<StatementRow, "kind" | "direction" | "amount">
) {
  return (
    a.kind === b.kind &&
    a.direction === b.direction &&
    cents(a.amount) === cents(b.amount)
  )
}

/**
 * Sentido, tipo y monto de una fila: con `type` manda él y el monto va en
 * absoluto; sin él, el signo. Con otra cuenta es un traspaso.
 */
export function interpretRow(
  raw: Pick<
    StatementRowInput,
    "amount" | "type" | "transfer_account_id" | "transfer_account"
  >
) {
  const direction: "in" | "out" = raw.type
    ? raw.type === "income"
      ? "in"
      : "out"
    : raw.amount > 0
      ? "in"
      : "out"
  const isTransfer =
    raw.transfer_account_id !== undefined || raw.transfer_account !== undefined
  const kind: StatementKind = isTransfer
    ? "transfer"
    : direction === "in"
      ? "income"
      : "expense"
  return { direction, kind, amount: Math.abs(raw.amount), isTransfer }
}

/** Movimiento o traspaso registrado de la cuenta del extracto */
export interface Existing {
  id: string
  kind: StatementKind
  direction: "in" | "out"
  amount: number
  date: string
}

/**
 * Duplicado probable: misma cuenta, mismo tipo (y sentido), mismo monto y
 * fecha a ±2 días, contra lo registrado o contra una fila anterior del
 * mismo extracto (la primera de dos iguales queda lista).
 */
export function findDuplicates(rows: StatementRow[], existing: Existing[]) {
  const duplicates: StatementPreview["duplicates"] = []
  for (const row of rows) {
    const near = (date: string) =>
      daysApart(date, row.date) <= DUPLICATE_WINDOW_DAYS
    const matches = [
      ...existing
        .filter((item) => sameKey(item, row) && near(item.date))
        .map((item) => item.id),
      ...rows
        .filter(
          (other) =>
            other.index < row.index && sameKey(other, row) && near(other.date)
        )
        .map((other) => `row:${other.index}`)
    ]
    if (matches.length > 0) {
      duplicates.push({ row: row.index, matches })
    }
  }
  return duplicates
}

/**
 * Filas que se importan (las no duplicadas más las de `includeRows`) y las
 * que ya están listas (sin preguntas pendientes)
 */
export function selectRows(
  rows: Pick<StatementRow, "index">[],
  duplicates: StatementPreview["duplicates"],
  includeRows: number[],
  askedRows: (number | undefined)[]
) {
  const included = new Set(includeRows)
  const omitted = new Set(
    duplicates.filter((item) => !included.has(item.row)).map((item) => item.row)
  )
  const asked = new Set(askedRows)
  const toImport = rows
    .map((row) => row.index)
    .filter((index) => !omitted.has(index))
  const ready = toImport.filter((index) => !asked.has(index))
  return { omitted, toImport, ready }
}

/**
 * Saldo de la cuenta al cierre del extracto antes y después de importar, y
 * su diferencia con el saldo del extracto
 */
export function reconcile(
  rows: StatementRow[],
  toImport: number[],
  {
    endDate,
    before,
    statementBalance
  }: { endDate: string; before: number; statementBalance: number }
): NonNullable<StatementPreview["reconciliation"]> {
  const net = rows
    .filter((row) => toImport.includes(row.index) && row.date <= endDate)
    .reduce((sum, row) => sum + signed(row), 0)
  const after = roundCents(before + net)
  return {
    end_date: endDate,
    before,
    after,
    statement: statementBalance,
    difference: roundCents(statementBalance - after),
    difference_before: roundCents(statementBalance - before)
  }
}

/** Resultado del análisis de un extracto */
export interface StatementAnalysis {
  rows: StatementRow[]
  /** Filas que se importan: las no duplicadas más las de include_rows */
  toImport: number[]
  preview: StatementPreview
}
