import { z } from "zod"
import { getCounterpartyTotals } from "@/features/business-score/queries"
import { TRANSACTION_TYPES } from "@/features/categories/constants"
import { getCategoryTotals } from "@/features/reports/queries"
import { currentMonth, monthRange, todayISO } from "@/libs/dates"
import { toolError, toolResult } from "../result"
import {
  dateSchema,
  defineTool,
  resolveWorkspace,
  workspaceIdSchema
} from "../shared"

// Totales por categoría y por contraparte en un rango, contra el periodo
// anterior del mismo largo (SPEC 43). Mismas RPC que Reportes
// (category_totals) y que el score de Empresa (counterparty_totals).

const MAX_DAYS = 366 * 3
const DAY_MS = 86_400_000

const round1 = (value: number) => Math.round(value * 10) / 10
const round2 = (value: number) => Math.round(value * 100) / 100

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`)
const toDate = (time: number) => new Date(time).toISOString().slice(0, 10)

const input = z.object({
  workspace_id: workspaceIdSchema,
  from: dateSchema
    .optional()
    .describe("Primer día YYYY-MM-DD. Por defecto el 1 del mes actual."),
  to: dateSchema.optional().describe("Último día YYYY-MM-DD. Por defecto hoy."),
  type: z
    .enum(TRANSACTION_TYPES)
    .default("expense")
    .describe("expense (gastos, por defecto) o income (ingresos)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Máximo de filas por lista (por defecto 20).")
})

/** Solo las filas con contraparte (en Personal no hay) */
async function counterpartyTotals(
  ...args: Parameters<typeof getCounterpartyTotals>
) {
  return (await getCounterpartyTotals(...args)).filter(
    (row) => row.counterparty
  )
}

/** Filas con su total anterior y el cambio % */
function compare<T extends { total: number; txCount: number }>(
  current: T[],
  previous: T[],
  key: (row: T) => string,
  limit: number
) {
  const total = current.reduce((sum, row) => sum + row.total, 0)
  const before = new Map(previous.map((row) => [key(row), row.total]))
  return current.slice(0, limit).map((row) => {
    const prior = before.get(key(row)) ?? 0
    return {
      key: key(row),
      total: round2(row.total),
      share_percent: total === 0 ? 0 : round1((row.total / total) * 100),
      transaction_count: row.txCount,
      previous_total: round2(prior),
      change_percent:
        prior === 0 ? null : round1(((row.total - prior) / prior) * 100)
    }
  })
}

export const getSpendingBreakdown = defineTool({
  name: "get_spending_breakdown",
  group: "read",
  title: "Desglose de gastos",
  description:
    "Totales por categoría y por contraparte (cliente o proveedor, en Empresa) de un rango de fechas, comparados con el periodo anterior del mismo largo: total, participación %, total anterior y cambio %. Mismos totales por categoría que Reportes. Sirve para ver en qué se va el dinero y qué subió.",
  input,
  annotations: { readOnlyHint: true },
  async run(ctx, args) {
    const workspace = await resolveWorkspace(ctx, args.workspace_id)
    if ("error" in workspace) {
      return toolError(workspace.error)
    }

    const from = args.from ?? monthRange(currentMonth()).from
    const to = args.to ?? todayISO()
    const days = (toTime(to) - toTime(from)) / DAY_MS + 1
    if (days < 1) {
      return toolError(
        "La fecha de inicio (from) debe ser anterior o igual a to."
      )
    }
    if (days > MAX_DAYS) {
      return toolError("El rango puede tener hasta 3 años.")
    }
    const previousTo = toDate(toTime(from) - DAY_MS)
    const previousFrom = toDate(toTime(from) - days * DAY_MS)

    const [
      categories,
      previousCategories,
      counterparties,
      previousCounterparties
    ] = await Promise.all([
      getCategoryTotals(workspace.id, from, to, args.type),
      getCategoryTotals(workspace.id, previousFrom, previousTo, args.type),
      counterpartyTotals(workspace.id, from, to, args.type),
      counterpartyTotals(workspace.id, previousFrom, previousTo, args.type)
    ])

    const names = new Map(categories.map((row) => [row.categoryId, row.name]))
    const total = categories.reduce((sum, row) => sum + row.total, 0)
    const previousTotal = previousCategories.reduce(
      (sum, row) => sum + row.total,
      0
    )

    return toolResult(
      `${args.type === "expense" ? "Gastos" : "Ingresos"} de ${workspace.name} del ${from} al ${to}: ${round2(total)} (periodo anterior: ${round2(previousTotal)}).`,
      {
        workspace_id: workspace.id,
        type: args.type,
        from,
        to,
        previous_from: previousFrom,
        previous_to: previousTo,
        total: round2(total),
        previous_total: round2(previousTotal),
        change_percent:
          previousTotal === 0
            ? null
            : round1(((total - previousTotal) / previousTotal) * 100),
        categories: compare(
          categories,
          previousCategories,
          (row) => row.categoryId,
          args.limit
        ).map(({ key, ...row }) => ({
          category_id: key,
          name: names.get(key) ?? "",
          ...row
        })),
        counterparties: compare(
          counterparties,
          previousCounterparties,
          (row) => row.counterparty,
          args.limit
        ).map(({ key, ...row }) => ({ counterparty: key, ...row })),
        currency: ctx.currency
      }
    )
  }
})
