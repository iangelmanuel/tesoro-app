import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // React Compiler (SPEC 56b): memoiza los componentes cliente. Los que no
  // puede optimizar sin cambiar comportamiento llevan "use no memo"
  reactCompiler: true,
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
  // Videos de la landing (SPEC 56c): una semana en el navegador, sin
  // `immutable` porque los nombres no llevan hash y al re-codificar se
  // mantiene el nombre
  async headers() {
    return [
      {
        source: "/videos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400"
          }
        ]
      }
    ]
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
