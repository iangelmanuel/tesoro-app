import { transferSchema } from "@/features/accounts/schemas"
import { createTransactionSchema } from "@/features/transactions/schemas"
import { todayISO } from "@/libs/dates"
import type { McpContext } from "../../types"
import type { McpWorkspace, MissingField, StatementPreview } from "../shared"
import { type RowError, zodRowErrors } from "./batch"
import {
  type CategoryOption,
  type RefOption,
  resolveAccount,
  resolveCategory
} from "./references"
import { loadExisting, suggestCategories } from "./statement-queries"
import {
  FIELD_NAMES,
  PLACEHOLDER_ID,
  type StatementAnalysis,
  type StatementRow,
  type StatementRowInput,
  findDuplicates,
  interpretRow,
  reconcile,
  selectRows
} from "./statement-rows"
import { categoryErrors } from "./transaction-input"

// Análisis de un extracto bancario (SPEC 43): valida las filas, busca
// duplicados probables, sugiere categorías y concilia el saldo. No escribe:
// import_statement lo usa en el dry run y antes de importar.

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
    const { direction, kind, amount, isTransfer } = interpretRow(raw)

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

/** Errores de fila, una falla de lectura o el análisis */
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

  const { omitted, toImport, ready } = selectRows(
    rows,
    duplicates,
    includeRows,
    missing.map((item) => item.row)
  )

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
    preview.reconciliation = reconcile(rows, toImport, {
      endDate,
      before: Number(data),
      statementBalance
    })
  }

  return { rows, toImport, preview }
}
