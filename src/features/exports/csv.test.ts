import { describe, expect, it } from "vitest"
import { buildMovementsCsv } from "./csv"
import type { ExportMovementRow } from "./types"

const BOM = String.fromCharCode(0xfeff)

const row = (
  overrides: Partial<ExportMovementRow> = {}
): ExportMovementRow => ({
  month: "2026-10",
  date: "2026-10-05",
  time: null,
  kind: "Salida",
  description: "Mercado",
  category: "Comida",
  account: "Banco",
  destination: null,
  note: null,
  amount: 1500.5,
  ...overrides
})

describe("buildMovementsCsv", () => {
  it("Personal: BOM, `;`, decimales con coma y \\r\\n", () => {
    expect(buildMovementsCsv("personal", [row({ time: "14:30" })])).toBe(
      `${BOM}Mes;Fecha;Hora;Tipo;Descripción;Categoría;Cuenta;Destino;Nota;Monto\r\n` +
        "2026-10;2026-10-05;14:30;Salida;Mercado;Comida;Banco;;;1500,5\r\n"
    )
  })

  it("Empresa suma Contraparte y Factura antes del monto", () => {
    expect(
      buildMovementsCsv("business", [
        row({ kind: "Entrada", counterparty: "Cliente", invoiceRef: "F-1" })
      ])
    ).toBe(
      `${BOM}Mes;Fecha;Hora;Tipo;Descripción;Categoría;Cuenta;Destino;Nota;Contraparte;Factura;Monto\r\n` +
        "2026-10;2026-10-05;;Entrada;Mercado;Comida;Banco;;;Cliente;F-1;1500,5\r\n"
    )
  })

  it("comillas si hace falta; las fórmulas van con apóstrofo y entre comillas", () => {
    const csv = buildMovementsCsv("personal", [
      row({ description: "a;b", note: "=SUM(A1)", amount: 10 })
    ])
    expect(csv.split("\r\n")[1]).toBe(
      `2026-10;2026-10-05;;Salida;"a;b";Comida;Banco;;"'=SUM(A1)";10`
    )
  })

  it("sin filas, el encabezado y una línea vacía", () => {
    expect(buildMovementsCsv("personal", [])).toBe(
      `${BOM}Mes;Fecha;Hora;Tipo;Descripción;Categoría;Cuenta;Destino;Nota;Monto\r\n\r\n`
    )
  })
})
