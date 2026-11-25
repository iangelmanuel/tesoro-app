import { describe, expect, it } from "vitest"
import {
  frequencyLabel,
  getOccurrenceStatus,
  monthName,
  occurrenceDescription
} from "./occurrences"

// Tests de caracterización (SPEC 55b): fijan las ocurrencias de los gastos
// fijos antes del refactor de la feature

describe("getOccurrenceStatus", () => {
  const today = "2026-06-15"

  it("pagada si tiene movimiento, sin importar la fecha", () => {
    expect(
      getOccurrenceStatus({ due_on: "2026-05-01", transaction_id: "tx" }, today)
    ).toBe("paid")
  })

  it("atrasada, hoy o próxima según el vencimiento", () => {
    const status = (due_on: string) =>
      getOccurrenceStatus({ due_on, transaction_id: null }, today)
    expect(status("2026-06-14")).toBe("overdue")
    expect(status("2026-06-15")).toBe("today")
    expect(status("2026-06-16")).toBe("upcoming")
  })
})

describe("monthName y frequencyLabel", () => {
  it("da el nombre del mes en español", () => {
    expect(monthName(1)).toBe("enero")
    expect(monthName(12)).toBe("diciembre")
  })

  it("describe la frecuencia mensual y la anual", () => {
    expect(
      frequencyLabel({
        frequency: "monthly",
        day_of_month: 5,
        month_of_year: null
      })
    ).toBe("Mensual, día 5")
    expect(
      frequencyLabel({
        frequency: "yearly",
        day_of_month: 15,
        month_of_year: 3
      })
    ).toBe("Anual, 15 de marzo")
    expect(
      frequencyLabel({
        frequency: "yearly",
        day_of_month: 15,
        month_of_year: null
      })
    ).toBe("Mensual, día 15")
  })
})

describe("occurrenceDescription", () => {
  it("usa el periodo de la cuota, no el de hoy", () => {
    expect(
      occurrenceDescription({
        name: "Arriendo",
        frequency: "monthly",
        dueOn: "2026-11-05"
      })
    ).toMatchInlineSnapshot(`"Pago Arriendo · noviembre"`)
    expect(
      occurrenceDescription({
        name: "Seguro del carro",
        frequency: "yearly",
        dueOn: "2027-03-15"
      })
    ).toMatchInlineSnapshot(`"Pago Seguro del carro · marzo"`)
  })
})
