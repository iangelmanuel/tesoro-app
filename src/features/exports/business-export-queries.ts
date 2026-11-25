import "server-only"
import type { Workspace } from "@/features/workspaces/queries"
import {
  businessMonth,
  exportBounds,
  groupByMonth,
  toRow
} from "./export-calculations"
import {
  type Supabase,
  loadAccountBalances,
  loadMovements,
  loadNames
} from "./movement-export-queries"
import type { BusinessExport, ExportRange } from "./types"

/** Hojas de mes y Movimientos de Empresa */
export async function loadBusinessExport(
  supabase: Supabase,
  workspace: Workspace,
  range: ExportRange,
  today: string
): Promise<BusinessExport> {
  const bounds = exportBounds(range, today)
  const names = await loadNames(supabase, workspace)
  const [movements, accounts] = await Promise.all([
    loadMovements(supabase, workspace, bounds, names),
    loadAccountBalances(supabase, workspace.id, bounds, names)
  ])
  const movementsByMonth = groupByMonth(movements)

  return {
    type: "business",
    movements: movements.map(toRow),
    months: range.months.map((month) =>
      businessMonth(
        month,
        movementsByMonth.get(month) ?? [],
        accounts.get(month) ?? []
      )
    )
  }
}
