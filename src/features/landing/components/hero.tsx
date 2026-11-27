import { getImageProps } from "next/image"
import Link from "next/link"
import { ArrowRightIcon, PlayIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { SITE } from "@/config/site"
import { cn } from "@/libs/cn"
import { HeroVideo } from "./hero-video"

// Lo que más tranquiliza a quien llega: va abajo, como pie del hero
const PROMISES = [
  "Gratis",
  "Sin conectar bancos",
  `Código abierto (${SITE.info.license})`
]

// El slogan en dos tiempos: "Tus finanzas," y "claras desde el primer
// registro." La segunda parte va en verde profundo (`.hero-accent`, color
// sólido, no degradado). Sin coma, va entero en blanco
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
// vertical al arrancar. Sin optimizar, getImageProps no devuelve `srcSet`:
// las <source> llevan la ruta del archivo tal cual (SPEC 56c)
const DESKTOP_POSTER = "/videos/hero-poster.webp"
const MOBILE_POSTER = "/videos/hero-mobile-poster.webp"
const { props: posterProps } = getImageProps({
  alt: "",
  sizes: "100vw",
  unoptimized: true,
  src: MOBILE_POSTER,
  width: 720,
  height: 1280
})

const delay = (ms: number) =>
  ({ "--hero-delay": `${ms}ms` }) as React.CSSProperties

// Hero (SPEC 40, rehecho): video a pantalla completa y a todo color, también
// detrás del header (sube 4 rem con -mt-16). Sobre el video solo hay
// sombra, nunca blanco: un degradado oscuro corto arriba para el header y
// otro abajo, donde va el texto en blanco (`.on-media` cambia los tokens de
// texto, primario y borde dentro de la sección). La página sigue en claro;
// el hero es una foto oscura. Todo tamaño sale de CSS
export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      data-header-tone="on-media"
      className="on-media relative isolate -mt-16 flex min-h-[max(38rem,100svh)] flex-col overflow-hidden bg-[oklch(0.16_0.012_165)] text-foreground"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
      >
        <div className="hero-media absolute inset-0">
          <picture>
            <source
              media="(max-width: 767px)"
              srcSet={MOBILE_POSTER}
              width={720}
              height={1280}
            />
            <source
              srcSet={DESKTOP_POSTER}
              width={1920}
              height={1080}
            />
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
        <div className="hero-shade absolute inset-0" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-4 pt-32 sm:px-6">
        <div className="flex max-w-3xl flex-col items-start gap-7 pb-10 sm:pb-14">
          <h1
            id="hero-title"
            className="hero-enter text-5xl leading-[0.95] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl"
          >
            {SLOGAN_LEAD}
            {SLOGAN_ACCENT && (
              <>
                {" "}
                <span className="hero-accent">{SLOGAN_ACCENT}</span>
              </>
            )}
          </h1>
          <p
            className="hero-enter max-w-xl text-lg text-pretty text-foreground/90 sm:text-xl"
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
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "border-white/50 hover:border-white/70"
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
          className="hero-enter flex flex-wrap gap-x-6 gap-y-2 border-t border-border py-5 text-sm font-medium text-muted-foreground"
          style={delay(240)}
        >
          {PROMISES.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-(--hero-dot)"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
