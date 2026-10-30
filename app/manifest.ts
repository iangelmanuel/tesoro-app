import type { MetadataRoute } from "next"
import { SITE } from "@/config/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.info.name,
    short_name: SITE.info.name,
    description: SITE.seo.description,
    start_url: SITE.routes.dashboard,
    scope: "/",
    display: "standalone",
    background_color: SITE.seo.themeColor.dark,
    theme_color: SITE.seo.themeColor.dark,
    lang: SITE.seo.locale,
    dir: "ltr",
    categories: [...SITE.seo.manifestCategories],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  }
}
