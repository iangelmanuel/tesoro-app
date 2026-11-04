import { Suspense } from "react"
import { Input, Label, TextField } from "@heroui/react"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { AccountSection } from "@/features/account/components/account-section"
import { AvatarUploader } from "@/features/account/components/avatar-uploader"
import { ProfileForm } from "@/features/account/components/profile-form"
import { getAccount } from "@/features/account/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Cuenta · General",
  path: "/dashboard/account/general",
  noindex: true
})

export default function AccountGeneralPage() {
  return (
    // La sesión es dinámica: va dentro de Suspense
    <Suspense fallback={<CardSkeleton className="h-64" />}>
      <GeneralContent />
    </Suspense>
  )
}

async function GeneralContent() {
  const { user, profile } = await getAccount()

  return (
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
  )
}
