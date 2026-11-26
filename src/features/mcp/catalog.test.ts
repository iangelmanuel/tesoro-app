import { describe, expect, it } from "vitest"
import { z } from "zod"
import { MCP_TOOLS } from "./catalog"

// Instantánea del contrato del MCP (SPEC 55c): los agentes conectados
// dependen del nombre, la descripción y el esquema de entrada de cada tool.
// Si esta prueba falla, el cambio rompe a usuarios fuera de la app: no se
// actualiza la instantánea sin un spec que lo decida.

describe("contrato del MCP", () => {
  it("no repite nombres de tools", () => {
    const names = MCP_TOOLS.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("mantiene nombre, descripción y esquema de entrada de cada tool", () => {
    const contract = MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: z.toJSONSchema(tool.input, { io: "input" })
    }))
    expect(contract).toMatchSnapshot()
  })
})
