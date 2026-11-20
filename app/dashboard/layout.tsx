import { Suspense, cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ToastProvider } from "@heroui/react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { AppSidebarSkeleton } from "@/components/dashboard/app-sidebar-skeleton"
import {
  DashboardHeader,
  DashboardHeaderSkeleton
} from "@/components/dashboard/dashboard-header"
import {
  DashboardTitle,
  DashboardTitleSkeleton
} from "@/components/dashboard/dashboard-title"
import { HideAmountsProvider } from "@/components/dashboard/hide-amounts-context"
import { HideAmountsToggle } from "@/components/dashboard/hide-amounts-toggle"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { ShortcutsPreferenceProvider } from "@/components/dashboard/shortcuts/shortcuts-preference"
import { SidebarInset, SidebarProvider } from "@/components/dashboard/sidebar"
import {
  SIDEBAR_WIDTH_COOKIE,
  parseSidebarWidth
} from "@/components/dashboard/sidebar/width"
import { WorkspaceThemeRoot } from "@/components/dashboard/workspace-theme-root"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { SHORTCUTS_COOKIE, parseShortcutsCookie } from "@/config/shortcuts"
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
  const [user, businesses, cookieStore] = await Promise.all([
    getDashboardUser(),
    getBusinessWorkspaces(),
    cookies()
  ])

  return (
    <AppSidebar
      user={user}
      businesses={businesses.map(({ id, name }) => ({ id, name }))}
      width={parseSidebarWidth(cookieStore.get(SIDEBAR_WIDTH_COOKIE)?.value)}
    />
  )
}

async function DashboardHeaderTitle() {
  const user = await getDashboardUser()
  return <DashboardTitle userName={user.name} />
}

// Entrega al cliente si las cifras están ocultas y qué tutoriales terminó el
// usuario: el primer render ya sale con la máscara y el arranque automático
// decide sin parpadeo ni consulta por página. También si los atajos de
// teclado están encendidos (cookie). Envuelve el aside (el menú de
// cuenta también oculta cifras), el header y el contenido
async function DashboardPreferencesBoundary({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const [user, completedTutorials, cookieStore] = await Promise.all([
    getDashboardUser(),
    getCompletedTutorials(),
    cookies()
  ])
  return (
    <HideAmountsProvider initial={user.hideAmounts}>
      <ShortcutsPreferenceProvider
        initial={parseShortcutsCookie(cookieStore.get(SHORTCUTS_COOKIE)?.value)}
      >
        <TutorialProvider initial={completedTutorials}>
          {children}
          <TutorialAutoStart />
        </TutorialProvider>
      </ShortcutsPreferenceProvider>
    </HideAmountsProvider>
  )
}

export default function DashboardLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  // Tema del usuario: el proveedor vive por grupo de rutas (SPEC 40)
  return (
    <ThemeProvider>
      <WorkspaceThemeRoot>
        {/* Los toasts solo existen en el dashboard: fuera de aquí, react-aria no
          entra en el JS de la landing (SPEC 24) */}
        {/* Toasts de shadcn (sonner). El ToastProvider de HeroUI sigue para
            las pantallas aún en HeroUI, en la misma esquina (SPEC 53 lo
            retira) */}
        <Toaster />
        <ToastProvider placement="bottom end" />
        <SidebarProvider>
          {/* Primer elemento enfocable: salta el aside y el header y lleva el
              foco a main */}
          <a
            href="#contenido"
            className="sr-only z-50 rounded-4xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground outline-none focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Saltar al contenido
          </a>
          {/* Hasta leer el perfil: aside y header como huecos y el contenido
              vacío (sin números que luego haya que ocultar) */}
          <Suspense
            fallback={
              <>
                <AppSidebarSkeleton />
                <SidebarInset>
                  <DashboardHeaderSkeleton />
                  <main
                    id="contenido"
                    tabIndex={-1}
                    className="flex flex-1 flex-col px-4 pt-2 outline-none md:px-6"
                  />
                </SidebarInset>
              </>
            }
          >
            <DashboardPreferencesBoundary>
              <Suspense fallback={<AppSidebarSkeleton />}>
                <DashboardSidebar />
              </Suspense>
              <SidebarInset>
                <DashboardHeader
                  title={
                    // La ruta y la sesión son dinámicas: hasta resolverlas, un
                    // hueco del tamaño del título
                    <Suspense fallback={<DashboardTitleSkeleton />}>
                      <DashboardHeaderTitle />
                    </Suspense>
                  }
                  actions={
                    // Tutorial, ojo y accesos rápidos del espacio
                    <>
                      <TutorialHelpButton />
                      <HideAmountsToggle />
                      <QuickActions />
                    </>
                  }
                />
                <main
                  id="contenido"
                  tabIndex={-1}
                  className="flex flex-1 flex-col px-4 pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] outline-none md:px-6 md:pb-6"
                >
                  {children}
                </main>
              </SidebarInset>
            </DashboardPreferencesBoundary>
          </Suspense>
        </SidebarProvider>
      </WorkspaceThemeRoot>
    </ThemeProvider>
  )
}
