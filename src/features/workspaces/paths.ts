import { SITE } from "@/config/site"
import type { WorkspaceType } from "./queries"

/** Ruta base de un espacio: /dashboard/personal o /dashboard/business/[id] */
export function workspaceBasePath(workspace: {
  id: string
  type: WorkspaceType
}) {
  return workspace.type === "business"
    ? `${SITE.routes.dashboardBusiness}/${workspace.id}`
    : SITE.routes.dashboardPersonal
}
