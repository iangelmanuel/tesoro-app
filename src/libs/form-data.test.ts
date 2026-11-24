import { describe, expect, it } from "vitest"
import { readFormValues } from "./form-data"

describe("readFormValues", () => {
  it("lee solo los campos pedidos", () => {
    const formData = new FormData()
    formData.set("name", "Banco")
    formData.set("kind", "bank")
    formData.set("extra", "x")

    expect(readFormValues(formData, ["name", "kind"])).toEqual({
      name: "Banco",
      kind: "bank"
    })
  })

  it("deja vacíos los campos ausentes o que no son texto", () => {
    const formData = new FormData()
    formData.set("file", new Blob(["a"]), "a.txt")

    expect(readFormValues(formData, ["file", "missing"])).toEqual({
      file: "",
      missing: ""
    })
  })
})
