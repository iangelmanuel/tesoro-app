import { Suspense } from "react"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { SITE } from "@/config/site"
import { AccountSection } from "@/features/account/components/account-section"
import { DeleteAccountDialog } from "@/features/account/components/delete-account-dialog"
import { PasswordForm } from "@/features/account/components/password-form"
import { getAccount } from "@/features/account/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Cuenta · Seguridad",
  path: "/dashboard/account/security",
  noindex: true
})

export default function AccountSecurityPage() {
  return (
    // La sesión es dinámica: va dentro de Suspense
    <Suspense
      fallback={
        <>
          <CardSkeleton className="h-48" />
          <CardSkeleton className="h-32" />
        </>
      }
    >
      <SecurityContent />
    </Suspense>
  )
}

async function SecurityContent() {
  const { user, hasPassword } = await getAccount()

  return (
    <>
      <AccountSection
        title="Contraseña"
        description={
          hasPassword
            ? "Cambia la contraseña con la que inicias sesión."
            : "Entras con Google o GitHub. Crea una contraseña para entrar también con tu email."
        }
      >
        {/* key: al crear la contraseña el formulario cambia de modo limpio */}
        <PasswordForm
          key={String(hasPassword)}
          hasPassword={hasPassword}
        />
      </AccountSection>

      <AccountSection
        title="Zona de peligro"
        description={`Programa el borrado de tu cuenta. Tienes ${SITE.accountDeletionGraceDays} días para restaurarla iniciando sesión.`}
        destructive
      >
        <DeleteAccountDialog email={user.email} />
      </AccountSection>
    </>
  )
}
