import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { ToastProvider, cn } from "@heroui/react"
import { JsonLd } from "@/components/seo/JsonLd"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { SITE } from "@/config/site"
import {
  buildApplicationSchema,
  buildAuthorSchema,
  buildMetadata,
  buildWebsiteSchema
} from "@/libs/seo"
import "@/styles/globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

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
      className={cn("font-sans", inter.variable)}
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
        <ThemeProvider>
          {children}
          <ToastProvider placement="bottom end" />
        </ThemeProvider>
      </body>
    </html>
  )
}
