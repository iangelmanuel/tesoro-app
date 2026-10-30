import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { AccountSection } from "@/features/account/components/account-section"
import { AvatarUploader } from "@/features/account/components/avatar-uploader"
import { CurrencyForm } from "@/features/account/components/currency-form"
import { ProfileForm } from "@/features/account/components/profile-form"
import { getAccount } from "@/features/account/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Cuenta",
  path: SITE.routes.account,
  noindex: true
})

export default function AccountPage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Tu perfil, tus preferencias y la seguridad de tu cuenta.
        </p>
      </header>
      {/* La sesión es dinámica: va dentro de Suspense */}
      <Suspense fallback={<AccountSkeleton />}>
        <AccountContent />
      </Suspense>
    </section>
  )
}

async function AccountContent() {
  const { user, profile, hasPassword } = await getAccount()

  return (
    <>
      <AccountSection
        title="Perfil"
        description="Cómo te ves en Tesoro."
      >
        <AvatarUploader
          userId={user.id}
          name={profile.fullName}
          avatarUrl={profile.avatarUrl}
        />
        <ProfileForm fullName={profile.fullName} />
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Email</span>
          <span className="text-muted-foreground">{user.email}</span>
        </div>
      </AccountSection>

      <AccountSection
        title="Preferencias"
        description="Cómo se muestran tus montos."
      >
        <CurrencyForm currency={profile.currency} />
      </AccountSection>

      <AccountSection
        title="Seguridad"
        description={
          hasPassword
            ? "Cambia la contraseña con la que inicias sesión."
            : "Entras con Google o GitHub. Crea una contraseña para entrar también con tu email."
        }
      />

      <AccountSection
        title="Zona de peligro"
        description={`Programa el borrado de tu cuenta. Tienes ${SITE.accountDeletionGraceDays} días para restaurarla iniciando sesión.`}
        destructive
      />
    </>
  )
}

function AccountSkeleton() {
  return (
    <>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
      <Skeleton className="h-40" />
      <Skeleton className="h-32" />
    </>
  )
}
