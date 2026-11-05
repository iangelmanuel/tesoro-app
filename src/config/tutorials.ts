import type { Route } from "next"

/**
 * Tutoriales guiados de Personal (SPEC 27). Las claves coinciden con el
 * `check` de `tutorial_progress`: al agregar una sección nueva, se amplía con
 * una migración.
 */
export const TUTORIAL_SECTIONS = [
  "summary",
  "transactions",
  "accounts",
  "recurring",
  "budgets",
  "goals",
  "debts",
  "reports",
  "recommendations"
] as const

export type TutorialSection = (typeof TUTORIAL_SECTIONS)[number]

export interface TutorialStep {
  /** Valor de data-tour del elemento resaltado; sin él, el paso va centrado */
  target?: string
  title: string
  description: string
  /** Solo en escritorio, solo en móvil o en ambos (por defecto) */
  viewport?: "desktop" | "mobile"
}

/** Nombre visible y ruta de cada sección con tutorial */
export const TUTORIAL_SECTION_INFO: Record<
  TutorialSection,
  { label: string; href: Route }
> = {
  summary: { label: "Resumen", href: "/dashboard/personal" },
  transactions: {
    label: "Movimientos",
    href: "/dashboard/personal/transactions"
  },
  accounts: { label: "Cuentas", href: "/dashboard/personal/accounts" },
  recurring: { label: "Gastos fijos", href: "/dashboard/personal/recurring" },
  budgets: { label: "Presupuestos", href: "/dashboard/personal/budgets" },
  goals: { label: "Metas", href: "/dashboard/personal/goals" },
  debts: { label: "Deudas", href: "/dashboard/personal/debts" },
  reports: { label: "Reportes", href: "/dashboard/personal/reports" },
  recommendations: {
    label: "Recomendaciones",
    href: "/dashboard/personal/recommendations"
  }
}

/** Sección con tutorial que corresponde a una ruta, o undefined si no tiene */
export function getTutorialSection(
  pathname: string
): TutorialSection | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname

  return TUTORIAL_SECTIONS.find(
    (section) => TUTORIAL_SECTION_INFO[section].href === path
  )
}

/** Pasos de cada sección; se escriben en el paso 7 del plan */
export const TUTORIALS: Record<TutorialSection, readonly TutorialStep[]> = {
  summary: [],
  transactions: [],
  accounts: [],
  recurring: [],
  budgets: [],
  goals: [],
  debts: [],
  reports: [],
  recommendations: []
}
