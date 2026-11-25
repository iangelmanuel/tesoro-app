import { describe, expect, it } from "vitest"
import { PAST_DATE, SAMPLE_UUID, schemaResult } from "@/testing/schema-result"
import {
  monthlyReceivableSchema,
  receivableCollectSchema,
  receivableSchema
} from "./receivable-schemas"

// Tests de caracterización (SPEC 55b): fijan lo que acepta cada esquema y
// sus mensajes de error (los mismos que devuelve el MCP)

describe("cuenta por cobrar", () => {
  it("de cobro único", () => {
    expect(
      schemaResult(receivableSchema, {
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
    expect(schemaResult(monthlyReceivableSchema, base)).toMatchInlineSnapshot(`
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
      schemaResult(monthlyReceivableSchema, { ...base, term_months: "" })
    ).toMatchObject({ term_months: null, opening_balance: 0 })
    expect(
      schemaResult(monthlyReceivableSchema, {
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
      occurred_on: PAST_DATE,
      note: "",
      description: "",
      create_transaction: "on",
      account_id: SAMPLE_UUID
    }
    expect([
      schemaResult(receivableCollectSchema, {
        ...base,
        mode: "partial",
        amount: "100"
      }),
      schemaResult(receivableCollectSchema, { ...base, mode: "full" }),
      schemaResult(receivableCollectSchema, {
        ...base,
        mode: "single",
        amount: "100",
        period_on: "2026-01-15"
      }),
      schemaResult(receivableCollectSchema, { ...base, mode: "otro" })
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
