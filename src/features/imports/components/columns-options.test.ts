import { describe, expect, it } from "vitest"
import {
  importConfigFixture,
  importSourceFixture
} from "@/testing/import-fixtures"
import {
  countRows,
  missingItems,
  targetFields,
  valueFieldFor
} from "./columns-options"

describe("targetFields", () => {
  it("movimientos según el modo de tipo", () => {
    expect(
      targetFields("transactions", importConfigFixture({ typeMode: "split" }))
    ).toEqual({
      fields: [
        "date",
        "income_amount",
        "expense_amount",
        "category",
        "description",
        "note"
      ],
      required: ["date", "income_amount", "expense_amount"]
    })
  })

  it("deudas: sin columna de tipo no se muestra ni se pide", () => {
    const bySign = targetFields(
      "debt_entries",
      importConfigFixture({ entryTypeMode: "sign" })
    )
    expect(bySign.fields).not.toContain("entry_type")
    expect(bySign.required).toEqual(["date", "amount"])
    expect(
      targetFields("debt_entries", importConfigFixture({})).required
    ).toEqual(["date", "amount", "entry_type"])
  })

  it("gastos fijos piden nombre y monto", () => {
    expect(
      targetFields("recurring_expenses", importConfigFixture({})).required
    ).toEqual(["name", "amount"])
  })
})

describe("missingItems", () => {
  it("campos obligatorios sin mapear", () => {
    const config = importConfigFixture({ mapping: { date: 0 } })
    expect(
      missingItems(
        "transactions",
        config,
        targetFields("transactions", config).required
      )
    ).toEqual(["Monto"])
  })

  it("gastos fijos sin día ni inicio", () => {
    const config = importConfigFixture({ mapping: { name: 0, amount: 1 } })
    expect(
      missingItems("recurring_expenses", config, ["name", "amount"])
    ).toEqual(["Día o Inicio"])
  })

  it("deudas y metas sin columna ni destino fijo", () => {
    const config = importConfigFixture({ mapping: { date: 0, amount: 1 } })
    expect(missingItems("debt_entries", config, ["date", "amount"])).toEqual([
      "la columna Deuda o una deuda para todo el archivo"
    ])
    expect(
      missingItems("goal_contributions", { ...config, fixedLinkId: "g1" }, [
        "date",
        "amount"
      ])
    ).toEqual([])
  })
})

describe("countRows", () => {
  const table = importSourceFixture(
    ["Fecha", "Monto", "Nombre"],
    [
      ["05/01/2026", "10", null],
      [null, null, "Solo nombre"],
      ["06/01/2026", "20", "X"]
    ]
  )
  const config = importConfigFixture({
    mapping: { date: 0, amount: 1, name: 2 }
  })

  it("cuenta las filas con datos según el destino", () => {
    expect(countRows("transactions", [table], config)).toBe(2)
    expect(countRows("debt_entries", [table], config)).toBe(2)
    expect(countRows("recurring_expenses", [table], config)).toBe(3)
  })
})

describe("valueFieldFor", () => {
  it("columna cuyos valores se mapean", () => {
    const config = importConfigFixture({})
    expect(valueFieldFor("transactions", config)).toBeNull()
    expect(
      valueFieldFor("transactions", { ...config, typeMode: "column" })
    ).toBe("type")
    expect(valueFieldFor("recurring_expenses", config)).toBe("frequency")
    expect(valueFieldFor("debt_entries", config)).toBe("entry_type")
    expect(
      valueFieldFor("goal_contributions", {
        ...config,
        entryTypeMode: "all"
      })
    ).toBeNull()
  })
})
