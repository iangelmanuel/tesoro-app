import { SITE } from "@/config/site"

export type WorkspaceTheme = "personal" | "business" | null

// Decide el primario del dashboard por la ruta. Personal y cada empresa
// tienen su color; cuenta, el estado vacío de Empresa y el resto quedan
// neutros
export function getWorkspaceTheme(pathname: string): WorkspaceTheme {
  const personal = SITE.routes.dashboardPersonal
  if (pathname === personal || pathname.startsWith(`${personal}/`)) {
    return "personal"
  }

  const business = `${SITE.routes.dashboardBusiness}/`
  if (pathname.startsWith(business) && pathname.length > business.length) {
    return "business"
  }

  return null
}
