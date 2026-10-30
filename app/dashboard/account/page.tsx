import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { SITE } from "@/config/site"
import { AccountSection } from "@/features/account/components/account-section"
import { AvatarUploader } from "@/features/account/components/avatar-uploader"
import { ChangeEmailForm } from "@/features/account/components/change-email-form"
import { CurrencyForm } from "@/features/account/components/currency-form"
import { DeleteAccountDialog } from "@/features/account/components/delete-account-dialog"
import { PasswordForm } from "@/features/account/components/password-form"
import { ProfileForm } from "@/features/account/components/profile-form"
import { getAccount } from "@/features/account/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Cuenta",
  path: SITE.routes.account,
  noindex: true
})

const NOTICES: Record<string, string> = {
  "email-confirmed":
    "Enlace confirmado. Si aún no ves el cambio, confirma también el otro correo."
}

type AccountPageProps = PageProps<"/dashboard/account">

export default function AccountPage({ searchParams }: AccountPageProps) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Tu perfil, tus preferencias y la seguridad de tu cuenta.
        </p>
      </header>
      {/* searchParams y la sesión son dinámicos: van dentro de Suspense */}
      <Suspense fallback={<AccountSkeleton />}>
        <AccountContent searchParams={searchParams} />
      </Suspense>
    </section>
  )
}

async function AccountContent({
  searchParams
}: Pick<AccountPageProps, "searchParams">) {
  const query = await searchParams
  const notice =
    typeof query.notice === "string" ? NOTICES[query.notice] : undefined
  const { user, profile, hasPassword } = await getAccount()

  return (
    <>
      {notice && (
        <p
          role="status"
          className="rounded-lg border bg-muted/50 px-4 py-3 text-sm"
        >
          {notice}
        </p>
      )}
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
        <ChangeEmailForm
          email={user.email}
          newEmail={user.newEmail}
        />
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
