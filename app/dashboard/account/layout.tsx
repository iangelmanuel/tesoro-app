import { ToastProvider } from "@heroui/react"
import { AccountNav } from "@/features/account/components/account-nav"

// Aside interno (lista horizontal en el teléfono) y la sección activa. El
// título de la página lo pone el header.
export default function AccountLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 md:flex-row md:gap-8">
      {/* Toasts de las pantallas de cuenta aún en HeroUI, en la misma esquina
          que sonner. Fuera del layout del dashboard para que Personal no
          cargue HeroUI (SPEC 52c); SPEC 53 lo retira */}
      <ToastProvider placement="bottom end" />
      <AccountNav />
      <div className="flex min-w-0 flex-1 flex-col gap-6 md:max-w-2xl">
        {children}
      </div>
    </div>
  )
}
