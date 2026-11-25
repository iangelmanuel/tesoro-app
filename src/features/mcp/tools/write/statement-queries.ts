import { normalizeText } from "@/features/imports/detect"
import { addDays, todayISO } from "@/libs/dates"
import type { McpContext } from "../../types"
import type { CategoryOption } from "./references"
import {
  DUPLICATE_WINDOW_DAYS,
  type Existing,
  SUGGESTION_WINDOW_DAYS,
  type StatementRow
} from "./statement-rows"

// Lecturas del análisis de un extracto (SPEC 43): historial para sugerir
// categorías y lo registrado en la cuenta para los duplicados. Paginan de
// 1000 en 1000, el tope de filas por respuesta de Supabase.

const PAGE_SIZE = 1000

/**
 * Categoría del movimiento más reciente (últimos 180 días) con la misma
 * descripción normalizada y el mismo tipo, si sigue activa.
 */
export async function suggestCategories(
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

/** Movimientos y traspasos de la cuenta alrededor de las fechas del extracto */
export async function loadExisting(
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
