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
  accounts: [
    {
      title: "Tus cuentas",
      description:
        "Efectivo, bancos y billeteras: dónde está tu plata. Cada movimiento puede ir asociado a una cuenta."
    },
    {
      target: "accounts-create",
      title: "Crea una cuenta",
      description:
        "Agrega cada lugar donde guardas plata, con su saldo inicial y la fecha desde la que lo cuentas."
    },
    {
      target: "accounts-total",
      title: "Saldo en cuentas",
      description: "La suma de todas tus cuentas activas."
    },
    {
      target: "accounts-card",
      title: "Cada cuenta",
      description:
        "Su saldo de hoy y, si tienes movimientos programados, cuánto quedará con ellos."
    },
    {
      target: "accounts-update-balance",
      title: "Actualiza el saldo",
      description:
        "Corrige el saldo con la cifra real de tu banco o billetera. No crea un movimiento."
    },
    {
      target: "accounts-reconcile",
      title: "Concilia",
      description:
        "Escribe el saldo real y su fecha. Tesoro crea un ajuste por la diferencia, para que tus cifras cuadren con el banco."
    },
    {
      target: "accounts-transactions",
      title: "Ver movimientos",
      description:
        "Abre Movimientos filtrado por esta cuenta, de todos los meses."
    },
    {
      target: "accounts-menu",
      title: "Edita o archiva",
      description:
        "Cambia nombre, tipo o color. Archivar la oculta sin borrar su historial."
    },
    {
      target: "accounts-archived",
      title: "Cuentas archivadas",
      description:
        "Aquí quedan las que archivaste. Puedes restaurarlas cuando quieras."
    },
    {
      target: "header-quick-add",
      title: "Mueve plata entre cuentas",
      description:
        "Para pasar plata de una cuenta a otra, registra un Traspaso desde este botón.",
      viewport: "desktop"
    },
    {
      target: "mobile-quick-add",
      title: "Mueve plata entre cuentas",
      description:
        "Para pasar plata de una cuenta a otra, registra un Traspaso desde el botón +.",
      viewport: "mobile"
    }
  ],
  recurring: [
    {
      title: "Tus gastos fijos",
      description:
        "Arriendo, servicios, suscripciones o seguros: lo que pagas cada cierto tiempo. Tesoro te avisa cuándo vence cada uno."
    },
    {
      target: "budgets-recurring-tabs",
      title: "Gastos fijos y presupuestos",
      description:
        "En el teléfono, las dos pantallas comparten lugar. Cambia entre ellas con estas pestañas.",
      viewport: "mobile"
    },
    {
      target: "recurring-create",
      title: "Agrega un gasto fijo",
      description: "Ponle nombre, monto, categoría y cada cuánto se repite."
    },
    {
      target: "import-button",
      title: "O impórtalos",
      description: "Si ya los tienes en Excel o CSV, súbelos todos de una vez."
    },
    {
      target: "recurring-upcoming",
      title: "Próximos pagos",
      description:
        "Lo que vence pronto y lo que ya venció, con lo pagado este mes en verde."
    },
    {
      target: "recurring-pay",
      title: "Márcalo como pagado",
      description:
        "Registra el pago con su monto real y la cuenta de donde salió. Queda en tus movimientos."
    },
    {
      target: "recurring-list",
      title: "Todos tus gastos fijos",
      description:
        "Cada uno con su monto, frecuencia, vigencia y estado. En el teléfono, desliza la tabla hacia los lados."
    },
    {
      target: "row-actions",
      title: "Edita, pausa o elimina",
      description:
        "Pausa un gasto que no vas a pagar por un tiempo; reanúdalo cuando vuelva."
    }
  ],
  budgets: [
    {
      title: "Tus presupuestos",
      description:
        "Define cuánto quieres gastar como máximo en cada categoría y sigue tu avance durante el mes."
    },
    {
      target: "budgets-recurring-tabs",
      title: "Gastos fijos y presupuestos",
      description:
        "En el teléfono, las dos pantallas comparten lugar. Cambia entre ellas con estas pestañas.",
      viewport: "mobile"
    },
    {
      target: "budgets-month",
      title: "Elige el mes",
      description:
        "Cada mes tiene sus propios presupuestos. Las flechas te llevan al anterior o al siguiente."
    },
    {
      target: "budgets-create",
      title: "Crea un presupuesto",
      description: "Elige una categoría de gasto y el máximo para el mes."
    },
    {
      target: "budgets-copy",
      title: "Copia el mes anterior",
      description:
        "Si tus límites no cambian, trae los del mes pasado en un toque."
    },
    {
      target: "budgets-totals",
      title: "Cómo va el mes",
      description:
        "Lo presupuestado, lo gastado y lo que te queda, sumando todas las categorías."
    },
    {
      target: "budgets-list",
      title: "Avance por categoría",
      description:
        "La barra muestra lo gastado y lo que ya está comprometido en gastos fijos pendientes. Cambia de color al acercarte al límite."
    },
    {
      target: "row-actions",
      title: "Edita o elimina",
      description: "Ajusta el monto de un presupuesto o quítalo."
    },
    {
      target: "budgets-unbudgeted",
      title: "Sin presupuesto",
      description:
        "Categorías donde gastaste este mes sin un límite. Presupuéstalas desde aquí."
    }
  ],
  goals: [
    {
      title: "Tus metas de ahorro",
      description:
        "Un viaje, un fondo de emergencia o lo que quieras. Registra tus aportes y Tesoro te dice cuánto ahorrar cada mes."
    },
    {
      target: "goals-create",
      title: "Crea una meta",
      description:
        "Ponle nombre, el monto que quieres juntar y, si quieres, una fecha."
    },
    {
      target: "import-button",
      title: "Importa tus aportes",
      description: "Si llevas tus ahorros en Excel o CSV, súbelos de una vez."
    },
    {
      target: "goals-card",
      title: "Cada meta",
      description:
        "Lo ahorrado frente al objetivo, cuánto te falta y el aporte mensual sugerido para llegar a la fecha."
    },
    {
      target: "goals-detail",
      title: "Aporta o retira",
      description:
        "Toca la meta para abrir su detalle: ahí aportas, retiras y ves el historial de aportes."
    },
    {
      target: "goals-menu",
      title: "Edita, cumple o archiva",
      description:
        "Cambia los datos de la meta, márcala como cumplida o archívala."
    },
    {
      target: "header-more",
      title: "Aporta desde cualquier sección",
      description: "En Más tienes Aporte a meta, sin entrar a esta página."
    },
    {
      target: "goals-inactive",
      title: "Cumplidas y archivadas",
      description:
        "Aquí quedan las metas que terminaste o guardaste. Puedes reactivarlas."
    }
  ],
  debts: [
    {
      title: "Tus deudas",
      description:
        "Tarjetas y préstamos que pagas, y lo que otros te deben. Lleva el saldo de cada uno y cuándo termina."
    },
    {
      target: "debts-tabs",
      title: "Debo y Me deben",
      description:
        "En Debo van tus tarjetas y préstamos. En Me deben, lo que prestaste y los abonos que te hacen."
    },
    {
      target: "debts-totals",
      title: "Tus totales",
      description:
        "Tu deuda total, cuánto usas del cupo de tus tarjetas y el interés estimado del mes. En Me deben, cuánto te falta por cobrar."
    },
    {
      target: "debts-upcoming",
      title: "Próximos pagos",
      description:
        "Lo que vence pronto en tus tarjetas y préstamos, con el pago mínimo o la cuota."
    },
    {
      target: "debts-create",
      title: "Registra una deuda",
      description:
        "Agrega una tarjeta o un préstamo con su saldo, tasa y día de pago. En Me deben, registra lo que prestaste."
    },
    {
      target: "import-button",
      title: "Importa pagos",
      description: "Sube tus pagos y abonos desde Excel o CSV."
    },
    {
      target: "debts-card",
      title: "Cada deuda",
      description:
        "Su saldo, el próximo pago y cuándo terminas de pagarla según lo que abonas."
    },
    {
      target: "debts-detail",
      title: "Paga y revisa el historial",
      description:
        "Toca la deuda para abrir su detalle: registra pagos o abonos extra, mira la proyección y el historial."
    },
    {
      target: "debts-menu",
      title: "Edita, ajusta o archiva",
      description:
        "Cambia sus datos, actualiza el saldo con la cifra del banco, márcala como pagada o archívala."
    },
    {
      target: "header-more",
      title: "Paga desde cualquier sección",
      description: "En Más tienes Pago de deuda, sin entrar a esta página."
    },
    {
      target: "debts-inactive",
      title: "Pagadas y archivadas",
      description:
        "Aquí quedan las deudas que terminaste o guardaste. Puedes reactivarlas."
    }
  ],
  reports: [
    {
      title: "Tus reportes",
      description:
        "Mira cómo se mueve tu plata en el tiempo y en qué categorías se va."
    },
    {
      target: "reports-period",
      title: "Elige el periodo",
      description:
        "Un mes, un trimestre, un año o un rango de fechas. Las flechas recorren los periodos."
    },
    {
      target: "reports-type",
      title: "Gastos o ingresos",
      description:
        "Cambia qué muestran las categorías: en qué gastas o de dónde te entra la plata."
    },
    {
      target: "reports-kpis",
      title: "El periodo en cifras",
      description:
        "Ingresos, gastos, balance y tasa de ahorro, comparados con el periodo anterior."
    },
    {
      target: "reports-trend",
      title: "Tendencia mensual",
      description:
        "Ingresos, gastos y balance mes a mes, con al menos 6 meses de historia."
    },
    {
      target: "reports-top",
      title: "Tus categorías principales",
      description: "Las categorías que más pesan en el periodo."
    },
    {
      target: "reports-categories",
      title: "Todas las categorías",
      description:
        "El detalle completo. Toca una categoría para ver sus movimientos."
    }
  ],
  recommendations: []
}
