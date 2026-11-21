import { ThemeProvider } from "@/components/theme/theme-provider"
import { Toaster } from "@/components/ui/sonner"

// Tema del usuario (el proveedor vive por grupo de rutas, SPEC 40) y el
// Toaster de sonner para el error de "Restaurar cuenta"
export default function Layout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider>
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
