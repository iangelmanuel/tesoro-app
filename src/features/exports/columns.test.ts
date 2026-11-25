import { describe, expect, it } from "vitest"
import { movementColumns, movementTone } from "./columns"
import type { ExportMovementRow } from "./types"

describe("movementColumns", () => {
  it("Personal termina en Monto", () => {
    expect(movementColumns("personal").map((column) => column.key)).toEqual([
      "month",
      "date",
      "time",
      "kind",
      "description",
      "category",
      "account",
      "destination",
      "note",
      "amount"
    ])
  })

  it("Empresa suma contraparte y factura antes del monto", () => {
    expect(
      movementColumns("business")
        .slice(-3)
        .map(({ header, kind }) => [header, kind])
    ).toEqual([
      ["Contraparte", "text"],
      ["Factura", "text"],
      ["Monto", "money"]
    ])
  })
})

describe("movementTone", () => {
  it("color del monto según el tipo", () => {
    const tone = (kind: ExportMovementRow["kind"]) =>
      movementTone({ kind } as ExportMovementRow)
    expect(tone("Entrada")).toBe("income")
    expect(tone("Salida")).toBe("expense")
    expect(tone("Traspaso")).toBe("transfer")
  })
})
