import { describe, expect, it } from "vitest"
import {
  balanceAfterIncome,
  paymentShortfall,
  resolveTransferSource,
  transferSources
} from "./payment-account"

const ACCOUNTS = [
  { id: "a", balance: 100, archived_at: null },
  { id: "b", balance: 500, archived_at: null },
  { id: "c", balance: 900, archived_at: "2026-01-01T00:00:00Z" },
  { id: "d", balance: 300, archived_at: null }
]

describe("paymentShortfall", () => {
  it("da lo que falta para cubrir el monto", () => {
    expect(paymentShortfall(100, 150.5)).toBe(50.5)
  })

  it("redondea a dos decimales", () => {
    expect(paymentShortfall(0.1, 0.3)).toBe(0.2)
  })

  it("da 0 si el saldo alcanza", () => {
    expect(paymentShortfall(200, 150)).toBe(0)
  })

  it("da 0 sin un monto válido", () => {
    expect(paymentShortfall(0, null)).toBe(0)
    expect(paymentShortfall(0, Number.NaN)).toBe(0)
    expect(paymentShortfall(0, 0)).toBe(0)
    expect(paymentShortfall(0, -10)).toBe(0)
  })
})

describe("balanceAfterIncome", () => {
  it("suma el monto al saldo con dos decimales", () => {
    expect(balanceAfterIncome(0.1, 0.2)).toBe(0.3)
    expect(balanceAfterIncome(-50, 20)).toBe(-30)
  })

  it("da null sin un monto válido", () => {
    expect(balanceAfterIncome(10, null)).toBeNull()
    expect(balanceAfterIncome(10, Number.NaN)).toBeNull()
    expect(balanceAfterIncome(10, 0)).toBeNull()
  })
})

describe("transferSources", () => {
  it("da las activas distintas a la que paga, de mayor a menor saldo", () => {
    expect(transferSources(ACCOUNTS, "a").map((account) => account.id)).toEqual(
      ["b", "d"]
    )
  })
})

describe("resolveTransferSource", () => {
  it("respeta la cuenta elegida si es válida", () => {
    expect(resolveTransferSource(ACCOUNTS, "a", "d")).toBe("d")
  })

  it("cae a la de mayor saldo si la elegida no sirve", () => {
    expect(resolveTransferSource(ACCOUNTS, "a", "c")).toBe("b")
    expect(resolveTransferSource(ACCOUNTS, "a", "a")).toBe("b")
    expect(resolveTransferSource(ACCOUNTS, "a", "")).toBe("b")
  })

  it("da vacío sin cuentas posibles", () => {
    expect(resolveTransferSource([ACCOUNTS[0]], "a", "")).toBe("")
  })
})
