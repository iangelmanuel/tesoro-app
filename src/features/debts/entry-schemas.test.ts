import { describe, expect, it } from "vitest"
import {
  FUTURE_ISO,
  PAST_DATE,
  SAMPLE_UUID,
  schemaResult
} from "@/testing/schema-result"
import {
  adjustBalanceSchema,
  advanceSchema,
  debtChargeSchema,
  debtEntryEditSchema,
  installmentsField,
  paymentSchema
} from "./entry-schemas"

// Tests de caracterización (SPEC 55b): fijan lo que acepta cada esquema y
// sus mensajes de error (los mismos que devuelve el MCP)

describe("movimientos", () => {
  it("installmentsField: vacío o de 1 a 48", () => {
    expect(installmentsField.parse("")).toBeNull()
    expect(installmentsField.parse("12")).toBe(12)
    expect(installmentsField.safeParse("49").success).toBe(false)
  })

  it("pago: fecha no futura, casillas y cuenta", () => {
    expect(
      schemaResult(paymentSchema, {
        amount: "250.000",
        occurred_on: PAST_DATE,
        occurred_time: "",
        note: " ",
        description: "",
        create_transaction: "on",
        is_extra_payment: "",
        account_id: SAMPLE_UUID,
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
      schemaResult(paymentSchema, {
        amount: "0",
        occurred_on: FUTURE_ISO,
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
      occurred_on: PAST_DATE,
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
      schemaResult(debtEntryEditSchema, { ...base, type: "adjustment" }),
      schemaResult(debtEntryEditSchema, { ...base, type: "advance" }),
      schemaResult(debtEntryEditSchema, { ...base, type: "otro" })
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
      schemaResult(debtEntryEditSchema, {
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
      schemaResult(advanceSchema, {
        amount: "300.000",
        occurred_on: PAST_DATE,
        occurred_time: "08:30",
        note: "",
        account_id: SAMPLE_UUID,
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
      schemaResult(debtChargeSchema, {
        type: "adjustment",
        amount: "10",
        direction: "",
        occurred_on: PAST_DATE,
        occurred_time: "",
        note: ""
      }),
      schemaResult(debtChargeSchema, {
        type: "fee",
        amount: "15.000",
        direction: "",
        occurred_on: PAST_DATE,
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
      schemaResult(adjustBalanceSchema, {
        balance: "0",
        occurred_on: PAST_DATE,
        occurred_time: "",
        note: ""
      }),
      schemaResult(adjustBalanceSchema, {
        balance: "-5",
        occurred_on: PAST_DATE,
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
