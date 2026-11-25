import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  creditCardSchema,
  habitualAccountSchema,
  loanSchema,
  parseRate
} from "./debt-schemas"
import {
  adjustBalanceSchema,
  advanceSchema,
  debtChargeSchema,
  debtEntryEditSchema,
  installmentsField,
  paymentSchema
} from "./entry-schemas"
import {
  monthlyReceivableSchema,
  receivableCollectSchema,
  receivableSchema
} from "./receivable-schemas"

// Tests de caracterización (SPEC 55b): fijan lo que acepta cada esquema de
// deudas y sus mensajes de error (los mismos que devuelve el MCP) antes de
// partir schemas.ts

const PAST = "2026-01-10"
const FUTURE = "2099-01-01"
const ACCOUNT = "3f0e2a4c-1b2d-4c5e-8f9a-0b1c2d3e4f5a"

/** Datos ya convertidos, o los errores por campo */
function parse(schema: z.ZodType, input: Record<string, unknown>) {
  const result = schema.safeParse(input)
  return result.success
    ? result.data
    : { errors: z.flattenError(result.error).fieldErrors }
}

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
      parse(creditCardSchema, {
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
      parse(creditCardSchema, {
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
      parse(creditCardSchema, {
        ...base,
        interest_rate: "250",
        rate_type: "ea",
        fee_amount: "15.000",
        fee_day: ""
      }),
      parse(creditCardSchema, {
        ...base,
        interest_rate: "12",
        rate_type: "mv",
        fee_amount: "",
        fee_day: "10"
      }),
      parse(creditCardSchema, {
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
      parse(loanSchema, {
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
      parse(loanSchema, {
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
      parse(loanSchema, {
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
    expect(habitualAccountSchema.parse(ACCOUNT)).toBe(ACCOUNT)
    expect(habitualAccountSchema.safeParse("x").success).toBe(false)
  })
})

describe("cuenta por cobrar", () => {
  it("de cobro único", () => {
    expect(
      parse(receivableSchema, {
        name: "Ana",
        counterparty: "Ana",
        opening_balance: "500.000",
        expected_on: ""
      })
    ).toMatchInlineSnapshot(`
      {
        "counterparty": "Ana",
        "expected_on": null,
        "name": "Ana",
        "opening_balance": 500000,
        "schedule": "once",
      }
    `)
  })

  it("mensual con cuotas, indefinida y con total demasiado grande", () => {
    const base = {
      name: "Arriendo local",
      counterparty: "",
      installment: "1.200.000,50",
      due_day: "5",
      starts_on: "2026-01-01",
      term_months: "12"
    }
    expect(parse(monthlyReceivableSchema, base)).toMatchInlineSnapshot(`
      {
        "counterparty": null,
        "due_day": 5,
        "expected_on": null,
        "installment": 1200000.5,
        "name": "Arriendo local",
        "opening_balance": 14400006,
        "schedule": "monthly",
        "starts_on": "2026-01-01",
        "term_months": 12,
      }
    `)
    expect(
      parse(monthlyReceivableSchema, { ...base, term_months: "" })
    ).toMatchObject({ term_months: null, opening_balance: 0 })
    expect(
      parse(monthlyReceivableSchema, {
        ...base,
        installment: "999.999.999.999",
        term_months: "600"
      })
    ).toMatchInlineSnapshot(`
      {
        "errors": {
          "term_months": [
            "El total de las cuotas es demasiado grande",
          ],
        },
      }
    `)
  })

  it("cobro: cada modo con sus campos", () => {
    const base = {
      occurred_on: PAST,
      note: "",
      description: "",
      create_transaction: "on",
      account_id: ACCOUNT
    }
    expect([
      parse(receivableCollectSchema, {
        ...base,
        mode: "partial",
        amount: "100"
      }),
      parse(receivableCollectSchema, { ...base, mode: "full" }),
      parse(receivableCollectSchema, {
        ...base,
        mode: "single",
        amount: "100",
        period_on: "2026-01-15"
      }),
      parse(receivableCollectSchema, { ...base, mode: "otro" })
    ]).toMatchInlineSnapshot(`
      [
        {
          "account_id": "3f0e2a4c-1b2d-4c5e-8f9a-0b1c2d3e4f5a",
          "amount": 100,
          "create_transaction": true,
          "description": null,
          "mode": "partial",
          "note": null,
          "occurred_on": "2026-01-10",
        },
        {
          "account_id": "3f0e2a4c-1b2d-4c5e-8f9a-0b1c2d3e4f5a",
          "create_transaction": true,
          "description": null,
          "mode": "full",
          "note": null,
          "occurred_on": "2026-01-10",
        },
        {
          "errors": {
            "period_on": [
              "Elige la cuota que se cobra",
            ],
          },
        },
        {
          "errors": {
            "mode": [
              "Elige cómo se cobra",
            ],
          },
        },
      ]
    `)
  })
})

describe("movimientos", () => {
  it("installmentsField: vacío o de 1 a 48", () => {
    expect(installmentsField.parse("")).toBeNull()
    expect(installmentsField.parse("12")).toBe(12)
    expect(installmentsField.safeParse("49").success).toBe(false)
  })

  it("pago: fecha no futura, casillas y cuenta", () => {
    expect(
      parse(paymentSchema, {
        amount: "250.000",
        occurred_on: PAST,
        occurred_time: "",
        note: " ",
        description: "",
        create_transaction: "on",
        is_extra_payment: "",
        account_id: ACCOUNT,
        transfer_from: "",
        transfer_amount: ""
      })
    ).toMatchInlineSnapshot(`
      {
        "account_id": "3f0e2a4c-1b2d-4c5e-8f9a-0b1c2d3e4f5a",
        "amount": 250000,
        "create_transaction": true,
        "description": null,
        "is_extra_payment": false,
        "note": null,
        "occurred_on": "2026-01-10",
        "occurred_time": null,
        "transfer_amount": null,
        "transfer_from": null,
      }
    `)
    expect(
      parse(paymentSchema, {
        amount: "0",
        occurred_on: FUTURE,
        occurred_time: "25:00",
        note: "x".repeat(121),
        description: "",
        create_transaction: "",
        is_extra_payment: "",
        account_id: "",
        transfer_from: "",
        transfer_amount: ""
      })
    ).toMatchInlineSnapshot(`
      {
        "errors": {
          "amount": [
            "El monto debe ser mayor a 0",
          ],
          "note": [
            "La nota debe tener máximo 120 caracteres",
          ],
          "occurred_on": [
            "La fecha no puede ser futura",
          ],
          "occurred_time": [
            "Hora inválida",
          ],
        },
      }
    `)
  })

  it("editar: el ajuste pide dirección y el avance cuenta", () => {
    const base = {
      amount: "100",
      direction: "",
      occurred_on: PAST,
      occurred_time: "",
      note: "",
      account_id: "",
      create_transaction: "",
      description: "",
      category_id: "",
      installments: "",
      link_transaction_id: ""
    }
    expect([
      parse(debtEntryEditSchema, { ...base, type: "adjustment" }),
      parse(debtEntryEditSchema, { ...base, type: "advance" }),
      parse(debtEntryEditSchema, { ...base, type: "otro" })
    ]).toMatchInlineSnapshot(`
      [
        {
          "errors": {
            "direction": [
              "Elige si el ajuste sube o baja el saldo",
            ],
          },
        },
        {
          "errors": {
            "account_id": [
              "Elige la cuenta a la que entró el avance",
            ],
          },
        },
        {
          "errors": {
            "type": [
              "Elige el tipo de movimiento",
            ],
          },
        },
      ]
    `)
    expect(
      parse(debtEntryEditSchema, {
        ...base,
        type: "purchase",
        installments: "3"
      })
    ).toMatchInlineSnapshot(`
      {
        "account_id": null,
        "amount": 100,
        "category_id": null,
        "create_transaction": false,
        "description": null,
        "direction": null,
        "installments": 3,
        "link_transaction_id": null,
        "note": null,
        "occurred_on": "2026-01-10",
        "occurred_time": null,
        "type": "purchase",
      }
    `)
  })

  it("avance, cargo y actualizar saldo", () => {
    expect(
      parse(advanceSchema, {
        amount: "300.000",
        occurred_on: PAST,
        occurred_time: "08:30",
        note: "",
        account_id: ACCOUNT,
        installments: "6"
      })
    ).toMatchInlineSnapshot(`
      {
        "account_id": "3f0e2a4c-1b2d-4c5e-8f9a-0b1c2d3e4f5a",
        "amount": 300000,
        "installments": 6,
        "note": null,
        "occurred_on": "2026-01-10",
        "occurred_time": "08:30",
      }
    `)
    expect([
      parse(debtChargeSchema, {
        type: "adjustment",
        amount: "10",
        direction: "",
        occurred_on: PAST,
        occurred_time: "",
        note: ""
      }),
      parse(debtChargeSchema, {
        type: "fee",
        amount: "15.000",
        direction: "",
        occurred_on: PAST,
        occurred_time: "",
        note: ""
      })
    ]).toMatchInlineSnapshot(`
      [
        {
          "errors": {
            "direction": [
              "Elige si el ajuste sube o baja el saldo",
            ],
          },
        },
        {
          "amount": 15000,
          "direction": null,
          "note": null,
          "occurred_on": "2026-01-10",
          "occurred_time": null,
          "type": "fee",
        },
      ]
    `)
    expect([
      parse(adjustBalanceSchema, {
        balance: "0",
        occurred_on: PAST,
        occurred_time: "",
        note: ""
      }),
      parse(adjustBalanceSchema, {
        balance: "-5",
        occurred_on: PAST,
        occurred_time: "",
        note: ""
      })
    ]).toMatchInlineSnapshot(`
      [
        {
          "balance": 0,
          "note": null,
          "occurred_on": "2026-01-10",
          "occurred_time": null,
        },
        {
          "errors": {
            "balance": [
              "Ingresa un monto válido",
            ],
          },
        },
      ]
    `)
  })
})
