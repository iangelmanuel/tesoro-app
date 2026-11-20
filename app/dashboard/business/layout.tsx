import { ToastProvider } from "@heroui/react"

// Toasts de las pantallas de Empresa aún en HeroUI (crear empresa, ajustes,
// restaurar), en la misma esquina que sonner. Fuera del layout del dashboard
// para que Personal no cargue HeroUI (SPEC 52c); SPEC 53 lo retira
export default function BusinessLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ToastProvider placement="bottom end" />
      {children}
    </>
  )
}
