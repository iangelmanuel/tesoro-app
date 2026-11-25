import { describe, expect, it } from "vitest"
import { debtFixture } from "@/testing/fixtures"
import {
  cardMonthlyPayment,
  collectedPercent,
  compareByExpectedOn,
  compareByNextDue,
  debtProjection,
  debtStatusLabel,
  formatDayMonth,
  formatMonthYear,
  formatRate,
  globalUtilization,
  hasZeroBalance,
  installmentsShare,
  isActiveDebt,
  isOpenEndedReceivable,
  isReceivableOverdue,
  monthlyInterest,
  monthlyRate,
  nextFeeDate,
  nextPayment,
  paidPercent,
  projectPayoff,
  requiredPayment,
  totalDebt,
  totalMonthlyInterest,
  totalReceivable,
  upcomingPayments,
  utilizationLevel,
  utilizationPercent
} from "./calculations"

// Tests de caracterización (SPEC 55b): fijan saldo, estado, próxima cuota,
// utilización y proyección de las deudas antes de partir calculations.ts

const TODAY = "2026-06-15"

const CARD = debtFixture({
  id: "card",
  name: "Visa",
  kind: "credit_card",
  credit_limit: 5_000_000,
  min_payment: 250_000,
  interest_rate: 28,
  rate_type: "ea",
  balance: 2_000_000,
  next_due_on: "2026-06-20",
  prev_due_on: "2026-05-20",
  paid_current_cycle: 0,
  paid_previous_cycle: 250_000,
  installments_due_current: 300_000,
  installments_due_previous: 100_000
})

const LOAN = debtFixture({
  id: "loan",
  name: "Libre inversión",
  installment: 400_000,
  original_amount: 8_000_000,
  interest_rate: 1.5,
  rate_type: "mv",
  balance: 3_000_000,
  next_due_on: "2026-07-05",
  prev_due_on: "2026-06-05",
  paid_current_cycle: 0,
  paid_previous_cycle: 400_000
})

const RECEIVABLE = debtFixture({
  id: "ana",
  name: "Ana",
  kind: "receivable",
  schedule: "once",
  opening_balance: 1_000_000,
  balance: 600_000,
  expected_on: "2026-06-01"
})

/** Tarjeta sin pago mínimo ni cuotas: solo tiene fecha de pago */
const CARD_NO_MIN = {
  ...CARD,
  min_payment: null,
  installments_due_current: null,
  installments_due_previous: null
}

/** Mensual indefinida: sin saldo total */
const OPEN_RECEIVABLE = {
  ...RECEIVABLE,
  id: "open",
  schedule: "monthly" as const,
  term_months: null,
  balance: 900_000
}

/** La deuda sin pagar el ciclo anterior, creada antes de ese vencimiento */
function unpaidPrevious<T extends typeof CARD>(
  debt: T,
  createdAt = "2026-01-01T15:00:00Z"
): T {
  return { ...debt, paid_previous_cycle: 0, created_at: createdAt }
}

// Los bloques siguen el destino de cada función al partir calculations.ts
// (SPEC 55b paso 8): saldo y estado se quedan; ciclo de tarjeta, próxima
// cuota y proyección pasan a módulos hermanos

describe("formatos", () => {
  it("tasa, mes y día", () => {
    expect([
      formatRate(28.5, "ea"),
      formatRate(1.234, "mv"),
      formatMonthYear("2027-10"),
      formatDayMonth("2026-12-05")
    ]).toMatchInlineSnapshot(`
      [
        "28,5 % E.A.",
        "1,234 % M.V.",
        "octubre de 2027",
        "5 de diciembre",
      ]
    `)
  })
})

describe("saldo y estado", () => {
  it("isActiveDebt solo tarjetas y préstamos activos", () => {
    expect(isActiveDebt(CARD)).toBe(true)
    expect(isActiveDebt({ ...LOAN, status: "paid" })).toBe(false)
    expect(isActiveDebt(RECEIVABLE)).toBe(false)
  })

  it("totales de deuda y por cobrar", () => {
    expect(totalDebt([CARD, LOAN, RECEIVABLE])).toBe(5_000_000)
    expect(isOpenEndedReceivable(OPEN_RECEIVABLE)).toBe(true)
    expect(totalReceivable([RECEIVABLE, OPEN_RECEIVABLE, CARD])).toBe(600_000)
  })

  it("porcentajes pagado y cobrado", () => {
    expect(paidPercent(LOAN)).toBe(62)
    expect(paidPercent(CARD)).toBeNull()
    expect(collectedPercent(RECEIVABLE)).toBe(40)
  })

  it("debtStatusLabel, isReceivableOverdue y hasZeroBalance", () => {
    expect(debtStatusLabel({ kind: "receivable", status: "paid" })).toEqual({
      label: "Cobrada",
      tone: "success"
    })
    expect(debtStatusLabel({ kind: "loan", status: "paid" })?.label).toBe(
      "Pagada"
    )
    expect(debtStatusLabel({ kind: "loan", status: "archived" })?.label).toBe(
      "Archivada"
    )
    expect(debtStatusLabel(CARD)).toBeNull()
    expect(isReceivableOverdue(RECEIVABLE, TODAY)).toBe(true)
    expect(isReceivableOverdue({ ...RECEIVABLE, balance: 0 }, TODAY)).toBe(
      false
    )
    expect(hasZeroBalance({ ...LOAN, balance: 0 })).toBe(true)
    expect(hasZeroBalance({ ...OPEN_RECEIVABLE, balance: 0 })).toBe(false)
  })

  it("compareByExpectedOn deja las sin fecha al final y empata por creación", () => {
    const receivables = [
      { ...RECEIVABLE, id: "sin", expected_on: null },
      { ...RECEIVABLE, id: "jul", expected_on: "2026-07-01" },
      { ...RECEIVABLE, id: "jun-b", created_at: "2026-02-01T15:00:00Z" },
      RECEIVABLE
    ]
    expect(receivables.sort(compareByExpectedOn).map((d) => d.id)).toEqual([
      "ana",
      "jun-b",
      "jul",
      "sin"
    ])
  })
})

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

describe("utilización", () => {
  it("por tarjeta y global", () => {
    expect(utilizationPercent(2_999_999, 10_000_000)).toBe(29)
    expect(utilizationPercent(-10, 100)).toBe(0)
    expect([0, 29, 30, 69, 70].map(utilizationLevel)).toEqual([
      "healthy",
      "healthy",
      "moderate",
      "moderate",
      "high"
    ])
    expect(
      globalUtilization([
        CARD,
        { ...CARD, id: "mc", credit_limit: 3_000_000, balance: 1_000_000 },
        { ...CARD, id: "old", status: "archived" }
      ])
    ).toBe(37)
    expect(globalUtilization([LOAN])).toBeNull()
  })
})

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

  it("compareByNextDue deja las sin vencimiento al final y empata por creación", () => {
    const sameDue = {
      ...LOAN,
      id: "loan-b",
      created_at: "2026-02-01T15:00:00Z"
    }
    expect(
      [RECEIVABLE, sameDue, LOAN, CARD].sort(compareByNextDue).map((d) => d.id)
    ).toEqual(["card", "loan", "loan-b", "ana"])
  })
})

describe("proyección", () => {
  it("tasa e interés del mes", () => {
    expect(monthlyRate(26.82, "ea")).toBeCloseTo(0.02, 4)
    expect(monthlyRate(1.5, "mv")).toBe(0.015)
    expect(monthlyRate(null, "ea")).toBe(0)
    expect(monthlyInterest(LOAN)).toBe(45_000)
    expect(
      totalMonthlyInterest([CARD, LOAN, RECEIVABLE])
    ).toMatchInlineSnapshot(`86569.46`)
  })

  it("projectPayoff en centavos", () => {
    expect(projectPayoff(1_000_000, 0.02, 100_000, "2026-07-05"))
      .toMatchInlineSnapshot(`
        {
          "kind": "ok",
          "months": 12,
          "payoffMonth": "2027-06",
          "totalInterest": 127032.84,
        }
      `)
    expect(projectPayoff(1_000_000, 0.02, 20_000, "2026-07-05")).toEqual({
      kind: "no_progress"
    })
    expect(projectPayoff(100_000_000, 0, 1, "2026-07-05")).toEqual({
      kind: "too_long"
    })
  })

  it("debtProjection con la cuota, el simulador o sin mínimo", () => {
    expect(debtProjection(LOAN)).toMatchInlineSnapshot(`
      {
        "kind": "ok",
        "months": 9,
        "payoffMonth": "2027-03",
        "totalInterest": 206437.26,
        "withoutRate": false,
      }
    `)
    expect(debtProjection(CARD, 1_000_000)).toMatchInlineSnapshot(`
      {
        "kind": "ok",
        "months": 3,
        "payoffMonth": "2026-08",
        "totalInterest": 64532.17,
        "withoutRate": false,
      }
    `)
    expect(debtProjection(CARD_NO_MIN)).toEqual({ kind: "needs_min_payment" })
    expect(debtProjection(RECEIVABLE)).toBeNull()
  })
})
