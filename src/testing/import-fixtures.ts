import type { SourceTable } from "@/features/imports/normalize-values"
import type { DetectedTable, ImportConfig } from "@/features/imports/types"

// Insumos de los tests del importador (SPEC 55c): una tabla con encabezados
// en la fila 1 de "Hoja1" y una configuración neutra.

/** Tabla con `headers` en la fila 1 y `rows` debajo (la 2 es la primera) */
export function importSourceFixture(
  headers: string[],
  rows: unknown[][]
): SourceTable {
  const table: DetectedTable = {
    sheet: "Hoja1",
    headerRow: 0,
    startCol: 0,
    endCol: headers.length - 1,
    headers
  }
  return { table, cells: [headers, ...rows] }
}

/** Configuración del asistente: por signo, fechas día/mes/año, sin mapeos */
export function importConfigFixture(
  fields: Partial<ImportConfig>
): ImportConfig {
  return {
    mapping: {},
    typeMode: "sign",
    dateFormat: "dmy",
    typeValues: {},
    entryTypeMode: "column",
    entryTypeValues: {},
    frequencyValues: {},
    fixedLinkId: null,
    ...fields
  }
}
