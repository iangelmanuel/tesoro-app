import { describe, expect, it } from "vitest"
import { upcomingIncomeFixture } from "@/testing/fixtures"
import { groupIncomeRows } from "./month-rows"
import type { IncomeOccurrenceStatus } from "./occurrences"

// Tests de caracterización (SPEC 55b): fijan las filas del mes de Ingresos
// fijos antes del refactor de la feature

const TODAY = "2026-06-15"

function statusOf(dueOn: string, received: number): IncomeOccurrenceStatus {
  if (received >= 20_000) return "received"
  if (received > 0) return "partial"
  if (dueOn < TODAY) return "overdue"
  return dueOn === TODAY ? "today" : "pending"
}

/** Propina diaria de 20.000 */
function daily(dueOn: string, receivedAmount: number) {
  return upcomingIncomeFixture({
    recurringIncomeId: "tips",
    name: "Propinas",
    frequency: "daily",
    amount: 20_000,
    dueOn,
    receivedAmount,
    remaining: Math.max(20_000 - receivedAmount, 0),
    status: statusOf(dueOn, receivedAmount)
  })
}

const INCOMES = [
  daily("2026-05-31", 0),
  upcomingIncomeFixture({
    recurringIncomeId: "salary",
    name: "Salario",
    frequency: "biweekly",
    amount: 2_000_000,
    dueOn: "2026-06-01",
    receivedAmount: 2_000_000,
    remaining: 0,
    status: "received"
  }),
  daily("2026-06-14", 20_000),
  daily("2026-06-15", 5_000),
  daily("2026-06-16", 0)
]

describe("groupIncomeRows", () => {
  it("resume diaria y cada N días en una fila por fuente", () => {
    const rows = groupIncomeRows(INCOMES, "2026-06", TODAY)
    expect(rows.map((row) => row.kind)).toEqual(["summary", "occurrence"])

    const [summary] = rows
    if (summary.kind !== "summary") throw new Error("se esperaba un resumen")
    const { first, ...rest } = summary
    expect(first.dueOn).toBe("2026-05-31")
    expect(rest).toMatchInlineSnapshot(`
      {
        "carriedCount": 1,
        "expected": 60000,
        "kind": "summary",
        "monthCount": 3,
        "receiveDueOn": "2026-06-15",
        "received": 25000,
        "receivedCount": 1,
        "recurringIncomeId": "tips",
        "remaining": 55000,
        "status": "overdue",
      }
    `)
  })

  it("todas recibidas: fila recibida y sin monto por recibir", () => {
    const [summary] = groupIncomeRows(
      [daily("2026-06-14", 20_000), daily("2026-06-15", 20_000)],
      "2026-06",
      TODAY
    )
    expect(summary).toMatchObject({ status: "received", receiveDueOn: null })
  })

  it("solo futuras: Recibir apunta a la primera abierta", () => {
    const [summary] = groupIncomeRows(
      [daily("2026-06-16", 0), daily("2026-06-17", 0)],
      "2026-06",
      TODAY
    )
    expect(summary).toMatchObject({ receiveDueOn: "2026-06-16" })
  })
})
