import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { ThemeProvider } from "@/components/theme/theme-provider"

export default function PublicLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  // Siempre en claro, sin selector de tema (SPEC 40)
  return (
    <ThemeProvider forcedTheme="light">
      <div
        data-surface="site"
        className="flex min-h-svh flex-col"
      >
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </ThemeProvider>
  )
}
