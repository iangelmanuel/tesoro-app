import type { WorkspaceType } from "@/features/workspaces/types"
import type { ExportData } from "../types"
import type { PageSetup } from "./page"
import type { PdfTheme } from "./theme"

/** Lo que comparten encabezado, pie y secciones */
export interface PdfContext {
  type: WorkspaceType
  theme: PdfTheme
  page: PageSetup
  /** "Personal" o el nombre de la empresa */
  workspaceName: string
  /** "Enero – Octubre 2026", "Octubre 2026 (en curso)" */
  period: string
  /** "7 nov 2026" */
  generated: string
  /** YYYY-MM-DD en America/Bogota */
  today: string
}

// Datos del PDF (SPEC 33) que el Excel no tiene. Parte de `ExportData` para
// que los totales cuadren con el Excel.

/** Todo lo que lleva el PDF del periodo */
export interface PdfReportData {
  /** El mismo de SPEC 32 */
  export: ExportData
  /** Periodo anterior de igual largo */
  previousTotals: { income: number; expense: number }
  /** Del periodo */
  categoryTotals: { name: string; total: number }[]
  /** Actual, Personal o Empresa */
  score: PdfScore
  /** Destino del QR */
  reportsUrl: string
}

/** Score del periodo para el PDF, o la razón por la que no hay */
export type PdfScore =
  | {
      status: "ok"
      value: number
      band: string
      factors: { name: string; weight: number; value: string; state: string }[]
      recommendations: { title: string; html: string }[]
    }
  | { status: "insufficient"; reasons: string[] }
