import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { JsonLd } from "@/components/seo/JsonLd"
import { type LegalSlug, SITE, legalHref } from "@/config/site"
import { PRIVACY } from "@/content/legal/privacy"
import { TERMS } from "@/content/legal/terms"
import {
  type LegalContent,
  LegalDocument
} from "@/features/legal/components/legal-document"
import { buildBreadcrumbSchema, buildMetadata } from "@/libs/seo"

type LegalPageProps = PageProps<"/legal/[slug]">

const CONTENT: Record<LegalSlug, LegalContent> = {
  privacy: PRIVACY,
  terms: TERMS
}

// Un slug fuera de SITE.legal no tiene documento: la página responde 404
function findDocument(slug: string) {
  const document = SITE.legal.find((item) => item.slug === slug)
  return document ? { ...document, ...CONTENT[document.slug] } : null
}

export function generateStaticParams() {
  return SITE.legal.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params
}: LegalPageProps): Promise<Metadata> {
  const { slug } = await params
  const document = findDocument(slug)

  if (!document) {
    return {}
  }

  return buildMetadata({
    title: document.title,
    description: document.description,
    path: legalHref(document.slug),
    modifiedTime: document.updatedAt
  })
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params
  const document = findDocument(slug)

  if (!document) {
    notFound()
  }

  return (
    <main>
      <JsonLd
        schema={buildBreadcrumbSchema([
          { label: "Inicio", href: SITE.routes.home },
          { label: document.title, href: legalHref(document.slug) }
        ])}
      />
      <LegalDocument
        title={document.title}
        updatedAt={document.updatedAt}
        sections={document.sections}
      />
    </main>
  )
}
