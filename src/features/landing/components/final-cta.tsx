import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SITE } from "@/config/site"

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-title"
      className="border-t"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="flex flex-col items-center gap-6 rounded-2xl border bg-card px-6 py-14 text-center">
          <h2
            id="cta-title"
            className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Empieza hoy a ver tus finanzas con claridad
          </h2>
          <p className="max-w-xl text-pretty text-muted-foreground">
            Crear tu cuenta es gratis. Tu espacio Personal queda listo desde el
            primer momento.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
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
              variant="ghost"
              className="h-11 px-5"
            >
              <Link href={SITE.navigation.secondary.href}>Ya tengo cuenta</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
