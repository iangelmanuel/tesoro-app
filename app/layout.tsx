import type Viewport from "next"
import type Metadata from "next"
import { JsonLd } from "@/components/seo/JsonLd"
import { SITE } from "@/config/site"
import {
  buildApplicationSchema,
  buildAuthorSchema,
  buildMetadata,
  buildWebsiteSchema
} from "@/libs/seo"
import "@/styles/globals.css"

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
    <html lang={SITE.seo.lang}>
      <body>
        <JsonLd
          schema={[
            buildApplicationSchema(),
            buildWebsiteSchema(),
            buildAuthorSchema()
          ]}
        />
        {children}
      </body>
    </html>
  )
}
