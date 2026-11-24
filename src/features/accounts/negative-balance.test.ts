import { describe, expect, it } from "vitest"
import { isNegativeAccount } from "./negative-balance"

describe("isNegativeAccount", () => {
  it("marca billeteras y bancos activos con saldo negativo", () => {
    expect(
      isNegativeAccount({ kind: "wallet", balance: -1, archived_at: null })
    ).toBe(true)
    expect(
      isNegativeAccount({ kind: "bank", balance: -0.01, archived_at: null })
    ).toBe(true)
  })

  it("no marca saldo cero o positivo", () => {
    expect(
      isNegativeAccount({ kind: "bank", balance: 0, archived_at: null })
    ).toBe(false)
    expect(
      isNegativeAccount({ kind: "wallet", balance: 10, archived_at: null })
    ).toBe(false)
  })

  it("deja fuera efectivo y otra", () => {
    expect(
      isNegativeAccount({ kind: "cash", balance: -5, archived_at: null })
    ).toBe(false)
    expect(
      isNegativeAccount({ kind: "other", balance: -5, archived_at: null })
    ).toBe(false)
  })

  it("deja fuera las cuentas archivadas", () => {
    expect(
      isNegativeAccount({
        kind: "bank",
        balance: -5,
        archived_at: "2026-01-01T00:00:00Z"
      })
    ).toBe(false)
  })
})
