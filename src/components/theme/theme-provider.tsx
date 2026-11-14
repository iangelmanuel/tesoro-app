"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

// Proveedor de tema por grupo de rutas, no en el layout raíz (SPEC 40):
// - `app/(public)/layout.tsx` lo monta con `forcedTheme="light"`: landing,
//   legales y /mcp van siempre en claro, sin selector;
// - el dashboard, la auth, /account-deleted y /oauth lo montan normal, con
//   el tema que el usuario eligió (oscuro por defecto).
// No se decide con usePathname en la raíz: con cacheComponents, leer la URL
// fuera de <Suspense> rompe el prerender. next-themes ignora un proveedor
// anidado, por eso hay uno solo por árbol
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
