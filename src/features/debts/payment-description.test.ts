import { describe, expect, it } from "vitest"
import { TODAY } from "@/testing/debt-samples"
import { debtFixture } from "@/testing/fixtures"
import { debtPaymentDescriptions } from "./payment-description"

// Tests de caracterización (SPEC 55b): fijan la descripción y el monto que
// prellena el pago de una deuda (diálogo de pago y pay_debt del MCP)

const CARD = debtFixture({
  name: "Visa",
  kind: "credit_card",
  min_payment: 250_000,
  balance: 1_000_000,
  next_due_on: "2026-06-20",
  prev_due_on: "2026-05-20",
  paid_current_cycle: 0,
  paid_previous_cycle: 250_000
})

describe("debtPaymentDescriptions", () => {
  it("pago del ciclo con el mes de la cuota y lo que falta", () => {
    expect(
      debtPaymentDescriptions({ ...CARD, paid_current_cycle: 100_000 }, TODAY)
    ).toMatchInlineSnapshot(`
      {
        "amount": 150000,
        "extra": "Pago Visa",
        "payment": "Pago Visa · junio",
      }
    `)
  })

  it("cuota vencida: el mes y el monto de la vencida", () => {
    expect(
      debtPaymentDescriptions(
        { ...CARD, paid_previous_cycle: 0, created_at: "2026-01-01T15:00:00Z" },
        TODAY
      )
    ).toMatchInlineSnapshot(`
      {
        "amount": 250000,
        "extra": "Pago Visa",
        "payment": "Pago Visa · mayo",
      }
    `)
  })

  it("ciclo cubierto: solo Pago {nombre} y sin monto", () => {
    expect(
      debtPaymentDescriptions({ ...CARD, paid_current_cycle: 250_000 }, TODAY)
    ).toMatchInlineSnapshot(`
      {
        "amount": null,
        "extra": "Pago Visa",
        "payment": "Pago Visa",
      }
    `)
  })

  it("préstamo con cuota y cuenta por cobrar", () => {
    expect(
      debtPaymentDescriptions(
        debtFixture({
          name: "Libre inversión",
          installment: 400_000,
          balance: 3_000_000,
          next_due_on: "2026-07-05",
          prev_due_on: "2026-06-05",
          paid_current_cycle: 0,
          paid_previous_cycle: 400_000
        }),
        TODAY
      )
    ).toMatchInlineSnapshot(`
      {
        "amount": 400000,
        "extra": "Pago Libre inversión",
        "payment": "Pago Libre inversión · julio",
      }
    `)
    expect(
      debtPaymentDescriptions(
        debtFixture({ name: "Ana", kind: "receivable", balance: 500_000 }),
        TODAY
      )
    ).toMatchInlineSnapshot(`
      {
        "amount": null,
        "extra": "Cobro Ana",
        "payment": "Cobro Ana",
      }
    `)
  })
})
