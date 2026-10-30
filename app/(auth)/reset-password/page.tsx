import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { SITE } from "@/config/site"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Nueva contraseña",
  description: `Elige una nueva contraseña para tu cuenta de ${SITE.info.name}.`,
  path: SITE.routes.resetPassword,
  noindex: true
})

// Sin sesión, proxy.ts redirige a /forgot-password?error=expired
export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Elige una nueva contraseña</CardTitle>
        <CardDescription>Mínimo 8 caracteres</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  )
}
