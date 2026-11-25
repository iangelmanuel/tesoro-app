import { describe, expect, it } from "vitest"
import {
  installmentLabel,
  installmentProgress,
  installmentStartMonth
} from "./installments"

// Tests de caracterización (SPEC 55b): fijan las compras a cuotas de una
// tarjeta (misma regla que card_installment_start)

describe("installmentStartMonth", () => {
  it("sin corte: el primer vencimiento posterior a la compra", () => {
    expect(installmentStartMonth("2026-03-10", 15, null)).toBe("2026-03")
    expect(installmentStartMonth("2026-03-15", 15, null)).toBe("2026-04")
    expect(installmentStartMonth("2026-03-20", 15, null)).toBe("2026-04")
  })

  it("con corte: el vencimiento posterior al corte que incluye la compra", () => {
    // Corte el 25, pago el 10 del mes siguiente
    expect(installmentStartMonth("2026-03-20", 10, 25)).toBe("2026-04")
    expect(installmentStartMonth("2026-03-26", 10, 25)).toBe("2026-05")
    expect(installmentStartMonth("2026-03-25", 10, 25)).toBe("2026-04")
  })

  it("días que no existen caen en el último del mes", () => {
    expect(installmentStartMonth("2026-02-27", 31, 30)).toBe("2026-03")
    expect(installmentStartMonth("2026-02-28", 31, null)).toBe("2026-03")
  })
})

describe("installmentProgress e installmentLabel", () => {
  const card = { due_day: 10, closing_day: 25 }
  const entry = { occurred_on: "2026-03-20", installments: 3 }

  it("en qué cuota va respecto al próximo vencimiento", () => {
    expect(installmentProgress(entry, card, "2026-03-10")).toEqual({
      kind: "upcoming",
      total: 3
    })
    expect(installmentProgress(entry, card, "2026-05-10")).toEqual({
      kind: "due",
      current: 2,
      total: 3
    })
    expect(installmentProgress(entry, card, "2026-07-10")).toEqual({
      kind: "done",
      total: 3
    })
  })

  it("sin cuotas o sin vencimiento no aplica", () => {
    expect(
      installmentProgress({ ...entry, installments: null }, card, "2026-05-10")
    ).toBeNull()
    expect(
      installmentProgress(entry, { ...card, due_day: null }, "2026-05-10")
    ).toBeNull()
    expect(installmentProgress(entry, card, null)).toBeNull()
  })

  it("etiqueta con el avance", () => {
    expect(installmentLabel(3, { kind: "due", current: 2, total: 3 })).toBe(
      "a 3 cuotas · 2 de 3"
    )
    expect(installmentLabel(3, { kind: "done", total: 3 })).toBe(
      "a 3 cuotas · pagada"
    )
    expect(installmentLabel(1, null)).toBe("a 1 cuota")
  })
})
