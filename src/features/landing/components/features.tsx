import { SITE } from "@/config/site"
import { FeatureTour } from "./feature-tour"
import { SectionHeading } from "./section-heading"

// Cada función con pantalla trae su clip (SITE.landing.clips, unido por el
// título). "Código abierto" no tiene pantalla: lo cuenta su propia sección.
const TOUR = SITE.landing.clips.flatMap((clip) => {
  const feature = SITE.features.find((item) => item.title === clip.feature)
  return feature
    ? [
        {
          title: feature.title,
          description: feature.description,
          slug: clip.slug,
          sources: clip.sources
        }
      ]
    : []
})

export function Features() {
  return (
    <section
      id="funciones"
      aria-labelledby="funciones-title"
      className="scroll-mt-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          id="funciones-title"
          title="Tú registras. Tesoro ordena."
          description="Anotas tus movimientos o los importas desde Excel o CSV, sin conectar bancos ni compartir contraseñas. Lo demás sale de ahí."
        />
        <FeatureTour items={TOUR} />
      </div>
    </section>
  )
}
