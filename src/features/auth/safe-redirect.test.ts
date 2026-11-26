import { describe, expect, it } from "vitest"
import { SITE } from "@/config/site"
import { safeRedirectPath } from "./safe-redirect"

describe("safeRedirectPath", () => {
  it("deja pasar rutas internas", () => {
    expect(safeRedirectPath("/dashboard/personal/transactions?x=1")).toBe(
      "/dashboard/personal/transactions?x=1"
    )
    expect(safeRedirectPath("/")).toBe("/")
  })

  it("bloquea open redirects y valores raros", () => {
    for (const next of [
      "//evil.com",
      String.raw`/\evil.com`,
      "https://evil.com",
      "dashboard",
      "",
      null,
      undefined,
      42
    ]) {
      expect(safeRedirectPath(next)).toBe(SITE.routes.dashboard)
    }
  })
})
