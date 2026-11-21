import { describe, expect, it } from "vitest"
import { allocateOldestFirst } from "./allocate"

describe("allocateOldestFirst", () => {
  it("llena los periodos en el orden recibido", () => {
    expect(
      allocateOldestFirst(
        [
          { key: "2026-01-01", due: 100 },
          { key: "2026-02-01", due: 100 },
          { key: "2026-03-01", due: 100 }
        ],
        150
      )
    ).toEqual({
      allocations: [
        { key: "2026-01-01", amount: 100 },
        { key: "2026-02-01", amount: 50 }
      ],
      leftover: 0
    })
  })

  it("deja en `leftover` lo que no cabe", () => {
    expect(allocateOldestFirst([{ key: "a", due: 40 }], 100)).toEqual({
      allocations: [{ key: "a", amount: 40 }],
      leftover: 60
    })
  })

  it("salta los periodos sin saldo", () => {
    expect(
      allocateOldestFirst(
        [
          { key: "a", due: 0 },
          { key: "b", due: -10 },
          { key: "c", due: 30 }
        ],
        20
      )
    ).toEqual({ allocations: [{ key: "c", amount: 20 }], leftover: 0 })
  })

  it("trabaja en centavos sin errores de coma flotante", () => {
    expect(
      allocateOldestFirst(
        [
          { key: "a", due: 0.1 },
          { key: "b", due: 0.2 }
        ],
        0.3
      )
    ).toEqual({
      allocations: [
        { key: "a", amount: 0.1 },
        { key: "b", amount: 0.2 }
      ],
      leftover: 0
    })
  })

  it("trata un monto negativo o cero como nada", () => {
    expect(allocateOldestFirst([{ key: "a", due: 10 }], -5)).toEqual({
      allocations: [],
      leftover: 0
    })
    expect(allocateOldestFirst([{ key: "a", due: 10 }], 0)).toEqual({
      allocations: [],
      leftover: 0
    })
  })

  it("sin periodos, todo es `leftover`", () => {
    expect(allocateOldestFirst([], 12.34)).toEqual({
      allocations: [],
      leftover: 12.34
    })
  })
})
