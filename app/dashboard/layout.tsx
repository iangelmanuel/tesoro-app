import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { AppSidebarSkeleton } from "@/components/dashboard/app-sidebar-skeleton"
import { QuickAddTransaction } from "@/components/dashboard/quick-add-transaction"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SITE } from "@/config/site"
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single()

  return (
    <AppSidebar
      user={{
        name: profile?.full_name ?? user.email ?? "",
        email: user.email ?? "",
        avatarUrl: profile?.avatar_url ?? null
      }}
    />
  )
}

export default function DashboardLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Suspense fallback={<AppSidebarSkeleton />}>
          <DashboardSidebar />
        </Suspense>
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <span className="text-sm font-medium">{SITE.info.name}</span>
            <div className="ml-auto">
              <QuickAddTransaction />
            </div>
          </header>
          <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
