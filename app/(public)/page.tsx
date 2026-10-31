import { SITE } from "@/config/site"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  fullTitle: SITE.seo.title,
  path: "/"
})

export default function HomePage() {
  return (
    <main>
      <h1>{SITE.info.name}</h1>
      <p>{SITE.info.slogan}</p>
      <p>
        Versión {SITE.info.version}: primera versión del proyecto. Por ahora
        solo están la configuración base, el SEO y la documentación; la landing,
        la autenticación y el dashboard llegarán en las próximas versiones.
        🏴‍☠️🦜🪙
      </p>
    </main>
  )
}
