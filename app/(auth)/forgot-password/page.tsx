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
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Olvidé mi contraseña",
  description: `Recupera el acceso a tu cuenta de ${SITE.info.name} con un enlace a tu email.`,
  path: SITE.routes.forgotPassword
})

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">¿Olvidaste tu contraseña?</CardTitle>
        <CardDescription>
          Te enviamos un enlace para elegir una nueva
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* useSearchParams (error) exige un Suspense con cacheComponents */}
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <ForgotPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
