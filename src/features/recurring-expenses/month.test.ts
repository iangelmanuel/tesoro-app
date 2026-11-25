import { describe, expect, it } from "vitest"
import { parseRecurringMonth } from "./month"

// Tests de caracterización (SPEC 55b): fijan el `?month` de Próximos pagos
// antes del refactor de la feature

// 15 de junio de 2026 al mediodía en America/Bogota
const NOW = new Date("2026-06-15T17:00:00Z")

describe("parseRecurringMonth", () => {
  it("toma el mes pedido dentro del rango", () => {
    expect(parseRecurringMonth("2026-03", "2025-11", NOW))
      .toMatchInlineSnapshot(`
      {
        "isCurrent": false,
        "label": "marzo 2026",
        "month": "2026-03",
        "next": "2026-04",
        "prev": "2026-02",
      }
    `)
  })

  it("en el mes actual no tiene siguiente", () => {
    const result = parseRecurringMonth(undefined, "2025-11", NOW)
    expect(result.month).toBe("2026-06")
    expect(result.isCurrent).toBe(true)
    expect(result.next).toBeNull()
    expect(result.prev).toBe("2026-05")
  })

  it("en el primer mes no tiene anterior", () => {
    const result = parseRecurringMonth("2025-11", "2025-11", NOW)
    expect(result.prev).toBeNull()
    expect(result.next).toBe("2025-12")
  })

  it("lleva un mes fuera de rango o inválido al límite más cercano", () => {
    expect(parseRecurringMonth("2027-01", "2025-11", NOW).month).toBe("2026-06")
    expect(parseRecurringMonth("2024-01", "2025-11", NOW).month).toBe("2025-11")
    expect(parseRecurringMonth("hola", "2025-11", NOW).month).toBe("2026-06")
  })

  it("sin gastos fijos solo deja el mes actual", () => {
    const result = parseRecurringMonth("2026-01", null, NOW)
    expect(result.month).toBe("2026-06")
    expect(result.prev).toBeNull()
    expect(result.next).toBeNull()
  })
})
