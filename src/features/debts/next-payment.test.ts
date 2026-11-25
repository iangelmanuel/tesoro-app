import { describe, expect, it } from "vitest"
import {
  CARD,
  CARD_NO_MIN,
  LOAN,
  RECEIVABLE,
  TODAY,
  unpaidPrevious
} from "@/testing/debt-samples"
import { nextPayment, upcomingPayments } from "./next-payment"

// Tests de caracterización (SPEC 55b): fijan la próxima cuota de tarjetas y préstamos

describe("próxima cuota", () => {
  it("pendiente, pagado, de hoy o vencido", () => {
    expect(nextPayment(CARD, TODAY)).toEqual({
      status: "pending",
      dueOn: "2026-06-20",
      amount: 300_000
    })
    expect(
      nextPayment({ ...CARD, paid_current_cycle: 300_000 }, TODAY)?.status
    ).toBe("paid")
    expect(nextPayment(CARD, "2026-06-20")?.status).toBe("today")
    expect(nextPayment(unpaidPrevious(CARD), TODAY)).toEqual({
      status: "overdue",
      dueOn: "2026-05-20",
      amount: 250_000
    })
  })

  it("la deuda debe existir al vencimiento anterior, en America/Bogota", () => {
    expect(
      nextPayment(unpaidPrevious(CARD, "2026-05-25T15:00:00Z"), TODAY)?.status
    ).toBe("pending")
    // 21 de mayo a las 3:00 UTC es el 20 a las 22:00 en Bogotá
    expect(nextPayment(unpaidPrevious(CARD, "2026-05-21T03:00:00Z"), TODAY))
      .toMatchInlineSnapshot(`
      {
        "amount": 250000,
        "dueOn": "2026-05-20",
        "status": "overdue",
      }
    `)
  })

  it("un pago en el ciclo actual cubre el vencido", () => {
    expect(
      nextPayment(
        { ...unpaidPrevious(CARD), paid_current_cycle: 250_000 },
        TODAY
      )
    ).toMatchInlineSnapshot(`
      {
        "amount": 300000,
        "dueOn": "2026-06-20",
        "status": "pending",
      }
    `)
  })

  it("el vencido usa las cuotas del ciclo anterior si pasan del mínimo", () => {
    expect(
      nextPayment(
        {
          ...unpaidPrevious(CARD),
          paid_previous_cycle: 250_000,
          installments_due_previous: 400_000
        },
        TODAY
      )
    ).toMatchInlineSnapshot(`
      {
        "amount": 400000,
        "dueOn": "2026-05-20",
        "status": "overdue",
      }
    `)
  })

  it("sin mínimo solo fecha; sin saldo, sin vencimiento o inactiva no aplica", () => {
    expect(nextPayment(CARD_NO_MIN, TODAY)).toEqual({
      status: null,
      dueOn: "2026-06-20",
      amount: null
    })
    expect(nextPayment({ ...CARD, balance: 0 }, TODAY)).toBeNull()
    expect(nextPayment({ ...CARD, next_due_on: null }, TODAY)).toBeNull()
    expect(nextPayment(RECEIVABLE, TODAY)).toBeNull()
  })

  it("upcomingPayments: vencidos primero y luego por fecha", () => {
    const overdueLoan = { ...unpaidPrevious(LOAN), id: "late" }
    expect(
      upcomingPayments([LOAN, CARD, overdueLoan, RECEIVABLE], TODAY).map(
        (item) => `${item.debt.id} ${item.payment.status} ${item.payment.dueOn}`
      )
    ).toMatchInlineSnapshot(`
      [
        "late overdue 2026-06-05",
        "card pending 2026-06-20",
        "loan pending 2026-07-05",
      ]
    `)
  })
})
