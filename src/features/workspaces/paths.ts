import { SITE } from "@/config/site"
import type { WorkspaceType } from "./types"

// Lo único que hace falta de un espacio para armar sus rutas
type WorkspaceRef = {
  id: string
  type: WorkspaceType
}

/** Ruta base de un espacio: /dashboard/personal o /dashboard/business/[id] */
export function workspaceBasePath(workspace: WorkspaceRef) {
  return workspace.type === "business"
    ? `${SITE.routes.dashboardBusiness}/${workspace.id}`
    : SITE.routes.dashboardPersonal
}

/** Movimientos del espacio */
export function workspaceTransactionsPath(workspace: WorkspaceRef) {
  return `${workspaceBasePath(workspace)}/transactions`
}

/** Reportes del espacio */
export function workspaceReportsPath(workspace: WorkspaceRef) {
  return `${workspaceBasePath(workspace)}/reports`
}

/** Flujo de caja de una empresa */
export function workspaceCashFlowPath(workspace: WorkspaceRef) {
  return `${workspaceBasePath(workspace)}/cash-flow`
}

/** Score y recomendaciones del espacio */
export function workspaceRecommendationsPath(workspace: WorkspaceRef) {
  return `${workspaceBasePath(workspace)}/recommendations`
}
