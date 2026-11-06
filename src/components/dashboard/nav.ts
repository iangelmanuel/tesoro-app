import {
  Activity,
  ArrowLeftRight,
  CalendarClock,
  CalendarPlus,
  ChartColumn,
  CreditCard,
  LayoutDashboard,
  Lightbulb,
  type LucideIcon,
  PiggyBank,
  Settings,
  Target,
  Wallet
} from "lucide-react"
import type { SITE } from "@/config/site"

export type NavIcon =
  | (typeof SITE.navigation.personal)[number]["items"][number]["icon"]
  | (typeof SITE.navigation.business)[number]["items"][number]["icon"]

/** Lista plana para la barra inferior, el título del header y la landing */
// Genérico sobre el grupo (no sobre el ítem): con tuplas `as const`, TS
// infiere T solo del primer grupo y rechaza los demás
export function flattenNav<G extends { readonly items: readonly unknown[] }>(
  groups: readonly G[]
): G["items"][number][] {
  return groups.flatMap((group) => [...group.items])
}

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  CalendarClock,
  CalendarPlus,
  PiggyBank,
  Target,
  CreditCard,
  ChartColumn,
  Lightbulb,
  Activity,
  Settings
}

// El Resumen es la raíz del espacio: solo se marca con coincidencia exacta
export function isActive(pathname: string, href: string, root: string) {
  if (href === root) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
