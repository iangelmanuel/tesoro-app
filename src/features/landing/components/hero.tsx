import Link from "next/link"
import { buttonVariants } from "@heroui/react"
import { ArrowRightIcon } from "lucide-react"
import { SITE } from "@/config/site"
import { HeroSceneLoader } from "./hero-scene-loader"
import { LandingHeroVisual } from "./hero-visual"
import { Pressable, Reveal } from "./reveal"

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
          <Reveal immediate>
            <p className="rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted">
              Gratis y de código abierto · Licencia {SITE.info.license}
            </p>
          </Reveal>
          <Reveal
            immediate
            delay={0.08}
          >
            <h1
              id="hero-title"
              className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
            >
              Tus finanzas personales y las de tu negocio, en un solo lugar
            </h1>
          </Reveal>
          <Reveal
            immediate
            delay={0.16}
          >
            <p className="max-w-xl text-lg text-pretty text-muted">
              {SITE.info.slogan} Registra ingresos, gastos, deudas y metas, y{" "}
              {SITE.info.name} los convierte en gráficas, recomendaciones y un
              score de salud financiera.
            </p>
          </Reveal>
          <Reveal
            immediate
            delay={0.24}
            className="flex flex-wrap gap-3"
          >
            <Pressable>
              <Link
                href={SITE.navigation.cta.href}
                className={buttonVariants({ size: "lg" })}
              >
                {SITE.navigation.cta.label}
                <ArrowRightIcon className="size-4" />
              </Link>
            </Pressable>
            <Pressable>
              <a
                href={SITE.repository.url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                Ver en GitHub
              </a>
            </Pressable>
          </Reveal>
        </div>
        <HeroSceneLoader>
          <LandingHeroVisual />
        </HeroSceneLoader>
      </div>
    </section>
  )
}
