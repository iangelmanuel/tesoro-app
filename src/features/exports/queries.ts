import "server-only"
import type { Workspace } from "@/features/workspaces/queries"
import { createClient } from "@/libs/supabase/server"
import { loadBusinessExport } from "./business-export-queries"
import { loadPersonalExport } from "./personal-export-queries"
import type { ExportData, ExportRange } from "./types"

// Entrada de las lecturas de la exportación. Cada sección del archivo lee de
// su módulo: lo común (nombres, movimientos y saldos) en
// movement-export-queries.ts, las hojas de Personal en
// personal-export-queries.ts (deudas en debt-export-queries.ts) y las de
// Empresa en business-export-queries.ts.

/** Datos de la exportación de un espacio ya validado como del usuario */
export async function loadExportData(
  workspace: Workspace,
  range: ExportRange,
  today: string
): Promise<ExportData> {
  const supabase = await createClient()
  return workspace.type === "personal"
    ? loadPersonalExport(supabase, workspace, range, today)
    : loadBusinessExport(supabase, workspace, range, today)
}
