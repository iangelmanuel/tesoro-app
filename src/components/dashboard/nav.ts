import {
  Activity,
  ArrowLeftRight,
  CalendarClock,
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
  | (typeof SITE.navigation.personal)[number]["icon"]
  | (typeof SITE.navigation.business)[number]["icon"]

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  CalendarClock,
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
