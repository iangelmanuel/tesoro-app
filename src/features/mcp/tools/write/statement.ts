import { z } from "zod"
import { SITE } from "@/config/site"
import { transferSchema } from "@/features/accounts/schemas"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import { normalizeText } from "@/features/imports/detect"
import { createTransactionSchema } from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import type { McpContext } from "../../types"
import {
  type McpWorkspace,
  type MissingField,
  type StatementPreview,
  dateSchema
} from "../shared"
import { type RowError, timeInputSchema, zodRowErrors } from "./batch"
import {
  type CategoryOption,
  type RefOption,
  accountNameSchema,
  categoryNameSchema,
  resolveAccount,
  resolveCategory
} from "./references"
import { categoryErrors } from "./transaction-input"

// Análisis de un extracto bancario (SPEC 43): valida las filas, busca
// duplicados probables, sugiere categorías y concilia el saldo. No escribe:
// import_statement lo usa en el dry run y antes de importar.

/** Días de diferencia para un duplicado probable */
const DUPLICATE_WINDOW_DAYS = 2
/** Historial para sugerir categoría */
const SUGGESTION_WINDOW_DAYS = 180
const PAGE_SIZE = 1000

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

export type StatementRowInput = z.infer<typeof statementRowSchema>

export const statementRowsSchema = z
  .array(statementRowSchema)
  .min(1, { error: "Envía al menos una fila." })
  .max(SITE.mcp.statementLimit, {
    error: `Máximo ${SITE.mcp.statementLimit} filas por extracto. Pártelo en varias llamadas.`
  })

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

export interface StatementAnalysis {
  rows: StatementRow[]
  /** Filas que se importan: las no duplicadas más las de include_rows */
  toImport: number[]
  preview: StatementPreview
}

// Placeholder para validar el resto de la fila mientras falta un dato
const PLACEHOLDER_ID = "11111111-1111-4111-8111-111111111111"

const FIELD_NAMES: Record<string, string> = {
  occurred_on: "date",
  occurred_time: "time",
  from_account_id: "transfer_account_id",
  to_account_id: "transfer_account_id"
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string) {
  return (
    Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) /
    86_400_000
  )
}

const cents = (value: number) => Math.round(value * 100)

function signed(row: Pick<StatementRow, "direction" | "amount">) {
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

interface ParseResult {
  rows: StatementRow[]
  errors: RowError[]
  missing: MissingField[]
}

/** Interpreta y valida cada fila con los esquemas de la UI */
async function parseRows(
  ctx: McpContext,
  workspace: McpWorkspace,
  accountId: string,
  input: StatementRowInput[],
  accounts: RefOption[],
  categories: CategoryOption[]
): Promise<ParseResult> {
  const rows: StatementRow[] = []
  const errors: RowError[] = []
  const missing: MissingField[] = []
  const activeIds = new Set(accounts.map((account) => account.id))
  const explicitCategories: {
    index: number
    categoryId: string
    type: string
  }[] = []

  input.forEach((raw, index) => {
    const direction: "in" | "out" = raw.type
      ? raw.type === "income"
        ? "in"
        : "out"
      : raw.amount > 0
        ? "in"
        : "out"
    const amount = Math.abs(raw.amount)
    const isTransfer =
      raw.transfer_account_id !== undefined ||
      raw.transfer_account !== undefined
    const kind: StatementKind = isTransfer
      ? "transfer"
      : direction === "in"
        ? "income"
        : "expense"

    let transferAccountId: string | null = null
    let categoryId: string | null = null

    if (isTransfer) {
      const resolved = resolveAccount(accounts, {
        id: raw.transfer_account_id,
        name: raw.transfer_account,
        field: "transfer_account_id",
        row: index,
        label:
          direction === "out"
            ? "la cuenta de destino del traspaso"
            : "la cuenta de origen del traspaso",
        nullable: false
      })
      if ("missing" in resolved) {
        missing.push(resolved.missing)
      } else {
        transferAccountId = resolved.value
        if (transferAccountId && !activeIds.has(transferAccountId)) {
          errors.push({
            index,
            field: "transfer_account_id",
            message: "Elige una cuenta válida"
          })
        }
      }
    } else if (raw.category_id !== undefined || raw.category !== undefined) {
      const resolved = resolveCategory(categories, {
        id: raw.category_id,
        name: raw.category,
        type: kind,
        row: index
      })
      if ("missing" in resolved) {
        missing.push(resolved.missing)
      } else {
        categoryId = resolved.value
        if (categoryId && raw.category_id !== undefined) {
          explicitCategories.push({ index, categoryId, type: kind })
        }
      }
    }

    const row: StatementRow = {
      index,
      kind,
      direction,
      amount,
      date: raw.date,
      time: raw.time ?? null,
      description: raw.description.trim(),
      note: raw.note?.trim() || null,
      categoryId,
      transferAccountId
    }

    // El resto de la fila, con las reglas de la UI
    const parsed = isTransfer
      ? transferSchema.safeParse({
          from_account_id:
            direction === "out"
              ? accountId
              : (transferAccountId ?? PLACEHOLDER_ID),
          to_account_id:
            direction === "out"
              ? (transferAccountId ?? PLACEHOLDER_ID)
              : accountId,
          amount,
          occurred_on: row.date,
          occurred_time: row.time ?? "",
          // Un traspaso no tiene descripción: va en la nota
          note: row.note ?? row.description
        })
      : createTransactionSchema.safeParse({
          type: kind,
          amount,
          occurred_on: row.date,
          occurred_time: row.time ?? "",
          category_id: categoryId ?? PLACEHOLDER_ID,
          description: row.description,
          note: row.note ?? "",
          account_id: accountId,
          counterparty: "",
          invoice_ref: "",
          recurring_income_id: "",
          recurring_expense_id: "",
          recurring_due_on: "",
          transfer_from: "",
          transfer_amount: ""
        })
    if (!parsed.success) {
      errors.push(
        ...zodRowErrors(index, parsed.error).map((error) => ({
          ...error,
          field: error.field
            ? (FIELD_NAMES[error.field] ?? error.field)
            : undefined
        }))
      )
    }
    rows.push(row)
  })

  errors.push(
    ...(await categoryErrors(
      ctx,
      workspace.type,
      explicitCategories.map((row) => ({
        index: row.index,
        categoryId: row.categoryId,
        type: row.type
      }))
    ))
  )

  return { rows, errors, missing }
}

/**
 * Categoría del movimiento más reciente (últimos 180 días) con la misma
 * descripción normalizada y el mismo tipo, si sigue activa.
 */
async function suggestCategories(
  ctx: McpContext,
  workspaceId: string,
  rows: StatementRow[],
  categories: CategoryOption[]
) {
  const pending = rows.filter(
    (row) => row.kind !== "transfer" && row.categoryId === null
  )
  const suggestions = new Map<number, string>()
  if (pending.length === 0) {
    return suggestions
  }

  const wanted = new Set(
    pending.map((row) => `${row.kind}|${normalizeText(row.description)}`)
  )
  const active = new Set(categories.map((category) => category.id))
  const latest = new Map<string, string>()
  const since = addDays(todayISO(), -SUGGESTION_WINDOW_DAYS)

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await ctx.supabase
      .from("transactions")
      .select("type, description, category_id")
      .eq("workspace_id", workspaceId)
      .gte("occurred_on", since)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error || data.length === 0) {
      break
    }
    for (const tx of data) {
      const key = `${tx.type}|${normalizeText(tx.description)}`
      if (wanted.has(key) && !latest.has(key) && active.has(tx.category_id)) {
        latest.set(key, tx.category_id)
      }
    }
    if (data.length < PAGE_SIZE || latest.size === wanted.size) {
      break
    }
  }

  for (const row of pending) {
    const category = latest.get(`${row.kind}|${normalizeText(row.description)}`)
    if (category) {
      suggestions.set(row.index, category)
    }
  }
  return suggestions
}

interface Existing {
  id: string
  kind: StatementKind
  direction: "in" | "out"
  amount: number
  date: string
}

/** Movimientos y traspasos de la cuenta alrededor de las fechas del extracto */
async function loadExisting(
  ctx: McpContext,
  workspaceId: string,
  accountId: string,
  rows: StatementRow[]
): Promise<Existing[] | null> {
  const dates = rows.map((row) => row.date).sort()
  const from = addDays(dates[0], -DUPLICATE_WINDOW_DAYS)
  const to = addDays(dates[dates.length - 1], DUPLICATE_WINDOW_DAYS)
  const existing: Existing[] = []

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await ctx.supabase
      .from("transactions")
      .select("id, type, amount, occurred_on")
      .eq("workspace_id", workspaceId)
      .eq("account_id", accountId)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("id")
      .range(start, start + PAGE_SIZE - 1)
    if (error) {
      return null
    }
    for (const tx of data) {
      existing.push({
        id: tx.id,
        kind: tx.type,
        direction: tx.type === "income" ? "in" : "out",
        amount: Number(tx.amount),
        date: tx.occurred_on
      })
    }
    if (data.length < PAGE_SIZE) {
      break
    }
  }

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await ctx.supabase
      .from("transfers")
      .select("id, amount, occurred_on, from_account_id")
      .eq("workspace_id", workspaceId)
      .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("id")
      .range(start, start + PAGE_SIZE - 1)
    if (error) {
      return null
    }
    for (const transfer of data) {
      existing.push({
        id: transfer.id,
        kind: "transfer",
        direction: transfer.from_account_id === accountId ? "out" : "in",
        amount: Number(transfer.amount),
        date: transfer.occurred_on
      })
    }
    if (data.length < PAGE_SIZE) {
      break
    }
  }

  return existing
}

/**
 * Duplicado probable: misma cuenta, mismo tipo (y sentido), mismo monto y
 * fecha a ±2 días, contra lo registrado o contra una fila anterior del
 * mismo extracto (la primera de dos iguales queda lista).
 */
function findDuplicates(rows: StatementRow[], existing: Existing[]) {
  const duplicates: StatementPreview["duplicates"] = []
  for (const row of rows) {
    const near = (date: string) =>
      daysBetween(date, row.date) <= DUPLICATE_WINDOW_DAYS
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

export type AnalyzeResult =
  { errors: RowError[] } | { failure: string } | StatementAnalysis

/** Todo el análisis del extracto, sin escribir */
export async function analyzeStatement(
  ctx: McpContext,
  workspace: McpWorkspace,
  {
    accountId,
    rows: input,
    accounts,
    categories,
    includeRows,
    statementBalance,
    statementEndDate
  }: {
    accountId: string
    rows: StatementRowInput[]
    accounts: RefOption[]
    categories: CategoryOption[]
    includeRows: number[]
    statementBalance?: number
    statementEndDate?: string
  }
): Promise<AnalyzeResult> {
  const parsed = await parseRows(
    ctx,
    workspace,
    accountId,
    input,
    accounts,
    categories
  )
  if (parsed.errors.length > 0) {
    return { errors: parsed.errors.sort((a, b) => a.index - b.index) }
  }
  const { rows } = parsed
  const missing = [...parsed.missing]

  // Categoría sugerida para las filas sin categoría; sin sugerencia, se pregunta
  const suggested = await suggestCategories(ctx, workspace.id, rows, categories)
  for (const row of rows) {
    if (row.kind === "transfer" || row.categoryId !== null) {
      continue
    }
    const category = suggested.get(row.index)
    if (category) {
      row.categoryId = category
    } else if (!missing.some((item) => item.row === row.index)) {
      const resolved = resolveCategory(categories, {
        id: undefined,
        name: undefined,
        type: row.kind,
        row: row.index
      })
      if ("missing" in resolved) {
        missing.push(resolved.missing)
      }
    }
  }

  const existing = await loadExisting(ctx, workspace.id, accountId, rows)
  if (!existing) {
    return { failure: "No se pudieron revisar los movimientos de la cuenta." }
  }
  const duplicates = findDuplicates(rows, existing)

  const included = new Set(includeRows)
  const omitted = new Set(
    duplicates.filter((item) => !included.has(item.row)).map((item) => item.row)
  )
  const asked = new Set(missing.map((item) => item.row))
  const toImport = rows
    .map((row) => row.index)
    .filter((index) => !omitted.has(index))
  const ready = toImport.filter((index) => !asked.has(index))

  const preview: StatementPreview = {
    status: "preview",
    ready,
    duplicates,
    // No se pregunta por filas que no se van a importar
    needsInput: missing
      .filter((item) => item.row === undefined || !omitted.has(item.row))
      .sort((a, b) => (a.row ?? 0) - (b.row ?? 0)),
    suggestions: [...suggested].map(([row, category_id]) => ({
      row,
      category_id
    }))
  }

  if (statementBalance !== undefined) {
    const endDate =
      statementEndDate ??
      rows
        .map((row) => row.date)
        .sort()
        .at(-1) ??
      todayISO()
    const { data, error } = await ctx.supabase.rpc("account_balance_at", {
      p_account_id: accountId,
      p_on: endDate
    })
    if (error) {
      return { failure: "No se pudo calcular el saldo de la cuenta." }
    }
    const before = Number(data)
    const net = rows
      .filter((row) => toImport.includes(row.index) && row.date <= endDate)
      .reduce((sum, row) => sum + signed(row), 0)
    const after = Math.round((before + net) * 100) / 100
    preview.reconciliation = {
      end_date: endDate,
      before,
      after,
      statement: statementBalance,
      difference: Math.round((statementBalance - after) * 100) / 100,
      difference_before: Math.round((statementBalance - before) * 100) / 100
    }
  }

  return { rows, toImport, preview }
}
