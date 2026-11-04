const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "")

export const SITE = {
  info: {
    name: "Tesoro",
    legalName: "Tesoro App",
    description:
      "Gestor y recomendador de finanzas personales y empresariales. Registra tus movimientos y Tesoro los convierte en gráficas claras, recomendaciones accionables y un score de salud financiera.",
    slogan: "Tus finanzas, claras desde el primer registro.",
    founded: 2026,
    version: "0.1.0",
    license: "MIT",
    openSource: true
  },

  author: {
    name: "Angel De La Torre",
    alias: "Angel DM",
    email: "iangelmanuel02@gmail.com",
    url: "https://angeldm.dev",
    github: "https://github.com/iangelmanuel"
  },

  repository: {
    url: "https://github.com/iangelmanuel/tesoro-app",
    issues: "https://github.com/iangelmanuel/tesoro-app/issues",
    security: "https://github.com/iangelmanuel/tesoro-app/security",
    contributing:
      "https://github.com/iangelmanuel/tesoro-app/blob/master/CONTRIBUTING.md"
  },

  site: {
    url: SITE_URL,
    locale: "es-CO",
    lang: "es",
    timezone: "America/Bogota",
    currency: "COP"
  },

  contact: {
    email: "iangelmanuel02@gmail.com",
    securityEmail: "iangelmanuel02@gmail.com"
  },

  social: {
    github: "https://github.com/iangelmanuel",
    linkedin: "https://www.linkedin.com/in/iangelmanuel",
    x: "https://x.com/iangelmanuel",
    website: "https://angeldm.dev"
  },

  workspaces: {
    default: "personal",
    types: [
      {
        id: "personal",
        name: "Personal",
        description:
          "Ingresos, gastos, presupuestos, metas de ahorro y deudas de tu día a día."
      },
      {
        id: "business",
        name: "Empresa",
        description:
          "Flujo de caja, ventas, costos y gastos operativos de tu negocio."
      }
    ]
  },

  // `icon` es el nombre del ícono de lucide-react que pinta la landing
  features: [
    {
      title: "Registros como punto de partida",
      icon: "NotebookPen",
      description:
        "No empiezas de cero: Tesoro trabaja sobre los movimientos que registras y construye el panorama a partir de ellos."
    },
    {
      title: "Gráficas claras",
      icon: "ChartColumn",
      description:
        "Ingresos, gastos, categorías y tendencias presentados de forma visual y fácil de entender."
    },
    {
      title: "Recomendaciones",
      icon: "Lightbulb",
      description:
        "Sugerencias concretas para gastar mejor, ahorrar más y anticiparte a meses difíciles."
    },
    {
      title: "Score financiero",
      icon: "Gauge",
      description:
        "Un puntaje que resume la salud de tus finanzas y muestra cómo evoluciona en el tiempo."
    },
    {
      title: "Personal y Empresa",
      icon: "Building2",
      description:
        "Dos espacios separados en la misma cuenta: cambia entre tus finanzas personales y las de tu negocio en un clic."
    },
    {
      title: "Código abierto",
      icon: "Code",
      description:
        "Licencia MIT: úsalo, modifícalo y despliégalo donde quieras, también con fines comerciales."
    }
  ],

  routes: {
    home: "/",
    signIn: "/sign-in",
    signUp: "/sign-up",
    dashboard: "/dashboard",
    dashboardPersonal: "/dashboard/personal",
    personalRecurring: "/dashboard/personal/recurring",
    dashboardBusiness: "/dashboard/business",
    authCallback: "/auth/callback",
    account: "/dashboard/account",
    accountDeleted: "/account-deleted",
    legal: "/legal"
  },

  // Secciones del aside de /dashboard/account. `icon` es el nombre del ícono
  // de lucide-react (ver account-nav.tsx). Añadir una sección = una línea
  // aquí y su ruta en app/dashboard/account/<segmento>
  account: {
    sections: [
      { name: "General", href: "/dashboard/account/general", icon: "User" },
      {
        name: "Seguridad",
        href: "/dashboard/account/security",
        icon: "ShieldCheck"
      },
      { name: "Privacidad", href: "/dashboard/account/privacy", icon: "Eye" },
      {
        name: "Preferencias",
        href: "/dashboard/account/preferences",
        icon: "SlidersHorizontal"
      }
    ]
  },

  // Monedas que el usuario puede elegir. Solo cambian el formato de los
  // montos: los valores guardados no se convierten
  currencies: [
    { code: "COP", label: "Peso colombiano" },
    { code: "USD", label: "Dólar estadounidense" },
    { code: "EUR", label: "Euro" },
    { code: "MXN", label: "Peso mexicano" },
    { code: "PEN", label: "Sol peruano" },
    { code: "CLP", label: "Peso chileno" },
    { code: "ARS", label: "Peso argentino" }
  ],

  // Días entre programar el borrado de la cuenta y la purga (pg_cron)
  accountDeletionGraceDays: 30,

  // Debe coincidir con public.business_workspace_limit(). La BD es la que manda
  businessLimit: 1,

  // Conciliación de cuentas (SPEC 21). El aviso "faltan movimientos" salta si la
  // diferencia supera warnPercent % del saldo calculado o warnAmount (COP)
  reconciliation: {
    warnPercent: 5,
    warnAmount: 50000,
    note: "Conciliación con saldo real"
  },

  // Días entre programar el borrado de una empresa y la purga (pg_cron)
  workspaceDeletionGraceDays: 30,

  // Sectores de una empresa. Se validan con Zod; la BD guarda el `id`
  businessSectors: [
    { id: "commerce", label: "Comercio" },
    { id: "services", label: "Servicios" },
    { id: "manufacturing", label: "Manufactura" },
    { id: "technology", label: "Tecnología" },
    { id: "food", label: "Alimentos y restaurantes" },
    { id: "construction", label: "Construcción" },
    { id: "agriculture", label: "Agro" },
    { id: "health", label: "Salud" },
    { id: "education", label: "Educación" },
    { id: "transport", label: "Transporte" },
    { id: "other", label: "Otro" }
  ],

  legal: [
    {
      slug: "privacy",
      title: "Política de Privacidad",
      updatedAt: "2026-10-31"
    },
    {
      slug: "terms",
      title: "Términos y Condiciones",
      updatedAt: "2026-10-31"
    }
  ],

  navigation: {
    main: [
      { name: "Inicio", href: "/" },
      { name: "Funciones", href: "/#funciones" },
      { name: "Cómo funciona", href: "/#como-funciona" },
      { name: "Score", href: "/#score" },
      { name: "Código abierto", href: "/#open-source" }
    ],
    cta: { label: "Crear cuenta", href: "/sign-up" },
    secondary: { label: "Iniciar sesión", href: "/sign-in" },
    // `icon` es el nombre del ícono de lucide-react que pinta el aside
    personal: [
      {
        name: "Resumen",
        href: "/dashboard/personal",
        icon: "LayoutDashboard"
      },
      {
        name: "Movimientos",
        href: "/dashboard/personal/transactions",
        icon: "ArrowLeftRight"
      },
      {
        name: "Cuentas",
        href: "/dashboard/personal/accounts",
        icon: "Wallet"
      },
      {
        name: "Gastos fijos",
        href: "/dashboard/personal/recurring",
        icon: "CalendarClock"
      },
      {
        name: "Presupuestos",
        href: "/dashboard/personal/budgets",
        icon: "PiggyBank"
      },
      { name: "Metas", href: "/dashboard/personal/goals", icon: "Target" },
      { name: "Deudas", href: "/dashboard/personal/debts", icon: "CreditCard" },
      {
        name: "Reportes",
        href: "/dashboard/personal/reports",
        icon: "ChartColumn"
      },
      {
        name: "Recomendaciones",
        href: "/dashboard/personal/recommendations",
        icon: "Lightbulb"
      }
    ],
    // `segment` se agrega a /dashboard/business/[id]
    business: [
      { name: "Resumen", segment: "", icon: "LayoutDashboard" },
      { name: "Movimientos", segment: "/transactions", icon: "ArrowLeftRight" },
      { name: "Cuentas", segment: "/accounts", icon: "Wallet" },
      { name: "Flujo de caja", segment: "/cash-flow", icon: "Activity" },
      { name: "Reportes", segment: "/reports", icon: "ChartColumn" },
      {
        name: "Recomendaciones",
        segment: "/recommendations",
        icon: "Lightbulb"
      },
      { name: "Ajustes", segment: "/settings", icon: "Settings" }
    ],
    // Destinos de la barra inferior del teléfono (4, a cada lado del botón
    // central). Se toman de los ítems de arriba: Personal por `href` y
    // Empresa por `segment`
    mobile: {
      personal: [
        "/dashboard/personal",
        "/dashboard/personal/transactions",
        "/dashboard/personal/recurring",
        "/dashboard/personal/accounts"
      ],
      business: ["", "/transactions", "/cash-flow", "/reports"]
    }
  },

  seo: {
    title: "Tesoro — Finanzas personales y empresariales claras",
    titleTemplate: "%s | Tesoro",
    description:
      "Gestor y recomendador de finanzas personales y empresariales de código abierto. Registra ingresos y gastos y obtén gráficas claras, recomendaciones y un score de salud financiera.",
    keywords: [
      "finanzas personales",
      "finanzas empresariales",
      "gestor de finanzas",
      "control de gastos",
      "presupuesto personal",
      "flujo de caja",
      "score financiero",
      "salud financiera",
      "recomendaciones financieras",
      "app de finanzas",
      "código abierto",
      "open source",
      "Colombia",
      "Latinoamérica"
    ],

    author: "Angel De La Torre",
    creator: "Angel De La Torre",
    publisher: "Angel DM",

    url: SITE_URL,
    locale: "es-CO",
    lang: "es",
    currency: "COP",
    languages: ["Spanish"],
    locales: [{ hreflang: "es-CO", default: true }] as const,

    image: "/opengraph-image.png",
    imageAlt:
      "Tesoro: panel de finanzas con gráficas de ingresos, gastos y score financiero",
    imageWidth: 1200,
    imageHeight: 630,
    logo: "/brand/logo.png",

    ogType: "website" as "website" | "article",
    twitterAuthor: "@iangelmanuel" as string | null,
    twitterHandle: "@iangelmanuel" as string | null,
    twitterCard: "summary_large_image" as
      "summary" | "summary_large_image" | "app" | "player",
    noindex: false,

    category: "finance",
    classification: "Finance",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    price: "0",

    themeColor: { light: "#F1F2F5", dark: "#07080A" },
    manifestCategories: ["finance", "business", "productivity"]
  }
} as const

export type LegalSlug = (typeof SITE.legal)[number]["slug"]

// URL de un documento legal. No se arma a mano en los componentes
export function legalHref(slug: LegalSlug) {
  return `${SITE.routes.legal}/${slug}` as const
}
