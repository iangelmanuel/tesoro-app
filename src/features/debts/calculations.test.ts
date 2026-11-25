import { describe, expect, it } from "vitest"
import {
  CARD,
  LOAN,
  OPEN_RECEIVABLE,
  RECEIVABLE,
  TODAY
} from "@/testing/debt-samples"
import {
  collectedPercent,
  compareByExpectedOn,
  compareByNextDue,
  debtStatusLabel,
  hasZeroBalance,
  isActiveDebt,
  isOpenEndedReceivable,
  isReceivableOverdue,
  paidPercent,
  totalDebt,
  totalReceivable
} from "./calculations"
import { formatRate } from "./projection"

// Tests de caracterización (SPEC 55b): fijan saldo y estado de las deudas

describe("formatos", () => {
  it("tasa con su tipo", () => {
    expect([formatRate(28.5, "ea"), formatRate(1.234, "mv")]).toEqual([
      "28,5 % E.A.",
      "1,234 % M.V."
    ])
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

describe("compareByNextDue", () => {
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
