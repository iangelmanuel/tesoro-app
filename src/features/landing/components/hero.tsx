import { getImageProps } from "next/image"
import Link from "next/link"
import { buttonVariants, cn } from "@heroui/react"
import { ArrowRightIcon, PlayIcon } from "lucide-react"
import { SITE } from "@/config/site"
import { HeroVideo } from "./hero-video"

// Lo que más tranquiliza a quien llega: va abajo, como pie del hero
const PROMISES = [
  "Gratis",
  "Sin conectar bancos",
  `Código abierto (${SITE.info.license})`
]

// El slogan en dos tiempos: "Tus finanzas," y "claras desde el primer
// registro." La segunda parte lleva el verde de marca (color sólido, no
// degradado). Sin coma, va entero en blanco
const [SLOGAN_LEAD, SLOGAN_ACCENT] = (() => {
  const index = SITE.info.slogan.indexOf(", ")
  return index === -1
    ? [SITE.info.slogan, ""]
    : [SITE.info.slogan.slice(0, index + 1), SITE.info.slogan.slice(index + 2)]
})()

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

const delay = (ms: number) =>
  ({ "--hero-delay": `${ms}ms` }) as React.CSSProperties

// Hero (SPEC 40): el video ocupa toda la pantalla, también detrás del
// header (sube 4 rem con -mt-16), y el texto se apoya abajo a la izquierda,
// como el pie de una foto. Banda oscura en los dos temas (clase dark). Todo
// tamaño sale de CSS: ni el video ni la isla cambian el layout
export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="dark relative isolate -mt-16 flex min-h-[max(36rem,100svh)] flex-col overflow-hidden bg-background text-foreground"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
      >
        <div className="hero-media absolute inset-0">
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
        </div>
        <div className="hero-veil absolute inset-0" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-4 pt-32 sm:px-6">
        <div className="flex max-w-4xl flex-col items-start gap-7 pb-12 sm:pb-16">
          <h1
            id="hero-title"
            className="hero-enter text-5xl leading-[0.95] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl"
          >
            {SLOGAN_LEAD}
            {SLOGAN_ACCENT && (
              <>
                {" "}
                <span className="text-brand">{SLOGAN_ACCENT}</span>
              </>
            )}
          </h1>
          <p
            className="hero-enter max-w-xl text-lg text-pretty text-muted sm:text-xl"
            style={delay(80)}
          >
            Anota lo que entra y lo que sale, en casa y en tu negocio.{" "}
            {SITE.info.name} lo convierte en gráficas, un score y pasos
            concretos.
          </p>
          <div
            className="hero-enter flex flex-wrap gap-3"
            style={delay(160)}
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
                className={cn(
                  buttonVariants({ size: "lg", variant: "ghost" }),
                  "bg-white/10 text-foreground backdrop-blur-md hover:bg-white/16"
                )}
              >
                <PlayIcon className="size-4" />
                Ver la demo
              </a>
            </span>
          </div>
        </div>

        {/* Pie del hero: las promesas sobre una línea fina */}
        <ul
          className="hero-enter flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 py-5 text-sm text-muted"
          style={delay(240)}
        >
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
    </section>
  )
}
