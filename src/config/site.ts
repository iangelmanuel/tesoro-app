const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "")

export const SITE = {
  // Datos de la app: nombre, descripción, eslogan, versión y licencia. La
  // versión se sube junto con package.json, CHANGELOG.md y SECURITY.md
  info: {
    name: "Tesoro",
    legalName: "Tesoro App",
    description:
      "Gestor y recomendador de finanzas personales y empresariales. Registra tus movimientos y Tesoro los convierte en gráficas claras, recomendaciones accionables y un score de salud financiera.",
    slogan: "Tus finanzas, claras desde el primer registro.",
    founded: 2026,
    version: "0.4.0",
    license: "MIT",
    openSource: true
  },

  // Autor del proyecto (JSON-LD `Person`, créditos y legales)
  author: {
    name: "Angel De La Torre",
    alias: "Angel DM",
    email: "iangelmanuel02@gmail.com",
    url: "https://angeldm.dev",
    github: "https://github.com/iangelmanuel"
  },

  // Enlaces del repositorio en GitHub
  repository: {
    url: "https://github.com/iangelmanuel/tesoro-app",
    issues: "https://github.com/iangelmanuel/tesoro-app/issues",
    security: "https://github.com/iangelmanuel/tesoro-app/security",
    contributing:
      "https://github.com/iangelmanuel/tesoro-app/blob/master/CONTRIBUTING.md"
  },

  // URL base (NEXT_PUBLIC_SITE_URL), locale, zona horaria y moneda por defecto
  site: {
    url: SITE_URL,
    locale: "es-CO",
    lang: "es",
    timezone: "America/Bogota",
    currency: "COP"
  },

  // Correos de contacto y de reportes de seguridad
  contact: {
    email: "iangelmanuel02@gmail.com",
    securityEmail: "iangelmanuel02@gmail.com"
  },

  // Perfiles del autor (`sameAs` del JSON-LD y pie de la landing)
  social: {
    github: "https://github.com/iangelmanuel",
    linkedin: "https://www.linkedin.com/in/iangelmanuel",
    x: "https://x.com/iangelmanuel",
    website: "https://angeldm.dev"
  },

  // Espacios Personal y Empresa: el de por defecto y cómo se presentan
  workspaces: {
    default: "personal",
    types: [
      {
        id: "personal",
        name: "Personal",
        description:
          "Entradas, salidas, presupuestos, metas de ahorro y deudas de tu día a día."
      },
      {
        id: "business",
        name: "Empresa",
        description: "Flujo de caja, entradas y salidas de tu negocio."
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
        "Entradas, salidas, categorías y tendencias presentados de forma visual y fácil de entender."
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

  // Rutas de la app. Se leen de aquí, nunca se escriben a mano
  routes: {
    home: "/",
    signIn: "/sign-in",
    signUp: "/sign-up",
    dashboard: "/dashboard",
    dashboardPersonal: "/dashboard/personal",
    personalRecurring: "/dashboard/personal/recurring",
    personalRecurringIncome: "/dashboard/personal/recurring-income",
    dashboardBusiness: "/dashboard/business",
    authCallback: "/auth/callback",
    account: "/dashboard/account",
    accountDeleted: "/account-deleted",
    // Consentimiento OAuth de agentes MCP (SPEC 34). Debe coincidir con
    // authorization_url_path del servidor OAuth de Supabase
    oauthConsent: "/oauth/consent",
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
      },
      { name: "Agentes IA", href: "/dashboard/account/agents", icon: "Bot" }
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

  // Servidor MCP para agentes de IA (SPEC 34). Los límites de verdad viven
  // en el servidor (bulkLimit en Zod; rate limit y ventana de revertir en
  // SQL): esto solo los refleja en la UI y en la página /mcp
  mcp: {
    path: "/api/mcp",
    docsPath: "/mcp",
    bulkLimit: 200,
    // Filas por import_statement (SPEC 43), igual al tope de row_count del log
    statementLimit: 400,
    rateLimitPerMinute: 120,
    undoWindowDays: 30
  },

  // Conciliación de cuentas (SPEC 21). El aviso "faltan movimientos" salta si la
  // diferencia supera warnPercent % del saldo calculado o warnAmount (COP)
  reconciliation: {
    warnPercent: 5,
    warnAmount: 50000,
    note: "Saldo cuadrado con tu banco"
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

  // Documentos legales: slug de /legal/[slug], título y fecha de actualización
  legal: [
    {
      slug: "privacy",
      title: "Política de Privacidad",
      updatedAt: "2026-11-27"
    },
    {
      slug: "terms",
      title: "Términos y Condiciones",
      updatedAt: "2026-10-31"
    }
  ],

  // Videos de la landing (SPEC 24). Se renderizan con Hyperframes y viven en
  // public/videos/. Los componentes leen las rutas de aquí, nunca a mano.
  // `durationSeconds` es la duración real del render: se actualiza a mano al
  // re-renderizar. `clips[].feature` coincide con un `title` de `features`.
  landing: {
    demo: {
      title: "Tesoro en acción",
      description:
        "Un recorrido por el resumen, cómo registrar un movimiento, las cuentas y los presupuestos, un aporte a una meta, el extracto de una tarjeta, los reportes con el score y el espacio Empresa.",
      uploadDate: "2026-11-20",
      durationSeconds: 94,
      width: 1920,
      height: 1080,
      sources: {
        mp4: "/videos/demo.mp4",
        webm: "/videos/demo.webm",
        poster: "/videos/demo-poster.webp"
      }
    },
    clips: [
      {
        feature: "Registros como punto de partida",
        slug: "registros",
        sources: {
          mp4: "/videos/registros.mp4",
          webm: "/videos/registros.webm",
          poster: "/videos/registros-poster.webp"
        }
      },
      {
        feature: "Gráficas claras",
        slug: "graficas",
        sources: {
          mp4: "/videos/graficas.mp4",
          webm: "/videos/graficas.webm",
          poster: "/videos/graficas-poster.webp"
        }
      },
      {
        feature: "Recomendaciones",
        slug: "recomendaciones",
        sources: {
          mp4: "/videos/recomendaciones.mp4",
          webm: "/videos/recomendaciones.webm",
          poster: "/videos/recomendaciones-poster.webp"
        }
      },
      {
        feature: "Score financiero",
        slug: "score",
        sources: {
          mp4: "/videos/score.mp4",
          webm: "/videos/score.webm",
          poster: "/videos/score-poster.webp"
        }
      },
      {
        feature: "Personal y Empresa",
        slug: "espacios",
        sources: {
          mp4: "/videos/espacios.mp4",
          webm: "/videos/espacios.webm",
          poster: "/videos/espacios-poster.webp"
        }
      }
    ],

    // Sección "Agentes de IA" de la landing (SPEC 34). Los clientes y sus
    // logos viven en src/components/brand/ai-logos.tsx
    agents: {
      title: "Pídeselo a tu agente de IA",
      description:
        "Conecta Claude, ChatGPT u otro agente con una URL. Registra, pregunta y corrige tus movimientos hablando, contra tus datos reales.",
      cta: "Ver cómo conectarlo",
      // Video de la conversación (HyperFrames, video/clips/agentes.html):
      // 864 × 960, 17,6 s, sin sonido y en loop
      video: {
        mp4: "/videos/agentes.mp4",
        webm: "/videos/agentes.webm",
        poster: "/videos/agentes-poster.webp",
        width: 864,
        height: 960,
        description:
          "Ejemplo con datos ficticios: la persona pregunta cuánto gastó en comida este mes; el agente consulta Tesoro con get_month_summary y responde 412.000 pesos, 18 % menos que en octubre. Luego le pide registrar el almuerzo de 32.000 en Nequi y el agente lo registra con create_transactions, que se puede revertir durante 30 días."
      }
    }
  },

  // Navegación: menú público y sus llamados a la acción, grupos del aside de
  // Personal y Empresa (SPEC 31) con la letra de atajo de cada ítem, y la
  // barra inferior móvil
  navigation: {
    main: [
      { name: "Demo", href: "/#demo" },
      { name: "Funciones", href: "/#funciones" },
      { name: "Score", href: "/#score" },
      { name: "Código abierto", href: "/#open-source" }
    ],
    cta: { label: "Crear cuenta", href: "/sign-up" },
    secondary: { label: "Iniciar sesión", href: "/sign-in" },
    // Grupos del aside, en orden. `icon` es el nombre del ícono de
    // lucide-react que pinta el aside. Los consumidores planos (barra
    // inferior, título del header, landing) usan `flattenNav`
    personal: [
      {
        label: "Día a día",
        items: [
          {
            name: "Resumen",
            href: "/dashboard/personal",
            shortcut: "R",
            icon: "LayoutDashboard"
          },
          {
            name: "Movimientos",
            href: "/dashboard/personal/transactions",
            shortcut: "M",
            icon: "ArrowLeftRight"
          }
        ]
      },
      {
        label: "Tu plan",
        items: [
          {
            name: "Cuentas",
            href: "/dashboard/personal/accounts",
            shortcut: "C",
            icon: "Wallet"
          },
          {
            name: "Ingresos fijos",
            href: "/dashboard/personal/recurring-income",
            shortcut: "I",
            icon: "CalendarPlus"
          },
          {
            name: "Gastos fijos",
            href: "/dashboard/personal/recurring",
            shortcut: "F",
            icon: "CalendarClock"
          },
          {
            name: "Presupuestos",
            href: "/dashboard/personal/budgets",
            shortcut: "P",
            icon: "PiggyBank"
          },
          {
            name: "Metas",
            href: "/dashboard/personal/goals",
            shortcut: "E",
            icon: "Target"
          },
          {
            name: "Deudas",
            href: "/dashboard/personal/debts",
            shortcut: "D",
            icon: "CreditCard"
          }
        ]
      },
      {
        label: "Entiende tu dinero",
        items: [
          {
            name: "Reportes",
            href: "/dashboard/personal/reports",
            shortcut: "O",
            icon: "ChartColumn"
          },
          {
            name: "Recomendaciones",
            href: "/dashboard/personal/recommendations",
            shortcut: "S",
            icon: "Lightbulb"
          }
        ]
      }
    ],
    // `segment` se agrega a /dashboard/business/[id]
    business: [
      {
        label: "Día a día",
        items: [
          {
            name: "Resumen",
            segment: "",
            shortcut: "R",
            icon: "LayoutDashboard"
          },
          {
            name: "Movimientos",
            segment: "/transactions",
            shortcut: "M",
            icon: "ArrowLeftRight"
          }
        ]
      },
      {
        label: "Tu operación",
        items: [
          {
            name: "Cuentas",
            segment: "/accounts",
            shortcut: "C",
            icon: "Wallet"
          },
          {
            name: "Ajustes",
            segment: "/settings",
            shortcut: "A",
            icon: "Settings"
          }
        ]
      },
      {
        label: "Entiende tu negocio",
        items: [
          {
            name: "Flujo de caja",
            segment: "/cash-flow",
            shortcut: "F",
            icon: "Activity"
          },
          { name: "Reportes", segment: "/reports", icon: "ChartColumn" },
          {
            name: "Recomendaciones",
            segment: "/recommendations",
            icon: "Lightbulb"
          }
        ]
      }
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

  // Valores de SEO: títulos, descripción, palabras clave, Open Graph y manifest
  seo: {
    title: "Tesoro — Finanzas personales y empresariales claras",
    titleTemplate: "%s | Tesoro",
    description:
      "Gestor y recomendador de finanzas personales y empresariales de código abierto. Registra entradas y salidas y obtén gráficas claras, recomendaciones y un score de salud financiera.",
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
      "Tesoro: panel de finanzas con gráficas de entradas, salidas y score financiero",
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
