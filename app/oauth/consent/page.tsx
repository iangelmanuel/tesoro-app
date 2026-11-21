import { Suspense } from "react"
import type { Route } from "next"
import { redirect } from "next/navigation"
import { Bot } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { CARD } from "@/components/dashboard/data/surface"
import { EmptyState } from "@/components/dashboard/feedback/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { deletionRequestedAt } from "@/features/account/deletion"
import { ConsentForm } from "@/features/mcp/components/consent-form"
import { buildMetadata } from "@/libs/seo"
import { createClient } from "@/libs/supabase/server"

export const metadata = buildMetadata({
  title: "Autorizar agente",
  path: SITE.routes.oauthConsent,
  noindex: true
})

const CAPABILITIES = [
  "Ver tus espacios, cuentas, movimientos, presupuestos, metas, deudas, reportes y score.",
  "Con Leer y escribir: registrar, editar, borrar y revertir movimientos, pagos y traspasos, y crear y editar cuentas, deudas, fijos, metas y presupuestos.",
  "Puedes cambiar el acceso o revocarlo cuando quieras en Cuenta → Agentes IA."
]

// Pantalla de consentimiento del servidor OAuth de Supabase (SPEC 34). El
// agente (Claude, ChatGPT…) manda aquí al usuario con ?authorization_id=…
export default function OAuthConsentPage({
  searchParams
}: PageProps<"/oauth/consent">) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-highlight p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Logo
          size="lg"
          className="self-center"
        />
        {/* La sesión y la query son dinámicas: van dentro de Suspense */}
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
          <ConsentContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}

function InvalidRequest() {
  return (
    <EmptyState
      icon={Bot}
      title="Esta solicitud ya no es válida"
      description="Vuelve a conectar desde tu agente."
    />
  )
}

async function ConsentContent({
  searchParams
}: Pick<PageProps<"/oauth/consent">, "searchParams">) {
  const { authorization_id: rawId } = await searchParams
  const authorizationId = typeof rawId === "string" ? rawId.trim() : ""

  if (!authorizationId) {
    return <InvalidRequest />
  }

  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  // proxy.ts ya lo hace; esto cubre una sesión que vence entre ambos
  if (!user) {
    const next = `${SITE.routes.oauthConsent}?authorization_id=${encodeURIComponent(authorizationId)}`
    redirect(`${SITE.routes.signIn}?next=${encodeURIComponent(next)}` as Route)
  }
  if (deletionRequestedAt(user) !== null) {
    redirect(SITE.routes.accountDeleted)
  }

  const { data: details, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

  if (error || !details) {
    return <InvalidRequest />
  }
  // Ya autorizado antes: Supabase devuelve directo la URL de vuelta
  if (!("authorization_id" in details)) {
    redirect(details.redirect_url as Route)
  }

  const clientName = details.client.name.trim() || "Un agente de IA"

  return (
    <section className={CARD}>
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-normal text-balance">
          <strong className="font-semibold">{clientName}</strong> quiere acceder
          a tu cuenta de {SITE.info.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Sesión iniciada como{" "}
          <span className="font-medium text-foreground">
            {details.user.email || user.email}
          </span>
        </p>
      </header>
      <div className="flex flex-col gap-6">
        <ul className="flex flex-col gap-2 text-sm">
          {CAPABILITIES.map((item) => (
            <li
              key={item}
              className="flex gap-2"
            >
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <ConsentForm authorizationId={details.authorization_id} />
      </div>
    </section>
  )
}
