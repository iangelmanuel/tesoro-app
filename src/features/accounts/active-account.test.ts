import { describe, expect, it } from "vitest"
import { activeAccountId } from "./active-account"

const ACCOUNTS = [
  { id: "a", archived_at: null },
  { id: "b", archived_at: "2026-01-01T00:00:00Z" }
]

describe("activeAccountId", () => {
  it("devuelve la cuenta si sigue activa", () => {
    expect(activeAccountId(ACCOUNTS, "a")).toBe("a")
  })

  it("da null si está archivada o no existe", () => {
    expect(activeAccountId(ACCOUNTS, "b")).toBeNull()
    expect(activeAccountId(ACCOUNTS, "z")).toBeNull()
  })

  it("da null sin cuenta", () => {
    expect(activeAccountId(ACCOUNTS, null)).toBeNull()
    expect(activeAccountId(ACCOUNTS, undefined)).toBeNull()
    expect(activeAccountId(ACCOUNTS, "")).toBeNull()
  })
})
