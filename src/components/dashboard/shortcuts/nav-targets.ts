import type { LucideIcon } from "lucide-react"
import { SITE } from "@/config/site"
import { workspaceBasePath } from "@/features/workspaces/paths"
import { NAV_ICONS } from "../nav"
import type { QuickActionsWorkspace } from "../quick-actions-context"

export interface NavTarget {
  name: string
  href: string
  icon: LucideIcon
  /** Grupo del aside ("Día a día"…) */
  group: string
  /** Letra tras la G (mayúscula), si la pantalla tiene atajo */
  shortcut?: string
}

/**
 * Pantallas del espacio activo, desde SITE.navigation (como el aside), con
 * su letra de atajo. Fuera de un espacio (Cuenta) van las de Personal, como
 * en el aside
 */
export function getNavTargets(
  workspace: Pick<QuickActionsWorkspace, "id" | "type"> | undefined
): NavTarget[] {
  if (workspace?.type === "business") {
    const base = workspaceBasePath({ id: workspace.id, type: "business" })
    return SITE.navigation.business.flatMap((group) =>
      group.items.map((item) => ({
        name: item.name,
        href: `${base}${item.segment}`,
        icon: NAV_ICONS[item.icon],
        group: group.label,
        shortcut: "shortcut" in item ? item.shortcut : undefined
      }))
    )
  }

  return SITE.navigation.personal.flatMap((group) =>
    group.items.map((item) => ({
      name: item.name,
      href: item.href,
      icon: NAV_ICONS[item.icon],
      group: group.label,
      shortcut: "shortcut" in item ? item.shortcut : undefined
    }))
  )
}
