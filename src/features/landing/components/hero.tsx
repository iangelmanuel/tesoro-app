import { getImageProps } from "next/image"
import Link from "next/link"
import { buttonVariants } from "@heroui/react"
import { ArrowRightIcon, PlayIcon } from "lucide-react"
import { SITE } from "@/config/site"
import { HeroVideo } from "./hero-video"

// Lo que más tranquiliza a quien llega: va arriba, junto a los CTA
const PROMISES = [
  "Gratis",
  "Sin conectar bancos",
  `Código abierto (${SITE.info.license})`
]

// Pósters del video (primer fotograma de cada variante). Van en un <picture>
// debajo del video: son el primer pintado y el LCP, y lo único que se ve con
// reduced motion, ahorro de datos o sin JS. El atributo poster del <video> no
// sirve aquí porque no cambia con el ancho y en móvil saltaría al encuadre
// vertical al arrancar
const POSTER_COMMON = { alt: "", sizes: "100vw", unoptimized: true }
const {
  props: { srcSet: desktopPoster }
} = getImageProps({
  ...POSTER_COMMON,
  src: "/videos/hero-poster.webp",
  width: 1920,
  height: 1080
})
const {
  props: { srcSet: mobilePoster, ...posterProps }
} = getImageProps({
  ...POSTER_COMMON,
  src: "/videos/hero-mobile-poster.webp",
  width: 720,
  height: 1280
})

// Hero (SPEC 40): banda oscura en los dos temas (clase dark), con el video de
// ambiente de fondo, un velo y el texto encima. Sube bajo el header (-mt-16)
// para que el header transparente quede sobre el video. Todo tamaño sale de
// CSS: ni el video ni la isla cambian el layout
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="dark relative isolate -mt-16 overflow-hidden bg-background text-foreground"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
      >
        <picture>
          <source
            media="(max-width: 767px)"
            srcSet={mobilePoster}
          />
          <source srcSet={desktopPoster} />
          <img
            {...posterProps}
            alt=""
            // Es el LCP: getImageProps lo deja en lazy por defecto
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover"
          />
        </picture>
        <HeroVideo />
        {/* Velo: ≥ 72 % de negro detrás del texto, para que el texto
            atenuado dé AA (4.7:1) sobre el fotograma más claro del loop. En
            escritorio se aclara hacia la derecha, donde no hay texto */}
        <div className="absolute inset-0 bg-black/72 lg:bg-transparent lg:bg-linear-to-r lg:from-black/75 lg:via-black/72 lg:via-58% lg:to-black/30" />
      </div>

      <div className="mx-auto flex min-h-[min(88svh,52rem)] max-w-6xl flex-col justify-center px-4 pt-28 pb-16 sm:px-6 sm:pt-32 sm:pb-24">
        <div className="flex max-w-2xl flex-col items-start gap-6">
          <div className="hero-enter">
            <h1
              id="hero-title"
              className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
            >
              {SITE.info.slogan}
            </h1>
          </div>
          <div
            className="hero-enter"
            style={{ "--hero-delay": "80ms" } as React.CSSProperties}
          >
            <p className="max-w-xl text-lg text-pretty text-muted">
              Anota lo que entra y lo que sale, en casa y en tu negocio.{" "}
              {SITE.info.name} lo convierte en gráficas, un score y pasos
              concretos.
            </p>
          </div>
          <div
            className="hero-enter flex flex-wrap gap-3"
            style={{ "--hero-delay": "160ms" } as React.CSSProperties}
          >
            <span className="press inline-flex">
              <Link
                href={SITE.navigation.cta.href}
                prefetch={false}
                className={buttonVariants({ size: "lg" })}
              >
                {SITE.navigation.cta.label}
                <ArrowRightIcon className="size-4" />
              </Link>
            </span>
            <span className="press inline-flex">
              <a
                href="#demo"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                <PlayIcon className="size-4" />
                Ver la demo
              </a>
            </span>
          </div>
          <div
            className="hero-enter"
            style={{ "--hero-delay": "240ms" } as React.CSSProperties}
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
          </div>
        </div>
      </div>
    </section>
  )
}
