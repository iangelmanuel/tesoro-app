import Papa from "papaparse"
import type { WorkspaceType } from "@/features/workspaces/queries"
import { movementColumns } from "./columns"
import type { ExportMovementRow } from "./types"

// CSV para Excel en es-CO: UTF-8 con BOM (tildes y ñ al abrir con doble
// clic), separador `;`, montos sin separador de miles y decimales con coma,
// fechas YYYY-MM-DD y saltos \r\n.

const BOM = "﻿"

function formatAmount(amount: number) {
  return String(amount).replace(".", ",")
}

export function buildMovementsCsv(
  type: WorkspaceType,
  rows: ExportMovementRow[]
) {
  const columns = movementColumns(type)

  const csv = Papa.unparse(
    {
      fields: columns.map((column) => column.header),
      data: rows.map((row) =>
        columns.map(({ key, kind }) => {
          const value = row[key]
          if (kind === "money") return formatAmount(Number(value))
          return value ?? ""
        })
      )
    },
    {
      delimiter: ";",
      newline: "\r\n",
      // Comillas dobles solo cuando el campo tiene `;`, comillas o saltos
      quotes: false,
      // Apóstrofo delante de =, +, -, @, tabulación y retorno: evita que el
      // archivo ejecute fórmulas al abrirlo
      escapeFormulae: true
    }
  )

  return `${BOM}${csv}\r\n`
}
