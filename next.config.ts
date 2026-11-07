import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // Reportes PDF (SPEC 33): empaquetado, pdfkit (dependencia de pdfmake)
  // pierde sus imports internos `#standard-fonts/*`. jsdom ya viene externo
  serverExternalPackages: ["pdfmake"],
  experimental: {
    serverActions: {
      // Importar movimientos (SPEC 08) envía hasta 2.000 filas mapeadas,
      // que con descripción y nota máximas superan el 1 MB por defecto
      bodySizeLimit: "2mb"
    }
  },
  images: {
    formats: ["image/avif", "image/webp"]
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css"
      }
    }
  }
}

export default nextConfig
