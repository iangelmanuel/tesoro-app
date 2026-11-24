import { describe, expect, it } from "vitest"
import {
  calculatedBalanceAt,
  calculatedLabel,
  differenceTone,
  isLargeDifference,
  reconcileDifference
} from "./reconcile"

// Intl en es-CO separa con espacio duro (U+00A0)
const NBSP = String.fromCharCode(0xa0)

const TODAY = "2026-11-24"

describe("calculatedBalanceAt", () => {
  const fetched = { date: "2026-11-01", balance: 500 }

  it("hoy usa el saldo de la cuenta", () => {
    expect(calculatedBalanceAt(TODAY, TODAY, 1000, fetched)).toBe(1000)
  })

  it("otra fecha usa el saldo que llegó para ella", () => {
    expect(calculatedBalanceAt("2026-11-01", TODAY, 1000, fetched)).toBe(500)
    expect(
      calculatedBalanceAt("2026-11-01", TODAY, 1000, {
        date: "2026-11-01",
        balance: null
      })
    ).toBeNull()
  })

  it("mientras llega el de otra fecha da undefined", () => {
    expect(
      calculatedBalanceAt("2026-10-15", TODAY, 1000, fetched)
    ).toBeUndefined()
  })
})

describe("reconcileDifference", () => {
  it("resta el calculado al real, con signo y en centavos", () => {
    expect(reconcileDifference("1.500", 1000)).toBe(500)
    expect(reconcileDifference("-50", 0)).toBe(-50)
    expect(reconcileDifference("0,3", 0.1)).toBe(0.2)
  })

  it("da null sin real o sin calculado", () => {
    expect(reconcileDifference("   ", 1000)).toBeNull()
    expect(reconcileDifference("1.000", undefined)).toBeNull()
    expect(reconcileDifference("1.000", null)).toBeNull()
  })
})

describe("isLargeDifference", () => {
  it("avisa por monto o por porcentaje del calculado", () => {
    expect(isLargeDifference(50001, 10_000_000)).toBe(true)
    expect(isLargeDifference(600, 10_000)).toBe(true)
  })

  it("no avisa con diferencias chicas, cero o sin datos", () => {
    expect(isLargeDifference(400, 10_000)).toBe(false)
    expect(isLargeDifference(0, 10_000)).toBe(false)
    expect(isLargeDifference(null, 10_000)).toBe(false)
    expect(isLargeDifference(100, undefined)).toBe(false)
  })
})

describe("differenceTone", () => {
  it("sube en verde, baja en rojo, cero o nada neutro", () => {
    expect(differenceTone(10)).toBe("success")
    expect(differenceTone(-10)).toBe("danger")
    expect(differenceTone(0)).toBe("neutral")
    expect(differenceTone(null)).toBe("neutral")
  })
})

describe("calculatedLabel", () => {
  it("calculando, no disponible o el monto", () => {
    expect(calculatedLabel(undefined, "COP")).toBe("Calculando...")
    expect(calculatedLabel(null, "COP")).toBe("No disponible")
    expect(calculatedLabel(1500, "COP")).toBe(`$${NBSP}1.500,00`)
  })
})
