import type Metadata from "next"
import { SITE } from "@/config/site"

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

export function absoluteUrl(path: string): string {
  return /^https?:\/\//i.test(path)
    ? path
    : new URL(path, `${SITE.seo.url}/`).href
}

function toIso(value?: string | Date): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

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
          SITE.seo.locales.map((l) => [l.hreflang, cleanPath])
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

export function buildAuthorSchema(): Record<string, unknown> {
  const sameAs: string[] = Object.values(SITE.social)

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE.seo.url}/#author`,
    name: SITE.author.name,
    alternateName: SITE.author.alias,
    url: SITE.author.url,
    sameAs
  }
}

export function buildApplicationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE.seo.url}/#application`,
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
    author: { "@id": `${SITE.seo.url}/#author` },
    creator: { "@id": `${SITE.seo.url}/#author` }
  }
}

export function buildWebsiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.seo.url}/#website`,
    url: SITE.seo.url,
    name: SITE.info.name,
    description: SITE.seo.description,
    inLanguage: SITE.seo.locale,
    publisher: { "@id": `${SITE.seo.url}/#author` }
  }
}

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
