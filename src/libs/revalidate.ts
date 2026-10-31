import { revalidatePath } from "next/cache"
import { SITE } from "@/config/site"
import { workspaceBasePath } from "@/features/workspaces/paths"
import type { WorkspaceType } from "@/features/workspaces/queries"

// Movimientos, gastos fijos, presupuestos, metas y deudas se cruzan en
// Resumen, Movimientos, Presupuestos, Reportes, Metas y Deudas (un pago de
// préstamo o un abono crea un movimiento). Revalidar el layout del espacio
// Personal invalida todas sus páginas, incluida /dashboard/personal/debts, y
// actualiza la actual. Solo en Server Actions.
export function revalidatePersonalPages() {
  revalidatePath(SITE.routes.dashboardPersonal, "layout")
}

// Igual que revalidatePersonalPages, para el espacio del dato: el layout de
// /dashboard/personal o el de /dashboard/business/[id]. Solo en Server Actions.
export function revalidateWorkspacePages(workspace: {
  id: string
  type: WorkspaceType
}) {
  revalidatePath(workspaceBasePath(workspace), "layout")
}
