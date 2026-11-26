import { describe, expect, it } from "vitest"
import { DEBT_NOT_ACTIVE, DEBT_NOT_ACTIVE_DB } from "@/features/debts/errors"
import {
  DEFAULT_ERROR,
  INVALID_ACCOUNT,
  INVALID_CATEGORY,
  UNDO_NOT_FOUND,
  rpcErrorMessage,
  transactionImportErrorMessage,
  undoErrorMessage
} from "./import-errors"

describe("rpcErrorMessage", () => {
  it("mensajes de las RPC tal cual, salvo el de deuda inactiva", () => {
    expect(
      rpcErrorMessage({ code: "P0001", message: "La meta no existe" })
    ).toBe("La meta no existe")
    expect(
      rpcErrorMessage({ code: "P0001", message: DEBT_NOT_ACTIVE_DB })
    ).toBe(DEBT_NOT_ACTIVE)
  })

  it("códigos de Postgres y el genérico", () => {
    expect(rpcErrorMessage({ code: "23503", message: "fk" })).toBe(
      INVALID_CATEGORY
    )
    expect(rpcErrorMessage({ code: "42501", message: "x" })).toBe(
      "No tienes permiso para importar en este espacio"
    )
    expect(rpcErrorMessage({ code: "XX000", message: "x" })).toBe(DEFAULT_ERROR)
  })
})

describe("transactionImportErrorMessage", () => {
  it("errores de cuentas antes que los de categoría", () => {
    expect(
      transactionImportErrorMessage({
        code: "23505",
        message: 'violates unique constraint "accounts_unique_name"'
      })
    ).toBe(
      "Ya existe una cuenta con uno de los nombres nuevos (puede estar archivada). Mapéala a la existente o restáurala"
    )
    expect(
      transactionImportErrorMessage({
        code: "23503",
        message: "insert violates foreign key on account_id"
      })
    ).toBe(INVALID_ACCOUNT)
    expect(
      transactionImportErrorMessage({
        code: "P0001",
        message: "La cuenta está archivada"
      })
    ).toBe(INVALID_ACCOUNT)
  })

  it("el resto por código; los mensajes de RPC no se muestran", () => {
    expect(
      transactionImportErrorMessage({ code: "23505", message: "categories" })
    ).toBe(
      "Ya existe una categoría con uno de los nombres nuevos. Mapéala a la existente"
    )
    expect(
      transactionImportErrorMessage({
        code: "P0001",
        message: "La meta no existe"
      })
    ).toBe(DEFAULT_ERROR)
  })
})

describe("undoErrorMessage", () => {
  it("ajena, ya deshecha y la que nombra la deuda", () => {
    expect(undoErrorMessage({ code: "P0002", message: "x" })).toBe(
      UNDO_NOT_FOUND
    )
    expect(
      undoErrorMessage({
        code: "P0001",
        message: "La importación ya se deshizo"
      })
    ).toBe("Esta importación ya se deshizo")
    expect(
      undoErrorMessage({
        code: "23514",
        message: "El saldo de «Visa» quedaría negativo"
      })
    ).toBe("El saldo de «Visa» quedaría negativo")
  })

  it("mensajes conocidos y el genérico", () => {
    expect(
      undoErrorMessage({
        code: "P0001",
        message: "No puedes retirar más de lo ahorrado"
      })
    ).toBe("No puedes retirar más de lo ahorrado")
    expect(undoErrorMessage({ code: "23514", message: "sin nombre" })).toBe(
      "No se pudo deshacer la importación. Intenta de nuevo"
    )
  })
})
