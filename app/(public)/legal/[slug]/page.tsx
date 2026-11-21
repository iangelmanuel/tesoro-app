import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { JsonLd } from "@/components/seo/json-ld"
import { SITE, legalHref } from "@/config/site"
import { LegalDocument } from "@/features/legal/components/legal-document"
import { findLegalDocument } from "@/features/legal/documents"
import { buildBreadcrumbSchema, buildMetadata } from "@/libs/seo"

type LegalPageProps = PageProps<"/legal/[slug]">

export function generateStaticParams() {
  return SITE.legal.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params
}: LegalPageProps): Promise<Metadata> {
  const { slug } = await params
  const document = findLegalDocument(slug)

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
  const document = findLegalDocument(slug)

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
