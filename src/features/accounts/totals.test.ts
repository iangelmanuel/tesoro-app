import { describe, expect, it } from "vitest"
import { activeAccountsBalance } from "./totals"

describe("activeAccountsBalance", () => {
  it("suma solo las cuentas no archivadas", () => {
    expect(
      activeAccountsBalance([
        { balance: 100, archived_at: null },
        { balance: -30, archived_at: null },
        { balance: 999, archived_at: "2026-01-01T00:00:00Z" }
      ])
    ).toBe(70)
  })

  it("da cero sin cuentas", () => {
    expect(activeAccountsBalance([])).toBe(0)
  })
})
