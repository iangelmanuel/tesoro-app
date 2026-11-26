import { describe, expect, it } from "vitest"
import type { McpContext } from "../types"
import {
  WORKSPACE_NOT_FOUND,
  WORKSPACE_NOT_WRITABLE,
  afterCursorFilter,
  decodeCursor,
  encodeCursor,
  limitSchema,
  monthSchema,
  needsInput,
  resolveWorkspace
} from "./shared"

const ROW = {
  occurred_on: "2026-10-05",
  day_position: 2,
  created_at: "2026-10-05T14:30:00.123+00:00",
  id: "6f1c3d2e-8a4b-4c5d-9e6f-0a1b2c3d4e5f"
}

describe("cursor", () => {
  it("encode y decode son inversos", () => {
    expect(decodeCursor(encodeCursor(ROW))).toEqual({
      d: ROW.occurred_on,
      p: ROW.day_position,
      c: ROW.created_at,
      i: ROW.id
    })
  })

  it("un cursor inválido da null", () => {
    expect(decodeCursor("no-es-base64-json")).toBeNull()
    expect(
      decodeCursor(Buffer.from('{"d":"x"}').toString("base64url"))
    ).toBeNull()
  })

  it("afterCursorFilter sigue el orden de la lista", () => {
    const cursor = decodeCursor(encodeCursor(ROW))!
    expect(afterCursorFilter(cursor)).toBe(
      [
        'occurred_on.lt."2026-10-05"',
        'and(occurred_on.eq."2026-10-05",day_position.gt.2)',
        'and(occurred_on.eq."2026-10-05",day_position.eq.2,created_at.lt."2026-10-05T14:30:00.123+00:00")',
        'and(occurred_on.eq."2026-10-05",day_position.eq.2,created_at.eq."2026-10-05T14:30:00.123+00:00",id.gt.6f1c3d2e-8a4b-4c5d-9e6f-0a1b2c3d4e5f)'
      ].join(",")
    )
  })
})

describe("esquemas", () => {
  it("monthSchema y limitSchema", () => {
    expect(monthSchema.safeParse("2026-13").success).toBe(false)
    expect(monthSchema.safeParse("2026-12").success).toBe(true)
    expect(limitSchema.parse(undefined)).toBe(50)
    expect(limitSchema.safeParse(201).success).toBe(false)
  })
})

describe("needsInput", () => {
  it("no escribe y devuelve las preguntas", () => {
    const missing = [
      { field: "account_id", question: "¿De qué cuenta?" },
      {
        field: "category_id",
        row: 2,
        question: "¿Qué categoría?",
        options: [{ id: "c1", label: "Comida" }]
      }
    ]
    expect(needsInput(missing)).toEqual({
      content: [
        {
          type: "text",
          text: "No se guardó nada. Faltan datos; pregúntale al usuario:\n- ¿De qué cuenta?\n- Fila 2: ¿Qué categoría?"
        }
      ],
      structuredContent: { status: "needs_input", missing }
    })
  })
})

describe("resolveWorkspace", () => {
  const id = "6f1c3d2e-8a4b-4c5d-9e6f-0a1b2c3d4e5f"

  function ctx(row: Record<string, unknown> | null) {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: row, error: null })
    }
    return { supabase: { from: () => query } } as unknown as McpContext
  }

  const row = {
    id,
    type: "business",
    name: "Tienda",
    deletion_requested_at: "2026-11-01T00:00:00Z"
  }

  it("id que no es uuid o que no se ve", async () => {
    expect(await resolveWorkspace(ctx(row), "x")).toEqual({
      error: WORKSPACE_NOT_FOUND
    })
    expect(await resolveWorkspace(ctx(null), id)).toEqual({
      error: WORKSPACE_NOT_FOUND
    })
  })

  it("marcado para borrar solo se rechaza al escribir", async () => {
    expect(await resolveWorkspace(ctx(row), id)).toEqual({
      id,
      type: "business",
      name: "Tienda",
      deletionRequestedAt: "2026-11-01T00:00:00Z"
    })
    expect(await resolveWorkspace(ctx(row), id, { writable: true })).toEqual({
      error: WORKSPACE_NOT_WRITABLE
    })
  })
})
