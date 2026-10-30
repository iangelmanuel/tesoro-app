import type { MetadataRoute } from "next"
import { SITE } from "@/config/site"

export default function robots(): MetadataRoute.Robots {
  if (SITE.seo.noindex) {
    return {
      rules: { userAgent: "*", disallow: "/" }
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/api/", "/auth/"]
    },
    sitemap: `${SITE.seo.url}/sitemap.xml`,
    host: SITE.seo.url
  }
}
