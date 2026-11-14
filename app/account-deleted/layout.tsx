import { ThemeProvider } from "@/components/theme/theme-provider"

// Tema del usuario (el proveedor vive por grupo de rutas, SPEC 40)
export default function Layout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return <ThemeProvider>{children}</ThemeProvider>
}
