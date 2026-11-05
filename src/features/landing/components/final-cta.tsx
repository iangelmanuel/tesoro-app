import Link from "next/link"
import { buttonVariants } from "@heroui/react"
import { ArrowRightIcon } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { SITE } from "@/config/site"
import { Reveal } from "./reveal"

// Cierre: repite el final del video demo (isotipo, slogan y CTA) para que la
// última imagen de la página sea la marca, no una tarjeta genérica
export function FinalCta() {
  return (
    <section aria-labelledby="cta-title">
      <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
        <Logo
          variant="mark"
          size="lg"
          className="[&_svg]:size-16"
        />
        <h2
          id="cta-title"
          className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
        >
          {SITE.info.slogan}
        </h2>
        <p className="max-w-lg text-pretty text-muted">
          Crear tu cuenta es gratis y tu espacio Personal queda listo al
          instante.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
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
          <Link
            href={SITE.navigation.secondary.href}
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-muted underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-focus"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </Reveal>
    </section>
  )
}
