import { type LegalSlug, SITE } from "@/config/site"
import { PRIVACY } from "@/content/legal/privacy"
import { TERMS } from "@/content/legal/terms"
import type { LegalContent } from "./components/legal-document"

const CONTENT: Record<LegalSlug, LegalContent> = {
  privacy: PRIVACY,
  terms: TERMS
}

/**
 * Documento legal de un slug: sus datos de `SITE.legal` y su contenido. Un
 * slug fuera de `SITE.legal` no tiene documento (null → la página da 404).
 */
export function findLegalDocument(slug: string) {
  const document = SITE.legal.find((item) => item.slug === slug)
  return document ? { ...document, ...CONTENT[document.slug] } : null
}
