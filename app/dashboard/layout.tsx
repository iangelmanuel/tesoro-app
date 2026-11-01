import { Suspense, cache } from "react"
import { redirect } from "next/navigation"
import { Skeleton } from "@heroui/react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { AppSidebarSkeleton } from "@/components/dashboard/app-sidebar-skeleton"
import { DashboardTitle } from "@/components/dashboard/dashboard-title"
import { MobileWorkspaceTabs } from "@/components/dashboard/mobile/mobile-workspace-tabs"
import { QuickActions } from "@/components/dashboard/quick-actions"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/dashboard/sidebar"
import { WorkspaceThemeRoot } from "@/components/dashboard/workspace-theme-root"
import { SITE } from "@/config/site"
import { getBusinessWorkspaces } from "@/features/workspaces/queries"
import { createClient } from "@/libs/supabase/server"

// Lee la sesión (cookies): va dentro de un Suspense por cacheComponents.
// cache() la comparte entre el aside y el título del header en el request
const getDashboardUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(SITE.routes.signIn)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single()

  return {
    name: profile?.full_name ?? user.email ?? "",
    email: user.email ?? "",
    avatarUrl: profile?.avatar_url ?? null
  }
})

async function DashboardSidebar() {
  const [user, businesses] = await Promise.all([
    getDashboardUser(),
    getBusinessWorkspaces()
  ])

  return (
    <AppSidebar
      user={user}
      businesses={businesses.map(({ id, name }) => ({ id, name }))}
    />
  )
}

async function DashboardHeaderTitle() {
  const user = await getDashboardUser()
  return <DashboardTitle userName={user.name} />
}

export default function DashboardLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <WorkspaceThemeRoot>
      <SidebarProvider>
        {/* Primer elemento enfocable: salta el aside y el header */}
        <a
          href="#contenido"
          className="sr-only z-50 rounded-3xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Saltar al contenido
        </a>
        <Suspense fallback={<AppSidebarSkeleton />}>
          <DashboardSidebar />
        </Suspense>
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background px-4 md:px-6">
            {/* En el teléfono el aside se abre desde "Más" en la barra inferior */}
            <SidebarTrigger className="-ml-1.5 max-md:hidden" />
            <div className="min-w-0 flex-1">
              {/* La ruta y la sesión son dinámicas: hasta resolverlas, un
                  placeholder del tamaño del título */}
              <Suspense fallback={<Skeleton className="h-6 w-44 rounded-lg" />}>
                <DashboardHeaderTitle />
              </Suspense>
            </div>
            {/* Accesos rápidos del espacio */}
            <div className="flex shrink-0 items-center gap-2">
              <QuickActions />
            </div>
          </header>
          {/* usePathname es dinámico: hasta resolverlo, un placeholder del
              tamaño del tab para que el contenido no salte */}
          <Suspense
            fallback={
              <div className="px-4 pb-2 md:hidden">
                <Skeleton className="h-11 w-full rounded-3xl" />
              </div>
            }
          >
            <MobileWorkspaceTabs />
          </Suspense>
          <main
            id="contenido"
            tabIndex={-1}
            className="flex flex-1 flex-col px-4 pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none md:px-6 md:pb-6"
          >
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceThemeRoot>
  )
}
