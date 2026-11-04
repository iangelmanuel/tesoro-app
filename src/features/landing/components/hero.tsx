import Link from "next/link"
import { buttonVariants } from "@heroui/react"
import { ArrowRightIcon, PlayIcon } from "lucide-react"
import { SITE } from "@/config/site"
import { HeroSceneLoader } from "./hero-scene-loader"
import { LandingHeroVisual } from "./hero-visual"
import { Pressable, Reveal } from "./reveal"

// Lo que más tranquiliza a quien llega: va arriba, junto a los CTA
const PROMISES = [
  "Gratis",
  "Sin conectar bancos",
  `Código abierto (${SITE.info.license})`
]

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col items-start gap-6">
          <Reveal immediate>
            <h1
              id="hero-title"
              className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
            >
              {SITE.info.slogan}
            </h1>
          </Reveal>
          <Reveal
            immediate
            delay={0.08}
          >
            <p className="max-w-xl text-lg text-pretty text-muted">
              Anota lo que entra y lo que sale, en tu vida y en tu negocio.{" "}
              {SITE.info.name} lo ordena en gráficas, un score de salud
              financiera y recomendaciones concretas.
            </p>
          </Reveal>
          <Reveal
            immediate
            delay={0.16}
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
                href="#demo"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                <PlayIcon className="size-4" />
                Ver la demo
              </a>
            </Pressable>
          </Reveal>
          <Reveal
            immediate
            delay={0.24}
          >
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {PROMISES.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2"
                >
                  <span
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-(--income)"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <HeroSceneLoader>
          <LandingHeroVisual />
        </HeroSceneLoader>
      </div>
    </section>
  )
}
