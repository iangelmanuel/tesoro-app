import { describe, expect, it } from "vitest"
import { isOwnAvatarPath } from "./avatar"

const USER = "6f1c3d2e-8a4b-4c5d-9e6f-0a1b2c3d4e5f"
const FILE = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d.webp"

describe("isOwnAvatarPath", () => {
  it("solo un .webp con nombre uuid en la carpeta propia", () => {
    expect(isOwnAvatarPath(USER, `${USER}/${FILE}`)).toBe(true)
  })

  it("rechaza otras carpetas, otros archivos y valores raros", () => {
    expect(isOwnAvatarPath(USER, `otro/${FILE}`)).toBe(false)
    expect(isOwnAvatarPath(USER, `${USER}/foto.webp`)).toBe(false)
    expect(
      isOwnAvatarPath(USER, `${USER}/${FILE.replace("webp", "png")}`)
    ).toBe(false)
    expect(isOwnAvatarPath(USER, `${USER}/../${FILE}`)).toBe(false)
    expect(isOwnAvatarPath(USER, null)).toBe(false)
  })
})
