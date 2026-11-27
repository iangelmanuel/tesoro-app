import { describe, expect, it } from "vitest"
import { mountsOn, parseViewport } from "./viewport"

describe("parseViewport", () => {
  it("acepta mobile y desktop", () => {
    expect(parseViewport("mobile")).toBe("mobile")
    expect(parseViewport("desktop")).toBe("desktop")
  })

  it("sin cookie o con un valor inválido monta los dos", () => {
    expect(parseViewport(undefined)).toBe("unknown")
    expect(parseViewport("")).toBe("unknown")
    expect(parseViewport("tablet")).toBe("unknown")
  })
})

describe("mountsOn", () => {
  it("monta solo lo del viewport conocido", () => {
    expect(mountsOn("mobile", "mobile")).toBe(true)
    expect(mountsOn("mobile", "desktop")).toBe(false)
    expect(mountsOn("desktop", "desktop")).toBe(true)
    expect(mountsOn("desktop", "mobile")).toBe(false)
  })

  it("sin viewport conocido monta los dos", () => {
    expect(mountsOn("unknown", "mobile")).toBe(true)
    expect(mountsOn("unknown", "desktop")).toBe(true)
  })
})
