import { Suspense, cache } from "react"
import { redirect } from "next/navigation"
import { Skeleton, ToastProvider } from "@heroui/react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { AppSidebarSkeleton } from "@/components/dashboard/app-sidebar-skeleton"
import { DashboardTitle } from "@/components/dashboard/dashboard-title"
import { HideAmountsProvider } from "@/components/dashboard/hide-amounts-context"
import { HideAmountsToggle } from "@/components/dashboard/hide-amounts-toggle"
import { QuickActions } from "@/components/dashboard/quick-actions"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/dashboard/sidebar"
import { WorkspaceThemeRoot } from "@/components/dashboard/workspace-theme-root"
import { SITE } from "@/config/site"
import { TutorialAutoStart } from "@/features/tutorials/components/tutorial-auto-start"
import { TutorialHelpButton } from "@/features/tutorials/components/tutorial-help-button"
import { TutorialProvider } from "@/features/tutorials/components/tutorial-provider"
import { getCompletedTutorials } from "@/features/tutorials/queries"
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
    .select("full_name, avatar_url, hide_amounts")
    .eq("id", user.id)
    .single()

  return {
    name: profile?.full_name ?? user.email ?? "",
    email: user.email ?? "",
    avatarUrl: profile?.avatar_url ?? null,
    hideAmounts: profile?.hide_amounts ?? false
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

// Entrega al cliente si las cifras están ocultas y qué tutoriales terminó el
// usuario: el primer render ya sale con la máscara y el arranque automático
// decide sin parpadeo ni consulta por página. Envuelve el header y el contenido
async function DashboardPreferencesBoundary({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const [user, completedTutorials] = await Promise.all([
    getDashboardUser(),
    getCompletedTutorials()
  ])
  return (
    <HideAmountsProvider initial={user.hideAmounts}>
      <TutorialProvider initial={completedTutorials}>
        {children}
        <TutorialAutoStart />
      </TutorialProvider>
    </HideAmountsProvider>
  )
}

export default function DashboardLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <WorkspaceThemeRoot>
      {/* Los toasts solo existen en el dashboard: fuera de aquí, react-aria no
          entra en el JS de la landing (SPEC 24) */}
      <ToastProvider placement="bottom end" />
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
          {/* Hasta leer el perfil: el header sin acciones y el contenido vacío
              (sin números que luego haya que ocultar) */}
          <Suspense
            fallback={
              <>
                <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background px-4 md:px-6">
                  <SidebarTrigger className="-ml-1.5 max-md:size-11" />
                  <Skeleton className="h-6 w-44 rounded-lg" />
                </header>
                <main
                  id="contenido"
                  tabIndex={-1}
                  className="flex flex-1 flex-col px-4 pt-2 outline-none md:px-6"
                />
              </>
            }
          >
            <DashboardPreferencesBoundary>
              <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 bg-background px-4 md:px-6">
                {/* En el teléfono abre el Drawer del aside (44 px de área táctil) */}
                <SidebarTrigger className="-ml-1.5 max-md:size-11" />
                <div className="min-w-0 flex-1">
                  {/* La ruta y la sesión son dinámicas: hasta resolverlas, un
                      placeholder del tamaño del título */}
                  <Suspense
                    fallback={<Skeleton className="h-6 w-44 rounded-lg" />}
                  >
                    <DashboardHeaderTitle />
                  </Suspense>
                </div>
                {/* Tutorial, ojo y accesos rápidos del espacio */}
                <div className="flex shrink-0 items-center gap-2">
                  <TutorialHelpButton />
                  <HideAmountsToggle />
                  <QuickActions />
                </div>
              </header>
              <main
                id="contenido"
                tabIndex={-1}
                className="flex flex-1 flex-col px-4 pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none md:px-6 md:pb-6"
              >
                {children}
              </main>
            </DashboardPreferencesBoundary>
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
    </WorkspaceThemeRoot>
  )
}
