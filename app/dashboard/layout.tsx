import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Separator } from "@heroui/react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { AppSidebarSkeleton } from "@/components/dashboard/app-sidebar-skeleton"
import { QuickAddTransaction } from "@/components/dashboard/quick-add-transaction"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/dashboard/sidebar"
import { WorkspaceThemeRoot } from "@/components/dashboard/workspace-theme-root"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SITE } from "@/config/site"
import { getBusinessWorkspaces } from "@/features/workspaces/queries"
import { createClient } from "@/libs/supabase/server"

// Lee la sesión (cookies): va dentro de un Suspense por cacheComponents
async function DashboardSidebar() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(SITE.routes.signIn)
  }

  const [{ data: profile }, businesses] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single(),
    getBusinessWorkspaces()
  ])

  return (
    <AppSidebar
      user={{
        name: profile?.full_name ?? user.email ?? "",
        email: user.email ?? "",
        avatarUrl: profile?.avatar_url ?? null
      }}
      businesses={businesses.map(({ id, name }) => ({ id, name }))}
    />
  )
}

export default function DashboardLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TooltipProvider>
      <WorkspaceThemeRoot>
        <SidebarProvider>
          <Suspense fallback={<AppSidebarSkeleton />}>
            <DashboardSidebar />
          </Suspense>
          <SidebarInset>
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-separator bg-background/80 px-4 backdrop-blur">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 h-4"
              />
              <span className="text-sm font-medium">{SITE.info.name}</span>
              <div className="ml-auto">
                <QuickAddTransaction />
              </div>
            </header>
            <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </WorkspaceThemeRoot>
    </TooltipProvider>
  )
}
