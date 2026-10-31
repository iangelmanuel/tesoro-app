import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-120 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--income)_22%,transparent),transparent_65%)]"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-6">
          <p className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            Gratis y de código abierto · Licencia {SITE.info.license}
          </p>
          <h1
            id="hero-title"
            className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Tus finanzas personales y las de tu negocio, en un solo lugar
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            {SITE.info.slogan} Registra ingresos, gastos, deudas y metas, y{" "}
            {SITE.info.name} los convierte en gráficas, recomendaciones y un
            score de salud financiera.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="h-11 px-5"
            >
              <Link href={SITE.navigation.cta.href}>
                {SITE.navigation.cta.label}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 px-5"
            >
              <a
                href={SITE.repository.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver en GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
