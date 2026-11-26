import { describe, expect, it } from "vitest"
import {
  type StatementRow,
  findDuplicates,
  interpretRow,
  reconcile,
  selectRows,
  signed,
  statementRowsSchema
} from "./statement-rows"

const row = (fields: Partial<StatementRow>): StatementRow => ({
  index: 0,
  kind: "expense",
  direction: "out",
  amount: 100,
  date: "2026-10-05",
  time: null,
  description: "Mercado",
  note: null,
  categoryId: null,
  transferAccountId: null,
  ...fields
})

describe("statementRowsSchema", () => {
  it("monto distinto de 0 y al menos una fila", () => {
    expect(statementRowsSchema.safeParse([]).success).toBe(false)
    expect(
      statementRowsSchema.safeParse([
        { date: "2026-10-05", description: "x", amount: 0 }
      ]).success
    ).toBe(false)
    expect(
      statementRowsSchema.safeParse([
        { date: "2026-10-05", description: "x", amount: -5 }
      ]).success
    ).toBe(true)
  })
})

describe("interpretRow", () => {
  it("por signo, por tipo y traspasos", () => {
    expect(interpretRow({ amount: -50 })).toEqual({
      direction: "out",
      kind: "expense",
      amount: 50,
      isTransfer: false
    })
    expect(interpretRow({ amount: -50, type: "income" })).toMatchObject({
      direction: "in",
      kind: "income",
      amount: 50
    })
    expect(
      interpretRow({ amount: 30, transfer_account: "Ahorros" })
    ).toMatchObject({ direction: "in", kind: "transfer", isTransfer: true })
  })
})

describe("signed", () => {
  it("lo que entra suma y lo que sale resta", () => {
    expect(signed({ direction: "in", amount: 10 })).toBe(10)
    expect(signed({ direction: "out", amount: 10 })).toBe(-10)
  })
})

describe("findDuplicates", () => {
  it("contra lo registrado a ±2 días y contra filas anteriores", () => {
    const rows = [
      row({ index: 0, date: "2026-10-05" }),
      row({ index: 1, date: "2026-10-06" }),
      row({ index: 2, date: "2026-10-05", amount: 100.004 }),
      row({ index: 3, kind: "income", direction: "in" })
    ]
    const existing = [
      {
        id: "t1",
        kind: "expense" as const,
        direction: "out" as const,
        amount: 100,
        date: "2026-10-08"
      },
      {
        id: "t2",
        kind: "expense" as const,
        direction: "out" as const,
        amount: 100,
        date: "2026-10-09"
      }
    ]
    expect(findDuplicates(rows, existing)).toEqual([
      { row: 1, matches: ["t1", "row:0"] },
      { row: 2, matches: ["row:0", "row:1"] }
    ])
  })
})

describe("selectRows", () => {
  it("omite duplicadas salvo las incluidas; listas sin preguntas", () => {
    expect(
      selectRows(
        [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }],
        [
          { row: 1, matches: ["t1"] },
          { row: 2, matches: ["row:0"] }
        ],
        [2],
        [3, undefined]
      )
    ).toEqual({
      omitted: new Set([1]),
      toImport: [0, 2, 3],
      ready: [0, 2]
    })
  })
})

describe("reconcile", () => {
  it("suma solo lo que se importa hasta la fecha de cierre", () => {
    const rows = [
      row({ index: 0, amount: 20.1 }),
      row({ index: 1, direction: "in", kind: "income", amount: 5 }),
      row({ index: 2, amount: 99 }),
      row({ index: 3, amount: 7, date: "2026-10-31" })
    ]
    expect(
      reconcile(rows, [0, 1, 3], {
        endDate: "2026-10-30",
        before: 100,
        statementBalance: 80
      })
    ).toEqual({
      end_date: "2026-10-30",
      before: 100,
      after: 84.9,
      statement: 80,
      difference: -4.9,
      difference_before: -20
    })
  })
})
