"use client"

import { useParams, usePathname } from "next/navigation"
import { SITE } from "@/config/site"
import {
  type QuickActionsWorkspace,
  useQuickActions
} from "./quick-actions-context"

// En /dashboard/personal/* es Personal y en /dashboard/business/[id]/* esa
// empresa. En otras rutas (cuenta, estado vacío de Empresa) no hay espacio
export function useActiveWorkspace(): QuickActionsWorkspace | undefined {
  const { workspaces } = useQuickActions()
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const personal = SITE.routes.dashboardPersonal

  if (pathname === personal || pathname.startsWith(`${personal}/`)) {
    return workspaces.find((option) => option.type === "personal")
  }

  if (pathname.startsWith(`${SITE.routes.dashboardBusiness}/`)) {
    return workspaces.find(
      (option) => option.type === "business" && option.id === params.id
    )
  }

  return undefined
}
