import Link from "next/link"
import { buttonVariants } from "@heroui/react"
import { ArrowRightIcon } from "lucide-react"
import { SITE } from "@/config/site"

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="border-t"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="flex flex-col items-center gap-6 rounded-2xl border bg-surface px-6 py-14 text-center">
          <h2
            id="cta-title"
            className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Empieza hoy a ver tus finanzas con claridad
          </h2>
          <p className="max-w-xl text-pretty text-muted">
            Crear tu cuenta es gratis. Tu espacio Personal queda listo desde el
            primer momento.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={SITE.navigation.cta.href}
              className={buttonVariants({ size: "lg" })}
            >
              {SITE.navigation.cta.label}
              <ArrowRightIcon className="size-4" />
            </Link>
            <Link
              href={SITE.navigation.secondary.href}
              className={buttonVariants({ size: "lg", variant: "ghost" })}
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
