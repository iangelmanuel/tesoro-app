import { DashboardTitleSkeleton } from "./dashboard-title"
import { QuickActionsSkeleton } from "./quick-actions"
import { SidebarTrigger } from "./sidebar"

// Header del dashboard: el trigger del aside, el único título de la pantalla
// y los accesos (tutorial, ojo, paleta y acciones rápidas). Fijo arriba, en
// el fondo de la página. El skeleton usa el mismo marco
function DashboardHeaderFrame({
  title,
  actions
}: Readonly<{ title: React.ReactNode; actions: React.ReactNode }>) {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 bg-background px-4 md:px-6">
      {/* En el teléfono abre el panel del aside */}
      <SidebarTrigger className="-ml-2" />
      <div className="min-w-0 flex-1">{title}</div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  )
}

export function DashboardHeader({
  title,
  actions
}: Readonly<{ title: React.ReactNode; actions: React.ReactNode }>) {
  return (
    <DashboardHeaderFrame
      title={title}
      actions={actions}
    />
  )
}

/** Mientras se lee la sesión: el título y los accesos como huecos */
export function DashboardHeaderSkeleton() {
  return (
    <DashboardHeaderFrame
      title={<DashboardTitleSkeleton />}
      actions={<QuickActionsSkeleton />}
    />
  )
}
