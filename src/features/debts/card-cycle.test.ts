import { describe, expect, it } from "vitest"
import {
  CARD,
  CARD_NO_MIN,
  LOAN,
  RECEIVABLE,
  TODAY
} from "@/testing/debt-samples"
import {
  cardMonthlyPayment,
  installmentsShare,
  nextFeeDate,
  requiredPayment
} from "./card-cycle"

// Tests de caracterización (SPEC 55b): fijan el ciclo de pago y la utilización de las tarjetas

describe("ciclo de tarjeta", () => {
  it("cardMonthlyPayment: el mayor entre mínimo y cuotas del ciclo", () => {
    expect(cardMonthlyPayment(CARD)).toBe(300_000)
    expect(cardMonthlyPayment(CARD, "previous")).toBe(250_000)
    expect(cardMonthlyPayment(CARD_NO_MIN)).toBeNull()
  })

  it("requiredPayment con tope en el saldo", () => {
    expect(requiredPayment(CARD)).toBe(300_000)
    expect(requiredPayment(LOAN)).toBe(400_000)
    expect(requiredPayment({ ...LOAN, balance: 150_000 })).toBe(150_000)
    expect(requiredPayment(RECEIVABLE)).toBeNull()
  })

  it("installmentsShare solo en tarjetas con cuotas", () => {
    expect(installmentsShare(CARD)).toBe(300_000)
    expect(
      installmentsShare({ ...CARD, installments_due_current: 0 })
    ).toBeNull()
    expect(installmentsShare(LOAN)).toBeNull()
  })

  it("nextFeeDate: el primer día de cuota posterior a hoy, con el 31 en meses cortos", () => {
    const card = { status: "active" as const, fee_day: 31 }
    expect(nextFeeDate(card, TODAY)).toBe("2026-06-30")
    expect(nextFeeDate(card, "2026-06-30")).toBe("2026-07-31")
    expect(nextFeeDate({ ...card, fee_day: 10 }, TODAY)).toBe("2026-07-10")
    expect(nextFeeDate({ ...card, fee_day: null }, TODAY)).toBeNull()
    expect(nextFeeDate({ ...card, status: "paid" }, TODAY)).toBeNull()
  })
})
