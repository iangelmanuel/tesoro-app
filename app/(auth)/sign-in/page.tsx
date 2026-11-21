import { Suspense } from "react"
import { CARD } from "@/components/dashboard/data/surface"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { SignInForm } from "@/features/auth/components/sign-in-form"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Iniciar sesión",
  description: `Inicia sesión en ${SITE.info.name} para ver tus finanzas personales y de tu empresa.`,
  path: SITE.routes.signIn
})

export default function SignInPage() {
  return (
    <section className={CARD}>
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold">Inicia sesión</h1>
        <p className="text-sm text-muted-foreground">
          Con tu email o con Google o GitHub
        </p>
      </header>
      <div>
        {/* useSearchParams (next, error) exige un Suspense con cacheComponents */}
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <SignInForm />
        </Suspense>
      </div>
    </section>
  )
}
