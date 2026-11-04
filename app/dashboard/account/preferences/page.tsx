import { Suspense } from "react"
import { CardSkeleton } from "@/components/dashboard/card-skeleton"
import { AccountSection } from "@/features/account/components/account-section"
import { CurrencyForm } from "@/features/account/components/currency-form"
import { getAccount } from "@/features/account/queries"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Cuenta · Preferencias",
  path: "/dashboard/account/preferences",
  noindex: true
})

export default function AccountPreferencesPage() {
  return (
    // La sesión es dinámica: va dentro de Suspense
    <Suspense fallback={<CardSkeleton className="h-48" />}>
      <PreferencesContent />
    </Suspense>
  )
}

async function PreferencesContent() {
  const { profile } = await getAccount()

  return (
    <AccountSection
      title="Moneda"
      description="Cómo se muestran tus montos."
    >
      <CurrencyForm currency={profile.currency} />
    </AccountSection>
  )
}
