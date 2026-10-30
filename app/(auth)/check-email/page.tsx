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
import { CheckEmailForm } from "@/features/auth/components/check-email-form"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Revisa tu email",
  description: `Confirma tu email para empezar a usar ${SITE.info.name}.`,
  path: SITE.routes.checkEmail,
  noindex: true
})

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Revisa tu email</CardTitle>
        <CardDescription>Falta un paso para crear tu cuenta</CardDescription>
      </CardHeader>
      <CardContent>
        {/* useSearchParams (email) exige un Suspense con cacheComponents */}
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <CheckEmailForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
