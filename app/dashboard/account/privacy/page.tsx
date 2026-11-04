import { AccountSection } from "@/features/account/components/account-section"
import { HideAmountsSwitch } from "@/features/account/components/hide-amounts-switch"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Cuenta · Privacidad",
  path: "/dashboard/account/privacy",
  noindex: true
})

// Aquí irán también las sesiones y los datos (fuera del alcance del SPEC 22)
export default function AccountPrivacyPage() {
  return (
    <AccountSection
      title="Cifras"
      description="Oculta saldos y totales para mirar Tesoro en público."
    >
      <HideAmountsSwitch />
    </AccountSection>
  )
}
