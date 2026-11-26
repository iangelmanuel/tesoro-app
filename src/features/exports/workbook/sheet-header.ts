import type { Workbook, Worksheet } from "exceljs"
import { columnLetter } from "./cells"
import { LOGO_PNG_BASE64 } from "./logo-data"
import { COLORS, type WorkbookPalette } from "./theme"

/** Filas de la cabecera de la hoja (título, subtítulo, línea) */
export const HEADER_ROWS = 3

/**
 * Cabecera de la hoja: logo, título grande, subtítulo y una línea del color
 * del espacio debajo. Ocupa las filas 1 a 3; la primera tabla va en la 5.
 */
export function writeSheetHeader(
  workbook: Workbook,
  sheet: Worksheet,
  palette: WorkbookPalette,
  options: { title: string; subtitle: string; width: number }
) {
  const width = Math.max(options.width, 2)
  const lastColumn = columnLetter(width)

  sheet.mergeCells(`B1:${lastColumn}1`)
  sheet.mergeCells(`B2:${lastColumn}2`)

  const title = sheet.getCell("B1")
  title.value = options.title
  title.font = { bold: true, size: 20, color: { argb: COLORS.ink } }
  title.alignment = { vertical: "bottom", indent: 1 }

  const subtitle = sheet.getCell("B2")
  subtitle.value = options.subtitle
  subtitle.font = { size: 11, color: { argb: COLORS.muted } }
  subtitle.alignment = { vertical: "top", indent: 1 }

  sheet.getRow(1).height = 30
  sheet.getRow(2).height = 20
  sheet.getRow(3).height = 8

  // Línea del color del espacio bajo la cabecera
  for (let col = 1; col <= width; col++) {
    sheet.getCell(3, col).border = {
      bottom: { style: "medium", color: { argb: palette.accent } }
    }
  }

  sheet.addImage(logoImage(workbook), {
    tl: { col: 0.2, row: 0.15 },
    ext: { width: 40, height: 40 },
    editAs: "oneCell"
  })
  // La columna A lleva el logo: al menos su ancho
  const first = sheet.getColumn(1)
  first.width = Math.max(first.width ?? 0, 8)
}

// Una sola imagen por libro, compartida por todas las hojas
const LOGO_IDS = new WeakMap<Workbook, number>()

function logoImage(workbook: Workbook) {
  let id = LOGO_IDS.get(workbook)
  if (id === undefined) {
    id = workbook.addImage({ base64: LOGO_PNG_BASE64, extension: "png" })
    LOGO_IDS.set(workbook, id)
  }
  return id
}

/** Fila de la primera tabla, debajo de la cabecera */
export const FIRST_SECTION_ROW = HEADER_ROWS + 2
