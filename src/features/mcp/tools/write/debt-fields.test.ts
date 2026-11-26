import { describe, expect, it } from "vitest"
import {
  debtFields,
  missingRequired,
  notApplicable,
  pickFields,
  requiredKey,
  valuesOf
} from "./debt-fields"

describe("requiredKey", () => {
  it("Me deben se separa por tipo de cobro", () => {
    expect(requiredKey("loan", null)).toBe("loan")
    expect(requiredKey("receivable", null)).toBe("receivable_once")
    expect(requiredKey("receivable", "monthly")).toBe("receivable_monthly")
  })
})

describe("missingRequired", () => {
  it("pregunta los obligatorios que no llegaron o vienen vacíos", () => {
    expect(
      missingRequired(
        { name: "  ", opening_balance: 0, installment: null },
        "loan",
        null
      ).map((item) => item.field)
    ).toEqual(["name", "installment", "interest_rate", "due_day"])
  })

  it("con todo, no pregunta", () => {
    expect(
      missingRequired(
        { name: "Amigo", opening_balance: 100 },
        "receivable",
        "once"
      )
    ).toEqual([])
  })
})

describe("notApplicable", () => {
  it("pregunta por los campos que no aplican al tipo", () => {
    expect(
      notApplicable(
        { name: "Visa", installment: 10, starts_on: undefined },
        "credit_card",
        null
      )
    ).toEqual([
      {
        field: "installment",
        question:
          "La cuota no aplica a una tarjeta de crédito. ¿Lo quitamos o es otro tipo?"
      }
    ])
    expect(
      notApplicable({ credit_limit: 5 }, "receivable", "monthly")[0].question
    ).toBe(
      "El cupo no aplica a una cuenta por cobrar (mes a mes). ¿Lo quitamos o es otro tipo?"
    )
  })
})

describe("pickFields y valuesOf", () => {
  it("solo los campos del tipo; vacíos en null y contraparte en texto", () => {
    expect(
      pickFields({ name: "Amigo", installment: 9 }, "receivable", "once")
    ).toEqual({
      name: "Amigo",
      counterparty: "",
      opening_balance: null,
      expected_on: null
    })
  })

  it("valuesOf toma las claves del esquema", () => {
    const values = valuesOf(
      { workspace_id: "w", name: "Visa", extra: 1 },
      debtFields
    )
    expect(values).toMatchObject({ name: "Visa", due_day: undefined })
    expect(values).not.toHaveProperty("workspace_id")
    expect(values).not.toHaveProperty("extra")
  })
})
