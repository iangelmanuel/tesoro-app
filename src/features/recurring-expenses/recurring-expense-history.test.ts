import { describe, expect, it } from "vitest"
import {
  canDuplicatePayment,
  hasFutureOccurrences,
  nextUnpaidPayment,
  periodLabel
} from "./recurring-expense-history"

// Del más reciente al más antiguo, como llega el historial
const PAYMENTS = [
  { dueOn: "2026-06-05", transactionId: null },
  { dueOn: "2026-05-05", transactionId: null },
  { dueOn: "2026-04-05", transactionId: "tx" }
]

describe("periodLabel", () => {
  it("da mes y año en los mensuales y el año en los anuales", () => {
    expect(periodLabel({ dueOn: "2026-10-05" }, false)).toMatchInlineSnapshot(
      `"octubre de 2026"`
    )
    expect(periodLabel({ dueOn: "2026-10-05" }, true)).toBe("2026")
  })
})

describe("nextUnpaidPayment", () => {
  it("da el periodo sin pagar más antiguo", () => {
    expect(nextUnpaidPayment(PAYMENTS)?.dueOn).toBe("2026-05-05")
    expect(nextUnpaidPayment([PAYMENTS[2]])).toBeNull()
  })
})

describe("hasFutureOccurrences", () => {
  it("sin fin o con fin después del mes, quedan ocurrencias", () => {
    expect(hasFutureOccurrences({ ends_on: null }, "2026-06")).toBe(true)
    expect(hasFutureOccurrences({ ends_on: "2026-07-01" }, "2026-06")).toBe(
      true
    )
    expect(hasFutureOccurrences({ ends_on: "2026-06-30" }, "2026-06")).toBe(
      false
    )
  })
})

describe("canDuplicatePayment", () => {
  it("se puede con ocurrencias futuras o alguna sin pagar después", () => {
    expect(canDuplicatePayment(PAYMENTS, PAYMENTS[2], false)).toBe(true)
    expect(canDuplicatePayment(PAYMENTS, PAYMENTS[0], false)).toBe(false)
    expect(canDuplicatePayment(PAYMENTS, PAYMENTS[0], true)).toBe(true)
  })
})
