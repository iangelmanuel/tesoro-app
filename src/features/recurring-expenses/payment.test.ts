import { describe, expect, it } from "vitest"
import { upcomingPaymentFixture } from "@/testing/fixtures"
import {
  nextUnpaidOccurrence,
  recurringPaymentValues,
  unpaidOccurrence
} from "./payment"

// Tests de caracterización (SPEC 55b): fijan el prellenado de pagar un gasto
// fijo (diálogo de movimiento y pay_recurring_expense del MCP)

const PAYMENTS = [
  upcomingPaymentFixture({
    recurringExpenseId: "rent",
    dueOn: "2026-06-05",
    transactionId: "paid"
  }),
  upcomingPaymentFixture({ recurringExpenseId: "rent", dueOn: "2026-08-05" }),
  upcomingPaymentFixture({ recurringExpenseId: "rent", dueOn: "2026-07-05" }),
  upcomingPaymentFixture({ recurringExpenseId: "gym", dueOn: "2026-05-01" })
]

describe("unpaidOccurrence", () => {
  it("da la sin pagar más antigua del gasto", () => {
    expect(unpaidOccurrence(PAYMENTS, "rent")?.dueOn).toBe("2026-07-05")
  })

  it("da la de una fecha si está sin pagar", () => {
    expect(unpaidOccurrence(PAYMENTS, "rent", "2026-08-05")?.dueOn).toBe(
      "2026-08-05"
    )
    expect(unpaidOccurrence(PAYMENTS, "rent", "2026-06-05")).toBeNull()
    expect(unpaidOccurrence(PAYMENTS, "otro")).toBeNull()
  })
})

describe("nextUnpaidOccurrence", () => {
  it("da la primera sin pagar después de una fecha", () => {
    expect(nextUnpaidOccurrence(PAYMENTS, "rent", "2026-06-05")?.dueOn).toBe(
      "2026-07-05"
    )
    expect(nextUnpaidOccurrence(PAYMENTS, "rent", "2026-07-05")?.dueOn).toBe(
      "2026-08-05"
    )
    expect(nextUnpaidOccurrence(PAYMENTS, "rent", "2026-08-05")).toBeNull()
  })
})

describe("recurringPaymentValues", () => {
  const payment = upcomingPaymentFixture({
    name: "Arriendo",
    amount: 1_500_000,
    dueOn: "2026-07-05",
    accountId: "bank"
  })

  it("prellena monto, categoría, cuenta activa y descripción", () => {
    expect(recurringPaymentValues(payment, [{ id: "bank", archived_at: null }]))
      .toMatchInlineSnapshot(`
      {
        "account_id": "bank",
        "amount": 1500000,
        "category_id": "category",
        "description": "Pago Arriendo · julio",
      }
    `)
  })

  it("deja la cuenta vacía si está archivada o no existe", () => {
    expect(
      recurringPaymentValues(payment, [
        { id: "bank", archived_at: "2026-01-01" }
      ]).account_id
    ).toBeNull()
    expect(recurringPaymentValues(payment, []).account_id).toBeNull()
  })
})
