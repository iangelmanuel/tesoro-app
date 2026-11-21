import type { Metadata } from "next"
import { SITE } from "@/config/site"

/** Opciones de `buildMetadata` para la metadata de una página */
export interface SeoOptions {
  title?: string
  fullTitle?: string
  description?: string
  path?: string
  image?: string
  imageAlt?: string
  noindex?: boolean
  nofollow?: boolean
  type?: "website" | "article"
  publishedTime?: string | Date
  modifiedTime?: string | Date
  authors?: string[]
  section?: string
  tags?: string[]
  keywords?: string[]
}

/** URL absoluta sobre `SITE.seo.url`; una URL http(s) se deja como está */
export function absoluteUrl(path: string): string {
  return /^https?:\/\//i.test(path)
    ? path
    : new URL(path, `${SITE.seo.url}/`).href
}

// `@id` de las entidades de JSON-LD, para enlazarlas entre sí
function entityId(fragment: string): string {
  return `${SITE.seo.url}/#${fragment}`
}

function toIso(value?: string | Date): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

/**
 * Metadata de una página: título, canonical, robots, Open Graph y Twitter.
 * Cada `page.tsx` la usa en vez de armar la metadata a mano.
 */
export function buildMetadata(options: SeoOptions = {}): Metadata {
  const {
    title,
    fullTitle,
    description = SITE.seo.description,
    path = "/",
    image = SITE.seo.image,
    imageAlt = SITE.seo.imageAlt,
    noindex = false,
    nofollow = false,
    type = SITE.seo.ogType,
    publishedTime,
    modifiedTime,
    authors,
    section,
    tags,
    keywords = []
  } = options

  const cleanPath = (path.split("?")[0] ?? "/").replace(/\/+$/, "") || "/"
  const blockIndexing = noindex || SITE.seo.noindex
  const resolvedTitle = fullTitle ?? title ?? SITE.seo.title

  return {
    title: fullTitle ? { absolute: fullTitle } : title,
    description,
    keywords: [...SITE.seo.keywords, ...keywords],
    authors: [{ name: SITE.seo.author, url: SITE.author.url }],
    creator: SITE.seo.creator,
    publisher: SITE.seo.publisher,
    category: SITE.seo.category,
    other: { classification: SITE.seo.classification },
    alternates: {
      canonical: cleanPath,
      languages: {
        ...Object.fromEntries(
          SITE.seo.locales.map((locale) => [locale.hreflang, cleanPath])
        ),
        "x-default": cleanPath
      }
    },
    robots: blockIndexing
      ? { index: false, follow: false, nocache: true }
      : {
          index: true,
          follow: !nofollow,
          googleBot: {
            index: true,
            follow: !nofollow,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1
          }
        },
    openGraph: {
      type,
      siteName: SITE.info.name,
      title: resolvedTitle,
      description,
      url: cleanPath,
      locale: SITE.seo.locale.replace("-", "_"),
      images: [
        {
          url: absoluteUrl(image),
          width: SITE.seo.imageWidth,
          height: SITE.seo.imageHeight,
          alt: imageAlt
        }
      ],
      ...(type === "article"
        ? {
            publishedTime: toIso(publishedTime),
            modifiedTime: toIso(modifiedTime),
            authors,
            section,
            tags
          }
        : {})
    },
    twitter: {
      card: SITE.seo.twitterCard,
      title: resolvedTitle,
      description,
      images: [{ url: absoluteUrl(image), alt: imageAlt }],
      ...(SITE.seo.twitterHandle
        ? {
            site: SITE.seo.twitterHandle,
            creator: SITE.seo.twitterAuthor ?? SITE.seo.twitterHandle
          }
        : {})
    }
  }
}

/** JSON-LD `Person` del autor (`#author`) */
export function buildAuthorSchema(): Record<string, unknown> {
  const sameAs: string[] = Object.values(SITE.social)

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": entityId("author"),
    name: SITE.author.name,
    alternateName: SITE.author.alias,
    url: SITE.author.url,
    sameAs
  }
}

/** JSON-LD `WebApplication` de Tesoro (`#application`), enlazado al autor */
export function buildApplicationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": entityId("application"),
    name: SITE.info.name,
    alternateName: SITE.info.legalName,
    description: SITE.info.description,
    slogan: SITE.info.slogan,
    url: SITE.seo.url,
    image: absoluteUrl(SITE.seo.image),
    logo: absoluteUrl(SITE.seo.logo),
    applicationCategory: SITE.seo.applicationCategory,
    operatingSystem: SITE.seo.operatingSystem,
    inLanguage: SITE.seo.locale,
    softwareVersion: SITE.info.version,
    license: `${SITE.repository.url}/blob/main/LICENSE`,
    isAccessibleForFree: true,
    codeRepository: SITE.repository.url,
    datePublished: String(SITE.info.founded),
    featureList: SITE.features.map((feature) => feature.title),
    offers: {
      "@type": "Offer",
      price: SITE.seo.price,
      priceCurrency: SITE.seo.currency
    },
    author: { "@id": entityId("author") },
    creator: { "@id": entityId("author") }
  }
}

/** JSON-LD `WebSite` (`#website`), enlazado a la app y al autor */
export function buildWebsiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": entityId("website"),
    url: SITE.seo.url,
    name: SITE.info.name,
    description: SITE.seo.description,
    inLanguage: SITE.seo.locale,
    publisher: { "@id": entityId("author") }
  }
}

/**
 * Video principal de la landing (SPEC 24). Duración en ISO 8601 y todas las
 * URLs absolutas, como pide Google para los resultados de video
 */
export function buildVideoSchema(): Record<string, unknown> {
  const { demo } = SITE.landing

  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": entityId("demo-video"),
    name: demo.title,
    description: demo.description,
    thumbnailUrl: [absoluteUrl(demo.sources.poster)],
    uploadDate: demo.uploadDate,
    duration: `PT${demo.durationSeconds}S`,
    contentUrl: absoluteUrl(demo.sources.mp4),
    embedUrl: absoluteUrl("/#demo"),
    width: demo.width,
    height: demo.height,
    inLanguage: SITE.seo.locale,
    isFamilyFriendly: true,
    about: { "@id": entityId("application") },
    publisher: { "@id": entityId("author") }
  }
}

/** JSON-LD `BreadcrumbList` con las migas de una página pública */
export function buildBreadcrumbSchema(
  crumbs: { label: string; href: string }[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: absoluteUrl(crumb.href)
    }))
  }
}
