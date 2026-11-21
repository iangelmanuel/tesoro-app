import Link from "next/link"
import { CARD } from "@/components/dashboard/surface"
import { SITE, legalHref } from "@/config/site"
import { SignUpForm } from "@/features/auth/components/sign-up-form"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Crear cuenta",
  description: `Crea tu cuenta gratis en ${SITE.info.name} y empieza a ordenar tus finanzas desde el primer registro.`,
  path: SITE.routes.signUp
})

const LEGAL_LINK_CLASSES = "underline underline-offset-4 hover:text-foreground"

export default function SignUpPage() {
  return (
    <section className={CARD}>
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold">Crea tu cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Tu espacio Personal queda listo al registrarte
        </p>
      </header>
      <div>
        <SignUpForm />
        <p className="mt-6 text-center text-xs text-balance text-muted-foreground">
          Al crear tu cuenta aceptas los{" "}
          <Link
            href={legalHref("terms")}
            className={LEGAL_LINK_CLASSES}
          >
            Términos y Condiciones
          </Link>{" "}
          y la{" "}
          <Link
            href={legalHref("privacy")}
            className={LEGAL_LINK_CLASSES}
          >
            Política de Privacidad
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
