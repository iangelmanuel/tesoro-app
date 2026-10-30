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
    security: "https://github.com/iangelmanuel/tesoro-app/security"
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

  features: [
    {
      title: "Registros como punto de partida",
      description:
        "No empiezas de cero: Tesoro trabaja sobre los movimientos que registras y construye el panorama a partir de ellos."
    },
    {
      title: "Gráficas claras",
      description:
        "Ingresos, gastos, categorías y tendencias presentados de forma visual y fácil de entender."
    },
    {
      title: "Recomendaciones",
      description:
        "Sugerencias concretas para gastar mejor, ahorrar más y anticiparte a meses difíciles."
    },
    {
      title: "Score financiero",
      description:
        "Un puntaje que resume la salud de tus finanzas y muestra cómo evoluciona en el tiempo."
    },
    {
      title: "Personal y Empresa",
      description:
        "Dos espacios separados en la misma cuenta: cambia entre tus finanzas personales y las de tu negocio en un clic."
    },
    {
      title: "Código abierto",
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
    dashboardBusiness: "/dashboard/business",
    authCallback: "/auth/callback",
    account: "/dashboard/account",
    accountDeleted: "/account-deleted",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    checkEmail: "/check-email",
    authConfirm: "/auth/confirm"
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

  legal: [
    {
      slug: "privacidad",
      title: "Política de Privacidad",
      updatedAt: "2026-10-29"
    },
    {
      slug: "terminos",
      title: "Términos y Condiciones",
      updatedAt: "2026-10-29"
    }
  ],

  navigation: {
    main: [
      { name: "Inicio", href: "/" },
      { name: "Funciones", href: "/#funciones" },
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
    ]
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

    themeColor: { light: "#FFFFFF", dark: "#050505" },
    manifestCategories: ["finance", "business", "productivity"]
  }
} as const
