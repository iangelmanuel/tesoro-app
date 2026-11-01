import { Suspense } from "react"
import { Input, Label, TextField } from "@heroui/react"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { SITE } from "@/config/site"
import { AccountSection } from "@/features/account/components/account-section"
import { AvatarUploader } from "@/features/account/components/avatar-uploader"
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

export default function AccountPage() {
  return (
    <section
      aria-label="Cuenta"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6"
    >
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
        <TextField
          name="email"
          type="email"
          value={user.email}
          isReadOnly
          className="flex flex-col gap-2"
        >
          <Label>Email</Label>
          <Input />
        </TextField>
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
      <CardSkeleton className="h-64" />
      <CardSkeleton className="h-48" />
      <CardSkeleton className="h-40" />
      <CardSkeleton className="h-32" />
    </>
  )
}
