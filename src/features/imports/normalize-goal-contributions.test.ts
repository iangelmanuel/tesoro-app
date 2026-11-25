import { describe, expect, it } from "vitest"
import {
  importConfigFixture,
  importSourceFixture
} from "@/testing/import-fixtures"
import {
  buildGoalContributionPreviewRows,
  extractGoalContributionRows,
  suggestGoalEntryValue,
  toGoalContributionImportRows
} from "./normalize-goal-contributions"

const TODAY = "2026-11-20"

describe("suggestGoalEntryValue", () => {
  it("por sinónimos", () => {
    expect(suggestGoalEntryValue("Depósito")).toBe("contribution")
    expect(suggestGoalEntryValue("RETIRO")).toBe("withdrawal")
    expect(suggestGoalEntryValue("otro")).toBeUndefined()
  })
})

describe("extractGoalContributionRows", () => {
  const table = importSourceFixture(
    ["Fecha", "Tipo", "Monto", "Meta"],
    [
      ["05/10/2026", "Aporte", "100.000", "Viaje"],
      ["06/10/2026", "Retiro", "20.000", "Viaje"],
      ["07/10/2026", "Nada", "1", "Viaje"],
      ["xx", "Aporte", "0", "Viaje"]
    ]
  )
  const { rows } = extractGoalContributionRows(
    [table],
    importConfigFixture({
      mapping: { date: 0, entry_type: 1, amount: 2, goal: 3 },
      entryTypeValues: {
        aporte: "contribution",
        retiro: "withdrawal",
        nada: "skip"
      }
    }),
    TODAY
  )

  it("lee aporte y retiro", () => {
    expect(rows[0].value).toEqual({
      entry: "contribution",
      amount: 100_000,
      occurred_on: "2026-10-05",
      linkKey: "viaje",
      linkLabel: "Viaje",
      note: null
    })
    expect(rows[1].value).toMatchObject({ entry: "withdrawal", amount: 20_000 })
  })

  it("omitida y con errores", () => {
    expect(rows[2]).toMatchObject({
      status: "skipped",
      reasons: ["Tipo «Nada» marcado como Omitir fila"]
    })
    expect(rows[3]).toMatchObject({
      status: "error",
      reasons: ["Fecha inválida", "Monto inválido"]
    })
  })

  it("por signo: negativo es retiro", () => {
    const signed = extractGoalContributionRows(
      [
        importSourceFixture(
          ["Fecha", "Monto"],
          [
            ["05/10/2026", "-5"],
            ["05/10/2026", "5"]
          ]
        )
      ],
      importConfigFixture({
        mapping: { date: 0, amount: 1 },
        entryTypeMode: "sign"
      }),
      TODAY
    ).rows
    expect(signed.map((row) => row.value?.entry)).toEqual([
      "withdrawal",
      "contribution"
    ])
  })

  it("vista previa: el retiro resta y sin meta no importa", () => {
    const preview = buildGoalContributionPreviewRows(
      rows,
      { viaje: { kind: "existing", id: "g1" } },
      null
    )
    expect(preview[0].value).toEqual({
      goalId: "g1",
      amount: 100_000,
      occurred_on: "2026-10-05",
      note: null
    })
    expect(preview[1].value).toMatchObject({ amount: -20_000 })
    expect(
      buildGoalContributionPreviewRows(rows.slice(0, 1), {}, null)[0]
    ).toMatchObject({
      status: "skipped",
      reasons: ["Meta «Viaje» marcada como No importar"]
    })
  })
})

describe("toGoalContributionImportRows", () => {
  it("solo las filas marcadas, con los nombres de la action", () => {
    const value = {
      goalId: "g1",
      amount: -20,
      occurred_on: "2026-10-05",
      note: null
    }
    const row = (selected: boolean) => ({
      sheet: "Hoja1",
      sourceRow: 2,
      status: "ready" as const,
      reasons: [],
      selected,
      value
    })
    expect(toGoalContributionImportRows([row(false), row(true)])).toEqual([
      { goal_id: "g1", amount: -20, occurred_on: "2026-10-05", note: null }
    ])
  })
})
