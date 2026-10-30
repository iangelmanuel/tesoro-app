import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { JsonLd } from "@/components/seo/JsonLd"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { SITE } from "@/config/site"
import {
  buildApplicationSchema,
  buildAuthorSchema,
  buildMetadata,
  buildWebsiteSchema
} from "@/libs/seo"
import { cn } from "@/libs/utils"
import "@/styles/globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

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
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  }
}

export const viewport: Viewport = {
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
      className={cn("font-sans", geist.variable)}
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
