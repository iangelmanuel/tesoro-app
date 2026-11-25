import { describe, expect, it } from "vitest"
import { SAMPLE_UUID, schemaResult } from "@/testing/schema-result"
import {
  creditCardSchema,
  habitualAccountSchema,
  loanSchema,
  parseRate
} from "./debt-schemas"

// Tests de caracterización (SPEC 55b): fijan lo que acepta cada esquema y
// sus mensajes de error (los mismos que devuelve el MCP)

describe("parseRate", () => {
  it("acepta coma decimal y % y hasta 3 decimales", () => {
    expect(parseRate("28,5")).toBe(28.5)
    expect(parseRate(" 1,234 %")).toBe(1.234)
    expect(parseRate("1,2345")).toBeNaN()
    expect(parseRate("abc")).toBeNaN()
  })
})

describe("deuda", () => {
  it("tarjeta: montos en es-CO, tasa opcional y cuota de manejo completa", () => {
    expect(
      schemaResult(creditCardSchema, {
        name: " Visa ",
        counterparty: "",
        opening_balance: "0",
        credit_limit: "5.000.000",
        due_day: "15",
        interest_rate: "",
        rate_type: "ea",
        min_payment: "",
        closing_day: "",
        fee_amount: "",
        fee_day: ""
      })
    ).toMatchInlineSnapshot(`
      {
        "closing_day": null,
        "counterparty": null,
        "credit_limit": 5000000,
        "due_day": 15,
        "fee_amount": null,
        "fee_day": null,
        "interest_rate": null,
        "min_payment": null,
        "name": "Visa",
        "opening_balance": 0,
        "rate_type": null,
      }
    `)
  })

  it("tarjeta: errores de cupo, día, tasa y cuota de manejo", () => {
    expect(
      schemaResult(creditCardSchema, {
        name: "",
        counterparty: "",
        opening_balance: "-1",
        credit_limit: "0",
        due_day: "32",
        interest_rate: "250",
        rate_type: "ea",
        min_payment: "",
        closing_day: "0",
        fee_amount: "15.000",
        fee_day: ""
      })
    ).toMatchInlineSnapshot(`
      {
        "errors": {
          "closing_day": [
            "Elige un día de corte entre 1 y 31",
          ],
          "credit_limit": [
            "El cupo debe ser mayor a 0",
          ],
          "due_day": [
            "Elige un día de pago entre 1 y 31",
          ],
          "name": [
            "Ingresa un nombre",
          ],
          "opening_balance": [
            "Ingresa un monto válido",
          ],
        },
      }
    `)
  })

  it("tarjeta: tasa sobre el tope y cuota de manejo sin día o sin monto", () => {
    const base = {
      name: "Visa",
      counterparty: "",
      opening_balance: "0",
      credit_limit: "1.000.000",
      due_day: "15",
      min_payment: "",
      closing_day: ""
    }
    expect([
      schemaResult(creditCardSchema, {
        ...base,
        interest_rate: "250",
        rate_type: "ea",
        fee_amount: "15.000",
        fee_day: ""
      }),
      schemaResult(creditCardSchema, {
        ...base,
        interest_rate: "12",
        rate_type: "mv",
        fee_amount: "",
        fee_day: "10"
      }),
      schemaResult(creditCardSchema, {
        ...base,
        interest_rate: "",
        rate_type: "mv",
        fee_amount: "",
        fee_day: ""
      })
    ]).toMatchInlineSnapshot(`
      [
        {
          "errors": {
            "fee_day": [
              "Elige el día de cobro de la cuota",
            ],
            "interest_rate": [
              "La tasa E.A. debe ser máximo 200 %",
            ],
          },
        },
        {
          "errors": {
            "fee_amount": [
              "Ingresa el monto de la cuota",
            ],
            "interest_rate": [
              "La tasa M.V. debe ser máximo 10 %",
            ],
          },
        },
        {
          "closing_day": null,
          "counterparty": null,
          "credit_limit": 1000000,
          "due_day": 15,
          "fee_amount": null,
          "fee_day": null,
          "interest_rate": null,
          "min_payment": null,
          "name": "Visa",
          "opening_balance": 0,
          "rate_type": null,
        },
      ]
    `)
  })

  it("préstamo: tasa obligatoria con su tipo y plazo entre 1 y 600", () => {
    expect(
      schemaResult(loanSchema, {
        name: "Libre inversión",
        counterparty: "Banco",
        opening_balance: "8.000.000",
        installment: "400.000",
        interest_rate: "1,5",
        rate_type: "mv",
        due_day: "5",
        original_amount: "",
        term_months: "24"
      })
    ).toMatchInlineSnapshot(`
      {
        "counterparty": "Banco",
        "due_day": 5,
        "installment": 400000,
        "interest_rate": 1.5,
        "name": "Libre inversión",
        "opening_balance": 8000000,
        "original_amount": null,
        "rate_type": "mv",
        "term_months": 24,
      }
    `)
    expect(
      schemaResult(loanSchema, {
        name: "Libre inversión",
        counterparty: "",
        opening_balance: "8.000.000",
        installment: "",
        interest_rate: "",
        rate_type: "",
        due_day: "5",
        original_amount: "",
        term_months: "601"
      })
    ).toMatchInlineSnapshot(`
      {
        "errors": {
          "installment": [
            "Ingresa la cuota",
          ],
          "term_months": [
            "Ingresa un plazo entre 1 y 600 meses",
          ],
        },
      }
    `)
    expect(
      schemaResult(loanSchema, {
        name: "X",
        counterparty: "",
        opening_balance: "1",
        installment: "1",
        interest_rate: "12",
        rate_type: "",
        due_day: "5",
        original_amount: "",
        term_months: ""
      })
    ).toMatchInlineSnapshot(`
      {
        "errors": {
          "rate_type": [
            "Elige E.A. o M.V.",
          ],
        },
      }
    `)
  })

  it("cuenta habitual: vacía o un uuid", () => {
    expect(habitualAccountSchema.parse("")).toBeNull()
    expect(habitualAccountSchema.parse(SAMPLE_UUID)).toBe(SAMPLE_UUID)
    expect(habitualAccountSchema.safeParse("x").success).toBe(false)
  })
})
