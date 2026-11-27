import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { JsonLd } from "@/components/seo/json-ld"
import { SpeedInsights } from "@/components/seo/speed-insights"
import { SITE } from "@/config/site"
import { cn } from "@/libs/cn"
import {
  buildApplicationSchema,
  buildAuthorSchema,
  buildMetadata,
  buildWebsiteSchema
} from "@/libs/seo"
import "@/styles/globals.css"

// Atkinson Hyperlegible Next (OFL, licencia junto al archivo): hecha para
// leer bien con baja visión y con cifras tabulares (tnum) para los montos
// (SPEC 51). Variable 200–800, subconjunto latino (español, €, −, flechas).
// Local y no desde next/font/google: así Next calcula la fuente de respaldo
// ajustada y el cambio de fuente no mueve el layout
const sans = localFont({
  src: "../src/styles/fonts/atkinson-hyperlegible-next-latin.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-sans"
})

const baseMetadata = buildMetadata({ path: "/" })

export const metadata: Metadata = {
  metadataBase: new URL(SITE.seo.url),
  ...baseMetadata,
  title: {
    default: SITE.seo.title,
    template: SITE.seo.titleTemplate
  },
  applicationName: SITE.info.name,
  manifest: "/manifest.webmanifest",
  // iOS: "Agregar a inicio" abre sin la barra del navegador
  appleWebApp: {
    capable: true,
    title: SITE.info.name,
    statusBarStyle: "black"
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  }
}

export const viewport: Viewport = {
  // El shell móvil usa env(safe-area-inset-*) (barra inferior, hoja)
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: SITE.seo.themeColor.light
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: SITE.seo.themeColor.dark
    }
  ]
}

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang={SITE.seo.lang}
      className={cn("font-sans", sans.variable)}
      suppressHydrationWarning
    >
      <body>
        <JsonLd
          schema={[
            buildApplicationSchema(),
            buildWebsiteSchema(),
            buildAuthorSchema()
          ]}
        />
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
