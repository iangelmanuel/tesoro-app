import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { SITE } from "@/config/site"
import { SignUpForm } from "@/features/auth/components/sign-up-form"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Crear cuenta",
  description: `Crea tu cuenta gratis en ${SITE.info.name} y empieza a ordenar tus finanzas desde el primer registro.`,
  path: SITE.routes.signUp
})

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Crea tu cuenta</CardTitle>
        <CardDescription>
          Tu espacio Personal queda listo al registrarte
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
    </Card>
  )
}
