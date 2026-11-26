import { describe, expect, it } from "vitest"
import {
  importConfigFixture,
  importSourceFixture
} from "@/testing/import-fixtures"
import {
  buildDebtEntryPreviewRows,
  extractDebtEntryRows,
  suggestDebtEntryValue,
  toDebtEntryImportRows
} from "./normalize-debt-entries"

const TODAY = "2026-11-20"

const TABLE = importSourceFixture(
  ["Fecha", "Tipo", "Monto", "Deuda", "Nota"],
  [
    ["05/10/2026", "Pago", "200.000", "Visa", "cuota"],
    ["06/10/2026", "Compra", "50.000", "Visa", null],
    ["07/10/2026", "Rebaja", "10.000", "", null],
    ["08/10/2026", "Otro", "1", "Visa", null],
    ["08/10/2026", "Raro", "1", "Visa", null],
    ["25/11/2026", "Pago", "1", "Visa", null]
  ]
)

const MAPPING = { date: 0, entry_type: 1, amount: 2, debt: 3, note: 4 }

describe("suggestDebtEntryValue", () => {
  it("por sinónimos", () => {
    expect(suggestDebtEntryValue("Abono")).toBe("payment")
    expect(suggestDebtEntryValue("Intereses")).toBe("charge")
    expect(suggestDebtEntryValue("rebaja")).toBeUndefined()
  })
})

describe("extractDebtEntryRows por columna de tipo", () => {
  const { rows } = extractDebtEntryRows(
    [TABLE],
    importConfigFixture({
      mapping: MAPPING,
      entryTypeValues: {
        pago: "payment",
        compra: "charge",
        rebaja: "decrease",
        otro: "skip"
      }
    }),
    TODAY
  )

  it("lee tipo, monto, deuda y nota", () => {
    expect(rows[0]).toEqual({
      sheet: "Hoja1",
      sourceRow: 2,
      status: "ready",
      reasons: [],
      value: {
        entry: "payment",
        amount: 200_000,
        occurred_on: "2026-10-05",
        linkKey: "visa",
        linkLabel: "Visa",
        note: "cuota"
      }
    })
    expect(rows[2].value).toMatchObject({
      entry: "decrease",
      linkKey: "(vacio)",
      linkLabel: "(vacío)"
    })
  })

  it("omitido, desconocido y fecha futura", () => {
    expect(rows[3]).toMatchObject({
      status: "skipped",
      reasons: ["Tipo «Otro» marcado como Omitir fila"]
    })
    expect(rows[4]).toMatchObject({
      status: "error",
      reasons: ["Tipo desconocido"]
    })
    expect(rows[5]).toMatchObject({
      status: "error",
      reasons: ["Fecha futura"]
    })
  })
})

describe("extractDebtEntryRows por signo y todas iguales", () => {
  const table = importSourceFixture(
    ["Fecha", "Monto"],
    [
      ["05/10/2026", "-100"],
      ["06/10/2026", "100"]
    ]
  )

  it("negativo es pago y positivo es cargo", () => {
    const { rows } = extractDebtEntryRows(
      [table],
      importConfigFixture({
        mapping: { date: 0, amount: 1 },
        entryTypeMode: "sign"
      }),
      TODAY
    )
    expect(rows.map((row) => row.value?.entry)).toEqual(["payment", "charge"])
    expect(rows[0].value).toMatchObject({ amount: 100, linkKey: null })
  })

  it("todas son pagos", () => {
    const { rows } = extractDebtEntryRows(
      [table],
      importConfigFixture({
        mapping: { date: 0, amount: 1 },
        entryTypeMode: "all"
      }),
      TODAY
    )
    expect(rows.map((row) => row.value?.entry)).toEqual(["payment", "payment"])
  })
})

describe("buildDebtEntryPreviewRows", () => {
  const { rows } = extractDebtEntryRows(
    [TABLE],
    importConfigFixture({
      mapping: MAPPING,
      entryTypeValues: {
        pago: "payment",
        compra: "charge",
        rebaja: "decrease"
      }
    }),
    TODAY
  )

  it("pago, ajuste positivo y ajuste negativo", () => {
    const preview = buildDebtEntryPreviewRows(
      rows.slice(0, 3),
      { visa: { kind: "existing", id: "d1" }, "(vacio)": { kind: "skip" } },
      null
    )
    expect(preview[0]).toMatchObject({
      selected: true,
      value: {
        debtId: "d1",
        kind: "payment",
        amount: 200_000,
        occurred_on: "2026-10-05",
        note: "cuota"
      }
    })
    expect(preview[1].value).toMatchObject({
      kind: "adjustment",
      amount: 50_000
    })
    expect(preview[2]).toMatchObject({
      status: "skipped",
      selected: false,
      reasons: ["Deuda «(vacío)» marcada como No importar"]
    })
  })

  it("con deuda fija y sin columna", () => {
    const table = importSourceFixture(
      ["Fecha", "Monto"],
      [["05/10/2026", "-100"]]
    )
    const extracted = extractDebtEntryRows(
      [table],
      importConfigFixture({
        mapping: { date: 0, amount: 1 },
        entryTypeMode: "all"
      }),
      TODAY
    ).rows
    expect(buildDebtEntryPreviewRows(extracted, {}, "d9")[0].value).toEqual({
      debtId: "d9",
      kind: "payment",
      amount: 100,
      occurred_on: "2026-10-05",
      note: null
    })
    expect(buildDebtEntryPreviewRows(extracted, {}, null)[0].status).toBe(
      "skipped"
    )
  })
})

describe("toDebtEntryImportRows", () => {
  it("solo las filas marcadas, con los nombres de la action", () => {
    const value = {
      debtId: "d1",
      kind: "adjustment" as const,
      amount: -10,
      occurred_on: "2026-10-05",
      note: "x"
    }
    const row = (selected: boolean) => ({
      sheet: "Hoja1",
      sourceRow: 2,
      status: "ready" as const,
      reasons: [],
      selected,
      value
    })
    expect(toDebtEntryImportRows([row(true), row(false)])).toEqual([
      {
        debt_id: "d1",
        kind: "adjustment",
        amount: -10,
        occurred_on: "2026-10-05",
        note: "x"
      }
    ])
  })
})
