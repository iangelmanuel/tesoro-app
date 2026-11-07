import type { Workspace } from "@/features/workspaces/queries"
import { loadExportData } from "../queries"
import type { ExportRange } from "../types"
import type { PdfReportData } from "./types"

// Datos del PDF (SPEC 33), con la sesión del usuario y RLS. Parte de
// `loadExportData` (SPEC 32) para que los totales cuadren con el Excel.
// Provisional: los totales del periodo anterior, las categorías, el score y
// la URL del QR llegan en los pasos 6, 10 y 12 del spec.
export async function loadPdfData(
  workspace: Workspace,
  range: ExportRange,
  today: string
): Promise<PdfReportData> {
  const data = await loadExportData(workspace, range, today)

  return {
    export: data,
    previousTotals: { income: 0, expense: 0 },
    categoryTotals: [],
    score: { status: "insufficient", reasons: [] },
    reportsUrl: ""
  }
}
