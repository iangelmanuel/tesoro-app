import { describe, expect, it } from "vitest"
import {
  type TransferValues,
  applyTransferPatch,
  sortRowErrors,
  toTransferInput,
  transferAccountChecks,
  transferPreview,
  transfersLabel
} from "./transfer-input"

const VALUES: TransferValues = {
  from_account_id: "a1",
  to_account_id: "a2",
  amount: 100,
  occurred_on: "2026-10-05",
  time: null,
  note: "  "
}

describe("transfersLabel", () => {
  it("singular y plural", () => {
    expect(transfersLabel(1, "creado")).toBe("1 traspaso creado")
    expect(transfersLabel(3, "borrado")).toBe("3 traspasos borrados")
  })
})

describe("toTransferInput y transferPreview", () => {
  it("vacíos como texto del formulario; nota en blanco a null", () => {
    expect(toTransferInput(VALUES)).toMatchObject({
      occurred_time: "",
      note: "  "
    })
    expect(transferPreview(VALUES).note).toBeNull()
  })
})

describe("applyTransferPatch", () => {
  it("solo los campos enviados; null sí cambia", () => {
    expect(
      applyTransferPatch(
        { ...VALUES, time: "08:00", note: "x" },
        { amount: 50, time: null, note: undefined }
      )
    ).toEqual({ ...VALUES, amount: 50, time: null, note: "x" })
  })
})

describe("transferAccountChecks y sortRowErrors", () => {
  it("origen y destino de cada fila", () => {
    expect(
      transferAccountChecks([
        { index: 2, data: { ...toTransferInput(VALUES), occurred_time: "" } }
      ] as never)
    ).toEqual([
      { index: 2, accountId: "a1", field: "from_account_id" },
      { index: 2, accountId: "a2", field: "to_account_id" }
    ])
  })

  it("ordena por fila", () => {
    expect(
      sortRowErrors([
        { index: 3, message: "c" },
        { index: 1, message: "a" }
      ]).map((error) => error.index)
    ).toEqual([1, 3])
  })
})
