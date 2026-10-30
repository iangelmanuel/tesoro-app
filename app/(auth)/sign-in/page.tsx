import { Suspense } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
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
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Inicia sesión</CardTitle>
        <CardDescription>Con tu email o con Google o GitHub</CardDescription>
      </CardHeader>
      <CardContent>
        {/* useSearchParams (next, error) exige un Suspense con cacheComponents */}
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <SignInForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
