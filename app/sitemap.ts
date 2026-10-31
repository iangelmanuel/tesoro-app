import type { MetadataRoute } from "next"
import { SITE, legalHref } from "@/config/site"

const STATIC_ROUTES: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priority: number
}> = [
  { path: SITE.routes.home, changeFrequency: "weekly", priority: 1 },
  { path: SITE.routes.signUp, changeFrequency: "yearly", priority: 0.6 },
  { path: SITE.routes.signIn, changeFrequency: "yearly", priority: 0.5 },
  {
    path: SITE.routes.forgotPassword,
    changeFrequency: "yearly",
    priority: 0.3
  },
  ...SITE.legal.map(({ slug }) => ({
    path: legalHref(slug),
    changeFrequency: "yearly" as const,
    priority: 0.3
  }))
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return STATIC_ROUTES.map((route) => ({
    url: `${SITE.seo.url}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }))
}
