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
  summary: [
    {
      title: "Te damos la bienvenida a Tesoro",
      description:
        "Este es tu Resumen: cómo va tu mes de un vistazo. Te mostramos lo principal en un minuto."
    },
    {
      target: "summary-kpis",
      title: "Tu mes en cifras",
      description:
        "Ingresos, gastos y balance del mes, comparados con el mes anterior. El saldo acumulado suma todo lo que has registrado."
    },
    {
      target: "summary-trend",
      title: "Ingresos vs. gastos",
      description:
        "Los últimos 6 meses lado a lado. Así ves si gastas más de lo que entra."
    },
    {
      target: "summary-score",
      title: "Tu salud financiera",
      description:
        "Un puntaje de 0 a 100 con las recomendaciones más importantes del mes. Desde su enlace ves el detalle."
    },
    {
      target: "summary-accounts",
      title: "Saldo en cuentas",
      description: "Cuánto tienes hoy en cada cuenta, efectivo o banco."
    },
    {
      target: "summary-recent",
      title: "Últimos movimientos",
      description:
        "Lo último que registraste. Desde aquí saltas a la lista completa."
    },
    {
      target: "summary-cards",
      title: "Lo que viene",
      description:
        "Pagos próximos, presupuestos en riesgo, metas y deudas. Cada tarjeta te lleva a su sección."
    },
    {
      target: "header-quick-add",
      title: "Registra un movimiento",
      description:
        "Ingresos, gastos, traspasos, pagos de deudas y gastos fijos. Todo empieza aquí.",
      viewport: "desktop"
    },
    {
      target: "header-more",
      title: "Más acciones",
      description:
        "Aporta a una meta, paga una deuda, importa un archivo, edita tus categorías o verifica tus movimientos."
    },
    {
      target: "header-amounts",
      title: "Oculta tus cifras",
      description:
        "Cambia saldos y totales por *** cuando alguien mira tu pantalla. Se recuerda en todos tus dispositivos."
    },
    {
      target: "aside-workspaces",
      title: "Personal y Empresa",
      description:
        "Tus finanzas personales y las de tu negocio van separadas. Cambia de espacio aquí.",
      viewport: "desktop"
    },
    {
      target: "aside-sections",
      title: "Secciones",
      description:
        "Movimientos, cuentas, gastos fijos, presupuestos, metas, deudas, reportes y recomendaciones.",
      viewport: "desktop"
    },
    {
      target: "mobile-nav",
      title: "Navega con la barra",
      description:
        "Tus secciones más usadas, siempre a mano en la parte de abajo.",
      viewport: "mobile"
    },
    {
      target: "mobile-quick-add",
      title: "Registra en un toque",
      description:
        "El botón + abre las acciones rápidas: movimientos, traspasos, aportes y pagos.",
      viewport: "mobile"
    },
    {
      target: "header-menu",
      title: "Menú completo",
      description:
        "Todas las secciones, el cambio entre Personal y Empresa, y tu cuenta.",
      viewport: "mobile"
    },
    {
      target: "header-help",
      title: "¿Necesitas repasar?",
      description:
        "Cada sección tiene su tutorial. Ábrelo cuando quieras con este botón."
    }
  ],
  transactions: [
    {
      title: "Tus movimientos",
      description:
        "Aquí está todo lo que registras: ingresos, gastos, traspasos y pagos. Te mostramos cómo encontrar y ordenar cada uno."
    },
    {
      target: "header-quick-add",
      title: "Registra o traspasa",
      description:
        "Desde aquí registras ingresos y gastos. Para mover plata entre tus cuentas, elige Traspaso en el mismo diálogo.",
      viewport: "desktop"
    },
    {
      target: "mobile-quick-add",
      title: "Registra o traspasa",
      description:
        "El botón + registra ingresos y gastos. Para mover plata entre tus cuentas, elige Traspaso en el mismo diálogo.",
      viewport: "mobile"
    },
    {
      target: "transactions-search",
      title: "Busca y cambia de mes",
      description:
        "Busca por descripción o nota. Las flechas recorren los meses."
    },
    {
      target: "transactions-filters",
      title: "Filtra la lista",
      description:
        "Ve todos los meses a la vez o filtra por tipo, categoría o cuenta. Limpiar filtros te devuelve a la vista completa.",
      viewport: "desktop"
    },
    {
      target: "transactions-filters-sheet",
      title: "Filtra la lista",
      description:
        "Abre los filtros para elegir tipo, categoría, cuenta o todos los meses. Se aplican al tocar.",
      viewport: "mobile"
    },
    {
      target: "transactions-totals",
      title: "Totales del periodo",
      description:
        "Ingresos, gastos y balance de lo que ves en la lista, con los filtros aplicados."
    },
    {
      target: "transactions-table",
      title: "La lista",
      description:
        "Cada movimiento con su fecha, categoría, cuenta y monto. En el teléfono, desliza la tabla hacia los lados."
    },
    {
      target: "transactions-reorder",
      title: "Ordena dentro del día",
      description:
        "Si registraste varios movimientos el mismo día, arrastra desde aquí para ponerlos en el orden en que pasaron."
    },
    {
      target: "row-actions",
      title: "Edita o elimina",
      description:
        "Corrige un movimiento o bórralo. Si es un pago de deuda o un aporte a meta, el cambio se refleja allá también."
    },
    {
      target: "header-more",
      title: "Verifica tus movimientos",
      description:
        "En Más está Verificar movimientos: todo tu historial en una lista, para compararlo con el extracto del banco."
    }
  ],
  accounts: [],
  recurring: [],
  budgets: [],
  goals: [],
  debts: [],
  reports: [],
  recommendations: []
}
