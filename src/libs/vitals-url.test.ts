import { describe, expect, it } from "vitest"
import { normalizeVitalsUrl } from "./vitals-url"

const ORIGIN = "https://tesoro.example"
const UUID = "3f2b8c1e-9a4d-4e7b-8f21-6c0d5a9e1b34"

describe("normalizeVitalsUrl", () => {
  it("quita el query string y el hash", () => {
    expect(normalizeVitalsUrl(`${ORIGIN}/sign-in?next=%2Fdashboard`)).toBe(
      `${ORIGIN}/sign-in`
    )
    expect(
      normalizeVitalsUrl(
        `${ORIGIN}/dashboard/personal/transactions?q=mercado&category=x#fila`
      )
    ).toBe(`${ORIGIN}/dashboard/personal/transactions`)
  })

  it("cambia el id de la empresa por [id]", () => {
    expect(normalizeVitalsUrl(`${ORIGIN}/dashboard/business/${UUID}`)).toBe(
      `${ORIGIN}/dashboard/business/[id]`
    )
    expect(
      normalizeVitalsUrl(
        `${ORIGIN}/dashboard/business/${UUID}/cash-flow?month=2026-11`
      )
    ).toBe(`${ORIGIN}/dashboard/business/[id]/cash-flow`)
  })

  it("deja igual las rutas sin id", () => {
    expect(normalizeVitalsUrl(`${ORIGIN}/`)).toBe(`${ORIGIN}/`)
    expect(normalizeVitalsUrl(`${ORIGIN}/dashboard/business`)).toBe(
      `${ORIGIN}/dashboard/business`
    )
    expect(normalizeVitalsUrl(`${ORIGIN}/legal/privacy`)).toBe(
      `${ORIGIN}/legal/privacy`
    )
  })

  it("también normaliza una ruta relativa", () => {
    expect(normalizeVitalsUrl(`/dashboard/business/${UUID}/reports?x=1`)).toBe(
      "/dashboard/business/[id]/reports"
    )
  })
})
