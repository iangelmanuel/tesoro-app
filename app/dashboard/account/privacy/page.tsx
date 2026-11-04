import { AccountSection } from "@/features/account/components/account-section"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  title: "Cuenta · Privacidad",
  path: "/dashboard/account/privacy",
  noindex: true
})

// El interruptor de ocultar cifras llega en el paso 8 del SPEC 22
export default function AccountPrivacyPage() {
  return (
    <AccountSection
      title="Cifras"
      description="Oculta saldos y totales para mirar Tesoro en público."
    />
  )
}
