import type { PostgrestError } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import {
  ALREADY_PAID,
  DEFAULT_ERROR,
  INVALID_CATEGORY,
  toServiceError
} from "./transaction-errors"

function pgError(
  fields: Partial<Pick<PostgrestError, "code" | "message" | "hint">>
): PostgrestError {
  return {
    name: "PostgrestError",
    code: "",
    message: "",
    hint: "",
    details: "",
    ...fields
  } as PostgrestError
}

describe("toServiceError", () => {
  it("manda el exceso del reparto al campo del monto", () => {
    expect(
      toServiceError(
        pgError({ hint: "allocation_exceeds_end", message: "Sobra monto" })
      )
    ).toEqual({ ok: false, fieldErrors: { amount: ["Sobra monto"] } })
  })

  it("trata el índice único como pago ya registrado", () => {
    expect(toServiceError(pgError({ code: "23505" }))).toEqual({
      ok: false,
      error: ALREADY_PAID
    })
  })

  it("marca la cuenta archivada antes que los códigos de categoría", () => {
    expect(
      toServiceError(
        pgError({ code: "23514", message: "La cuenta está archivada" })
      )
    ).toEqual({
      ok: false,
      fieldErrors: { account_id: ["La cuenta está archivada"] }
    })
  })

  it("distingue la FK de la cuenta de la de la categoría", () => {
    expect(
      toServiceError(
        pgError({ code: "23503", message: "violates fk on account_id" })
      )
    ).toEqual({
      ok: false,
      fieldErrors: { account_id: ["Elige una cuenta válida"] }
    })
    expect(toServiceError(pgError({ code: "23503" }))).toEqual({
      ok: false,
      fieldErrors: { category_id: [INVALID_CATEGORY] }
    })
  })

  it("manda el traspaso desde la misma cuenta al campo de origen", () => {
    expect(
      toServiceError(pgError({ message: "violates transfers_check" }))
    ).toEqual({
      ok: false,
      fieldErrors: {
        transfer_from: ["Elige una cuenta distinta a la que paga"]
      }
    })
  })

  it("traduce RLS y el check de categoría", () => {
    expect(toServiceError(pgError({ code: "42501" }))).toEqual({
      ok: false,
      error: "No tienes permiso para modificar este movimiento"
    })
    expect(toServiceError(pgError({ code: "23514" }))).toEqual({
      ok: false,
      fieldErrors: { category_id: [INVALID_CATEGORY] }
    })
  })

  it("cae al error genérico", () => {
    expect(toServiceError(pgError({ code: "XX000" }))).toEqual({
      ok: false,
      error: DEFAULT_ERROR
    })
  })
})
