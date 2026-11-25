import { debtFixture } from "./fixtures"

// Deudas de ejemplo de los tests de cálculos de deudas (SPEC 55b): una
// tarjeta, un préstamo y una cuenta por cobrar, con hoy = TODAY

export const TODAY = "2026-06-15"

export const CARD = debtFixture({
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

export const LOAN = debtFixture({
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

export const RECEIVABLE = debtFixture({
  id: "ana",
  name: "Ana",
  kind: "receivable",
  schedule: "once",
  opening_balance: 1_000_000,
  balance: 600_000,
  expected_on: "2026-06-01"
})

/** Tarjeta sin pago mínimo ni cuotas: solo tiene fecha de pago */
export const CARD_NO_MIN = {
  ...CARD,
  min_payment: null,
  installments_due_current: null,
  installments_due_previous: null
}

/** Mensual indefinida: sin saldo total */
export const OPEN_RECEIVABLE = {
  ...RECEIVABLE,
  id: "open",
  schedule: "monthly" as const,
  term_months: null,
  balance: 900_000
}

/** La deuda sin pagar el ciclo anterior, creada antes de ese vencimiento */
export function unpaidPrevious<T extends typeof CARD>(
  debt: T,
  createdAt = "2026-01-01T15:00:00Z"
): T {
  return { ...debt, paid_previous_cycle: 0, created_at: createdAt }
}
