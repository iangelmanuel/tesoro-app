import { z } from "zod"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import { currentMonth, monthRange } from "@/libs/dates"

export const PAGE_SIZE = 20

export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export interface TransactionFilters {
  /** YYYY-MM o "all" */
  month: string
  type?: TransactionType
  categoryId?: string
  q?: string
  page: number
}

export type SearchParams = Record<string, string | string[] | undefined>

const monthSchema = z.union([
  z.literal("all"),
  z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
])
const typeSchema = z.enum(TRANSACTION_TYPES)
const categorySchema = z.uuid()
const pageSchema = z.coerce.number().int().min(1)

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

// Un valor inválido se trata como ausente, nunca rompe la página
export function parseTransactionFilters(
  searchParams: SearchParams
): TransactionFilters {
  const month = monthSchema.safeParse(first(searchParams.month))
  const type = typeSchema.safeParse(first(searchParams.type))
  const category = categorySchema.safeParse(first(searchParams.category))
  const page = pageSchema.safeParse(first(searchParams.page))
  const q = first(searchParams.q)?.trim().slice(0, 100)

  return {
    month: month.success ? month.data : currentMonth(),
    type: type.success ? type.data : undefined,
    categoryId: category.success ? category.data : undefined,
    q: q || undefined,
    page: page.success ? page.data : 1
  }
}

/** Rango de fechas del filtro de mes, o null si es "all" */
export function filtersDateRange(filters: TransactionFilters) {
  return filters.month === "all" ? null : monthRange(filters.month)
}

// Query string de los filtros. El mes actual es el valor por defecto, pero
// se escribe siempre para que el enlace no cambie de significado otro mes.
export function buildFiltersQuery(
  filters: TransactionFilters,
  overrides: Partial<TransactionFilters> = {}
) {
  const next = { ...filters, ...overrides }
  const params = new URLSearchParams()

  params.set("month", next.month)
  if (next.type) params.set("type", next.type)
  if (next.categoryId) params.set("category", next.categoryId)
  if (next.q) params.set("q", next.q)
  if (next.page > 1) params.set("page", String(next.page))

  return params.toString()
}

/** Escapa `\`, `%` y `_` para usar el texto dentro de un patrón ilike */
export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}
