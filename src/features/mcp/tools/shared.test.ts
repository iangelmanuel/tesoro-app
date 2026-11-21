import { describe, expect, it } from "vitest"
import { formatTime } from "./shared"

// Caracterización (SPEC 54): recorta los segundos. El paso 9 la mueve a
// `trimSeconds` de `src/libs/dates.ts`.
describe("formatTime (MCP)", () => {
  it("recorta los segundos de Postgres", () => {
    expect(formatTime("14:30:00")).toBe("14:30")
    expect(formatTime("08:05")).toBe("08:05")
  })

  it("da null sin hora", () => {
    expect(formatTime(null)).toBeNull()
    expect(formatTime("")).toBeNull()
  })
})
