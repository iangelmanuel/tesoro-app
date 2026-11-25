import { describe, expect, it } from "vitest"
import type { RecurringValue, TransactionValue } from "../types"
import {
  debtEntryLabel,
  frequencyText,
  goalContributionColumns,
  transactionColumns
} from "./preview-columns"

const NBSP = String.fromCharCode(0xa0)

describe("frequencyText", () => {
  it("mensual y anual", () => {
    const value = { frequency: "monthly", day_of_month: 5 } as RecurringValue
    expect(frequencyText(value)).toBe("Mensual, día 5")
    expect(
      frequencyText({ ...value, frequency: "yearly", month_of_year: 3 })
    ).toBe("Anual, 5 de marzo")
  })
})

describe("debtEntryLabel", () => {
  it("pago, cargo y ajuste que baja", () => {
    const entry = {
      debtId: "d1",
      kind: "payment" as const,
      amount: 10,
      occurred_on: "2026-01-01",
      note: null
    }
    expect(debtEntryLabel(entry)).toBe("Pago")
    expect(debtEntryLabel({ ...entry, kind: "adjustment" })).toBe("Cargo")
    expect(debtEntryLabel({ ...entry, kind: "adjustment", amount: -5 })).toBe(
      "Ajuste que baja el saldo"
    )
  })
})

describe("transactionColumns", () => {
  const value: TransactionValue = {
    type: "expense",
    amount: 1500,
    occurred_on: "2026-03-05",
    categoryKey: "existing:c1",
    accountKey: null,
    description: "Mercado",
    note: null
  }

  it("sin Método no hay columna Cuenta", () => {
    expect(
      transactionColumns("COP", {}).map((column) => column.header)
    ).toEqual(["Fecha", "Tipo", "Monto", "Categoría", "Descripción"])
  })

  it("con Método, Cuenta va antes de Descripción", () => {
    const columns = transactionColumns("COP", { "existing:c1": "Comida" }, {})
    expect(columns.map((column) => column.header)).toEqual([
      "Fecha",
      "Tipo",
      "Monto",
      "Categoría",
      "Cuenta",
      "Descripción"
    ])
    expect(columns.map((column) => column.cell(value))).toEqual([
      `5${NBSP}de${NBSP}mar${NBSP}de${NBSP}2026`,
      "Salida",
      `$${NBSP}1.500`,
      "Comida",
      "Sin cuenta",
      "Mercado"
    ])
  })
})

describe("goalContributionColumns", () => {
  it("retiro con monto en positivo", () => {
    const cells = goalContributionColumns("COP", { g1: "Viaje" }).map(
      (column) =>
        column.cell({
          goalId: "g1",
          amount: -200,
          occurred_on: "2026-03-05",
          note: null
        })
    )
    expect(cells.slice(1)).toEqual(["Viaje", "Retiro", `$${NBSP}200`, "—"])
  })
})
